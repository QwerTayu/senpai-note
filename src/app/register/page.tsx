"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { api, Spinner } from "@/components/ui";
import { generationOf, PROFILE_DEPARTMENTS, type Generation, type Profile, type ProfileDepartment, type Role } from "@/lib/types";

const ROLES: { role: Role; title: string; body: string }[] = [
  { role: "current", title: "現役の代（B3）", body: "今年の本番を担当します。今年の計画を立てて、先輩に聞きたいことを調べます。" },
  { role: "previous", title: "前の代（B4）", body: "引退して、半年間の長期インターン（実務訓練）などで学校を離れています。知識カードを確かめて、後輩の質問に答えます。" },
];

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
function formatFestival(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${y}年${m}月${d}日（${WEEKDAYS[new Date(y, m - 1, d).getDay()]}）`;
}

export default function RegisterPage() {
  const currentGeneration = generationOf(new Date().toISOString());
  const [role, setRole] = useState<Role | null>(null);
  const [generation, setGeneration] = useState(currentGeneration);
  const [department, setDepartment] = useState<ProfileDepartment | null>(null);
  const [name, setName] = useState("");
  const [festivalDate, setFestivalDate] = useState("");
  const [existing, setExisting] = useState<Generation | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 登録し直すときは、今の登録を初めから入れておく
  useEffect(() => {
    api<{ profile: Profile | null }>("/api/profile").then(({ profile }) => {
      if (!profile) return;
      setRole(profile.role);
      setGeneration(profile.generation);
      setDepartment(profile.department);
      setName(profile.name);
    });
  }, []);

  // 現役の代なら、その代の本番の日がもう入っているかを調べる
  useEffect(() => {
    if (role !== "current") return;
    setExisting(undefined);
    api<{ generation: Generation | null }>(`/api/generations/${generation}`)
      .then((r) => setExisting(r.generation))
      .catch(() => setExisting(null));
  }, [role, generation]);

  function chooseRole(r: Role) {
    setRole(r);
    setGeneration(r === "current" ? currentGeneration : currentGeneration - 1);
  }

  const needsFestival = role === "current" && existing === null;
  const ready = role && department && name.trim() && (!needsFestival || festivalDate) && (role !== "current" || existing !== undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    setError("");
    try {
      const { home } = await api<{ home: string }>("/api/profile", {
        method: "POST",
        body: JSON.stringify({ role, generation, department, name: name.trim() }),
      });
      let makePlan = false;
      if (role === "current") {
        let gen = existing;
        if (needsFestival) {
          gen = (await api<{ generation: Generation }>(`/api/generations/${generation}`, { method: "POST", body: JSON.stringify({ festivalDate }) }))
            .generation;
        }
        makePlan = !!gen && gen.planStatus !== "done" && gen.planStatus !== "running";
      }
      location.href = makePlan ? `${home}?makePlan=1` : home;
    } catch (err) {
      setError(String(err));
      setSaving(false);
    }
  }

  const generationOptions = [currentGeneration - 2, currentGeneration - 1, currentGeneration, currentGeneration + 1];

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">senpai-note へようこそ</h1>
        <p className="text-sm text-ink-soft">
          毎年メンバーが入れ替わる組織のための「1代上の先輩」ノートです。前の代（B4）がいなくても、現役の代（B3）が回せるように、先輩の代わりをします。最初に、あなたのことを教えてください。
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-bold">1. あなたはどちらですか？</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {ROLES.map((r) => (
            <button
              type="button"
              key={r.role}
              onClick={() => chooseRole(r.role)}
              aria-pressed={role === r.role}
              className={`rounded-[8px] border-2 bg-sheet p-4 text-left ${role === r.role ? "border-ink" : "border-rule hover:border-pencil"}`}
            >
              <span className="flex items-center gap-2 font-bold">
                <Icon name={r.role === "current" ? "school" : "work"} size={22} />
                {r.title}
              </span>
              <span className="mt-1 block text-sm text-ink-soft">{r.body}</span>
            </button>
          ))}
        </div>
      </section>

      {role && (
        <section className="page space-y-6 p-6">
          <h2 className="font-bold">2. あなたの代・部門・名前</h2>
          <label className="block space-y-1">
            <span className="text-sm text-ink-soft">代（担当する・した本番の年）</span>
            <select value={generation} onChange={(e) => setGeneration(Number(e.target.value))} className="field block w-auto">
              {generationOptions.map((g) => (
                <option key={g} value={g}>
                  {g}年度の代（{g}年の本番）
                  {g === currentGeneration ? " ← 今の現役" : g === currentGeneration - 1 ? " ← 今の前の代" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-1">
            <span className="text-sm text-ink-soft">部門</span>
            <div className="flex flex-wrap gap-2">
              {PROFILE_DEPARTMENTS.map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => setDepartment(d)}
                  aria-pressed={department === d}
                  className={`rounded-[4px] border px-4 py-1 text-sm ${department === d ? "border-ink bg-ink font-bold text-sheet" : "border-rule text-ink-soft hover:border-pencil"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <label className="block space-y-1">
            <span className="text-sm text-ink-soft">名前（知識カードの確認や先輩の回答に残ります）</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="例: 西田" className="field block" />
          </label>
        </section>
      )}

      {role === "current" && (
        <section className="page space-y-3 p-6">
          <h2 className="font-bold">3. 今年の本番の日</h2>
          {existing === undefined ? (
            <Spinner label="確かめています" />
          ) : existing ? (
            <p className="text-sm">
              {generation}年度の本番は <span className="font-bold">{formatFestival(existing.festivalDate)}</span> です（{existing.registeredBy}が登録）。
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-soft">
                {generation}年度の代で最初の登録です。本番の初日を入れると、前の代までの知識カードから今年の年間計画を作ります。
              </p>
              <input
                type="date"
                value={festivalDate}
                min={`${generation}-01-01`}
                max={`${generation}-12-31`}
                onChange={(e) => setFestivalDate(e.target.value)}
                className="field w-auto"
              />
            </>
          )}
        </section>
      )}

      {error && <p className="text-sm text-pen">{error}</p>}
      <button disabled={!ready || saving} className="btn btn-ink w-full py-3 text-base">
        {saving ? "登録しています" : "登録してはじめる"}
      </button>
      <p className="text-center text-xs text-pencil">登録はこのブラウザに残ります。右上のメニューから登録し直せます。</p>
    </form>
  );
}
