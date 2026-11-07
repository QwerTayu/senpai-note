"use client";
import { useEffect, useState } from "react";
import { api, Spinner } from "@/components/ui";
import { generationOf, PROFILE_DEPARTMENTS, type Generation, type Profile, type ProfileDepartment, type Role } from "@/lib/types";

const ROLES: { role: Role; title: string; body: string }[] = [
  { role: "current", title: "現役の代（B3）", body: "今年の本番を担当します。今年の計画を立てて、先輩に聞きたいことを調べます。" },
  { role: "previous", title: "前の代（B4）", body: "引退して、実務訓練などに出ています。知識カードを確かめて、後輩の質問に答えます。" },
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
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">senpai-note へようこそ</h1>
        <p className="text-sm text-stone-600">
          毎年メンバーが入れ替わる組織のための「1代上の先輩」ノートです。前の代（B4）がいなくても、現役の代（B3）が回せるように、先輩の代わりをします。最初に、あなたのことを教えてください。
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-stone-700">1. あなたはどちらですか？</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map((r) => (
            <button
              type="button"
              key={r.role}
              onClick={() => chooseRole(r.role)}
              className={`rounded-xl border-2 bg-white p-4 text-left transition ${role === r.role ? "border-stone-900" : "border-stone-200 hover:border-stone-400"}`}
            >
              <div className="font-bold">{r.title}</div>
              <div className="mt-1 text-sm text-stone-600">{r.body}</div>
            </button>
          ))}
        </div>
      </section>

      {role && (
        <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-bold text-stone-700">2. あなたの代・部門・名前</h2>
          <label className="block space-y-1">
            <span className="text-sm text-stone-600">代（担当する・した本番の年）</span>
            <select value={generation} onChange={(e) => setGeneration(Number(e.target.value))} className="block rounded-lg border border-stone-300 px-3 py-2">
              {generationOptions.map((g) => (
                <option key={g} value={g}>
                  {g}年度の代（{g}年の本番）
                  {g === currentGeneration ? " ← 今の現役" : g === currentGeneration - 1 ? " ← 今の前の代" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-1">
            <span className="text-sm text-stone-600">部門</span>
            <div className="flex flex-wrap gap-2">
              {PROFILE_DEPARTMENTS.map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => setDepartment(d)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium ${department === d ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <label className="block space-y-1">
            <span className="text-sm text-stone-600">名前（知識カードの確認や先輩の回答に残ります）</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="例: 西田" className="block w-full rounded-lg border border-stone-300 px-3 py-2" />
          </label>
        </section>
      )}

      {role === "current" && (
        <section className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-bold text-stone-700">3. 今年の本番の日</h2>
          {existing === undefined ? (
            <Spinner label="確かめています…" />
          ) : existing ? (
            <p className="text-sm">
              {generation}年度の本番は <span className="font-bold">{formatFestival(existing.festivalDate)}</span> です（{existing.registeredBy}が登録）。
            </p>
          ) : (
            <>
              <p className="text-sm text-stone-600">
                {generation}年度の代で最初の登録です。本番の初日を入れると、前の代までの知識カードから今年の年間計画を作ります。
              </p>
              <input
                type="date"
                value={festivalDate}
                min={`${generation}-01-01`}
                max={`${generation}-12-31`}
                onChange={(e) => setFestivalDate(e.target.value)}
                className="rounded-lg border border-stone-300 px-3 py-2"
              />
            </>
          )}
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={!ready || saving} className="w-full rounded-lg bg-stone-900 py-3 font-bold text-white disabled:opacity-40">
        {saving ? "登録しています…" : "はじめる"}
      </button>
      <p className="text-center text-xs text-stone-400">登録はこのブラウザに残ります。右上のメニューから登録し直せます。</p>
    </form>
  );
}
