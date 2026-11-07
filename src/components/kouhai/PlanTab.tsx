"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CitedCards } from "@/components/CitedCards";
import { addDaysYmd, api, daysBetween, formatYmd, Spinner, todayYmd } from "@/components/ui";
import { PLAN_DEPARTMENTS, type Advice, type Card, type Generation, type PlanDepartment, type PlanItem, type Profile, type Source } from "@/lib/types";

interface PlanData {
  generation: Generation | null;
  items: PlanItem[];
  advice: Advice[];
}

type DeptFilter = "all" | PlanDepartment;

const DEPT_COLOR: Record<PlanDepartment, string> = {
  局全体: "bg-stone-200 text-stone-700",
  会場: "bg-sky-100 text-sky-800",
  備品: "bg-emerald-100 text-emerald-800",
  申請: "bg-violet-100 text-violet-800",
};

// 部門で絞り込むときは、局全体の項目も一緒に出す
function matches(item: PlanItem, filter: DeptFilter) {
  return filter === "all" || item.department === filter || (filter !== "局全体" && item.department === "局全体");
}

export function PlanTab({
  profile,
  cardById,
  sourceById,
  autoGenerate,
}: {
  profile: Profile;
  cardById: Map<string, Card>;
  sourceById: Map<string, Source>;
  autoGenerate: boolean;
}) {
  const [data, setData] = useState<PlanData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<DeptFilter>(profile.department === "局長" ? "all" : profile.department);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const autoStarted = useRef(false);

  const load = useCallback(async () => {
    const d = await api<PlanData>("/api/plan");
    setData(d);
    return d;
  }, []);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError("");
    setConfirmRegenerate(false);
    try {
      await api("/api/plan", { method: "POST" });
    } catch (e) {
      setError(String(e));
    } finally {
      await load();
      setGenerating(false);
    }
  }, [load]);

  useEffect(() => {
    load().then((d) => {
      // 登録の直後（?makePlan=1）は、計画をすぐ作り始める
      if (autoGenerate && !autoStarted.current && d.generation && (d.generation.planStatus === "none" || d.generation.planStatus === "error")) {
        autoStarted.current = true;
        generate();
      }
    });
  }, [load, generate, autoGenerate]);

  // ほかの人が作っている途中なら、終わるまで待つ
  useEffect(() => {
    if (generating || data?.generation?.planStatus !== "running") return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [generating, data?.generation?.planStatus, load]);

  const adviceByItem = useMemo(() => {
    const map = new Map<string, Advice[]>();
    for (const a of data?.advice ?? []) map.set(a.planItemId, [...(map.get(a.planItemId) ?? []), a]);
    return map;
  }, [data?.advice]);

  if (!data) return <Spinner label="読み込み中…" />;
  const gen = data.generation;
  const today = todayYmd();

  if (!gen) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
        {profile.generation}年度の本番の日がまだ入っていません。右上のメニューの「登録し直す」から入れてください。
      </div>
    );
  }

  const running = generating || gen.planStatus === "running";
  const items = data.items.filter((i) => matches(i, filter));
  const soon = items.filter((i) => !i.done && i.date <= addDaysYmd(today, 30));
  const byMonth = new Map<string, PlanItem[]>();
  for (const i of items) byMonth.set(i.date.slice(0, 7), [...(byMonth.get(i.date.slice(0, 7)) ?? []), i]);
  const daysLeft = daysBetween(today, gen.festivalDate);
  const firstWithAdvice = items.find((i) => (adviceByItem.get(i.id) ?? []).length > 0)?.id;

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4">
        <div>
          <div className="text-sm text-stone-500">{gen.year}年度の代の年間計画</div>
          <div className="text-lg font-bold">
            本番 {formatYmd(gen.festivalDate, true)}
            {daysLeft >= 0 && <span className="ml-2 text-sm font-medium text-stone-500">まであと {daysLeft} 日</span>}
          </div>
          <div className="text-xs text-stone-500">前の代までが確かめた知識カードから、エージェントが作りました。日付やメモは自由に直せます。</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div data-tour="dept-filter" className="flex flex-wrap gap-1 text-sm">
            {(["all", ...PLAN_DEPARTMENTS] as DeptFilter[]).map((d) => (
              <button
                key={d}
                onClick={() => setFilter(d)}
                className={`rounded-full px-3 py-1 ${filter === d ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
              >
                {d === "all" ? "すべて" : d}
              </button>
            ))}
          </div>
          {data.items.length > 0 && !running && (
            <div className="text-xs">
              {confirmRegenerate ? (
                <span className="flex items-center gap-2">
                  <span className="text-red-700">直した日付・メモ・足した項目も消えます。</span>
                  <button onClick={generate} className="rounded bg-red-600 px-2 py-1 font-medium text-white">
                    作り直す
                  </button>
                  <button onClick={() => setConfirmRegenerate(false)} className="text-stone-500">
                    やめる
                  </button>
                </span>
              ) : (
                <button onClick={() => setConfirmRegenerate(true)} className="text-stone-500 underline">
                  計画を作り直す
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {running ? (
        <div className="space-y-2 rounded-xl border border-stone-200 bg-white p-6">
          <Spinner label="前の代までの知識カードを読んで、今年の計画とアドバイスを作っています（1〜2分）…" />
          <p className="text-xs text-stone-500">時期のある知識カードを今年の日付に直し、去年の問題とアドバイスを付けています。</p>
        </div>
      ) : data.items.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-6 text-sm">
          <p>まだ計画がありません。前の代までの知識カードから、今年の年間計画を作ります。</p>
          <button onClick={generate} className="rounded-lg bg-stone-900 px-4 py-2 font-medium text-white">
            今年の計画を作る
          </button>
        </div>
      ) : (
        <>
          <section data-tour="today" className="space-y-2 rounded-xl border-2 border-sky-200 bg-sky-50 p-4">
            <h2 className="font-bold">今やること</h2>
            <p className="text-xs text-sky-900">期限を過ぎたものと、30日以内にやること（{formatYmd(today)} 時点）</p>
            {soon.length === 0 ? (
              <p className="text-sm text-stone-600">今やることはありません。</p>
            ) : (
              <ul className="space-y-1.5">
                {soon.map((i) => {
                  const overdue = i.date < today;
                  const advice = adviceByItem.get(i.id) ?? [];
                  return (
                    <li key={i.id}>
                      <a href={`#plan-${i.id}`} className="flex flex-wrap items-baseline gap-x-2 rounded-lg bg-white px-3 py-2 text-sm hover:ring-1 hover:ring-sky-300">
                        <span className={`font-medium ${overdue ? "text-red-700" : "text-stone-700"}`}>
                          {formatYmd(i.date)}
                          {overdue && "（過ぎています）"}
                        </span>
                        <span className="font-bold">{i.title}</span>
                        <DeptBadge department={i.department} />
                        {advice.length > 0 && <span className="text-xs text-stone-500">先輩からのアドバイス {advice.length}件</span>}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section data-tour="plan-timeline" className="space-y-5">
            {[...byMonth.entries()].map(([month, monthItems]) => (
              <div key={month} className="space-y-2">
                <h3 className="sticky top-[60px] z-[1] bg-[#f7f6f2]/95 py-1 text-sm font-bold text-stone-500">
                  {Number(month.slice(0, 4))}年{Number(month.slice(5, 7))}月
                </h3>
                <ul className="space-y-2">
                  {monthItems.map((i) => (
                    <PlanItemCard
                      key={i.id}
                      item={i}
                      advice={adviceByItem.get(i.id) ?? []}
                      cardById={cardById}
                      sourceById={sourceById}
                      today={today}
                      tourAdvice={i.id === firstWithAdvice}
                      onChanged={load}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <AddItemForm onAdded={load} defaultDepartment={profile.department === "局長" ? "局全体" : profile.department} />
        </>
      )}
    </div>
  );
}

function DeptBadge({ department }: { department: PlanDepartment }) {
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${DEPT_COLOR[department]}`}>{department}</span>;
}

const ADVICE_STYLE = {
  record: { icon: "📘", label: "去年までの記録", box: "border-sky-200 bg-sky-50", text: "text-sky-900" },
  confirmed: { icon: "💡", label: "先輩が確認した提案", box: "border-green-200 bg-green-50", text: "text-green-900" },
  draft: { icon: "💡", label: "エージェントの提案（先輩の確認待ち）", box: "border-amber-200 bg-amber-50", text: "text-amber-900" },
};

function PlanItemCard({
  item,
  advice,
  cardById,
  sourceById,
  today,
  tourAdvice,
  onChanged,
}: {
  item: PlanItem;
  advice: Advice[];
  cardById: Map<string, Card>;
  sourceById: Map<string, Source>;
  today: string;
  tourAdvice: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const [mode, setMode] = useState<"view" | "date" | "memo" | "delete">("view");
  const [date, setDate] = useState(item.date);
  const [reason, setReason] = useState("");
  const [memo, setMemo] = useState(item.memo ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cards = item.cardIds.map((id) => cardById.get(id)).filter((c): c is Card => !!c);
  const overdue = !item.done && item.date < today;
  // 記録 → 先輩が確認した提案 → 確認待ちの提案 の順に出す
  const sorted = [...advice].sort((a, b) => rank(a) - rank(b));

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      await api(`/api/plan-items/${item.id}`, { method: "PATCH", body: JSON.stringify(body) });
      await onChanged();
      setMode("view");
      setReason("");
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await api(`/api/plan-items/${item.id}`, { method: "DELETE" });
      await onChanged();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  }

  return (
    <li id={`plan-${item.id}`} data-tour={tourAdvice ? "plan-item" : undefined} className={`scroll-mt-24 space-y-3 rounded-xl border bg-white p-4 ${item.done ? "border-stone-200 opacity-60" : "border-stone-200"}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={item.done}
          disabled={saving}
          onChange={(e) => patch({ done: e.target.checked })}
          className="mt-1 h-5 w-5 shrink-0 accent-stone-900"
          aria-label="終わった"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm font-bold ${overdue ? "text-red-700" : "text-stone-700"}`}>{formatYmd(item.date)}</span>
            <DeptBadge department={item.department} />
            {item.origin === "added" && <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">自分たちで足した項目</span>}
          </div>
          <div className={`font-bold leading-snug ${item.done ? "line-through" : ""}`}>{item.title}</div>
          {item.detail && <p className="text-sm leading-relaxed text-stone-700">{item.detail}</p>}
          {item.originalDate && item.originalDate !== item.date && (
            <p className="text-xs text-stone-500">
              最初の予定 {formatYmd(item.originalDate)} から変えました{item.dateChangeReason && `: ${item.dateChangeReason}`}
            </p>
          )}
          {item.memo && mode !== "memo" && <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm">📝 {item.memo}</p>}
        </div>
      </div>

      {sorted.length > 0 && (
        <div data-tour={tourAdvice ? "advice" : undefined} className="space-y-2">
          {sorted.map((a) => {
            const style = ADVICE_STYLE[a.kind === "record" ? "record" : a.status];
            const adviceCards = a.cardIds.map((id) => cardById.get(id)).filter((c): c is Card => !!c);
            return (
              <div key={a.id} className={`space-y-1 rounded-lg border px-3 py-2 ${style.box}`}>
                <div className={`text-xs font-bold ${style.text}`}>
                  {style.icon} {style.label}
                  {a.status === "confirmed" && a.kind === "suggestion" && a.confirmedBy && `（${a.confirmedBy}）`}
                </div>
                <p className="text-sm leading-relaxed">{a.text}</p>
                <CitedCards cards={adviceCards} sourceById={sourceById} label={`根拠の知識カード（${adviceCards.length}枚）`} />
              </div>
            );
          })}
        </div>
      )}

      <CitedCards cards={cards} sourceById={sourceById} label={`元にした知識カード（${cards.length}枚）と元の投稿`} />

      {mode === "date" && (
        <div className="space-y-2 rounded-lg bg-stone-50 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-stone-300 px-2 py-1" />
            <span className="text-stone-500">に変える</span>
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="変える理由（次の代の知識になります）"
            className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
          />
          <div className="flex gap-2 text-sm">
            <button
              disabled={saving || !reason.trim() || date === item.date}
              onClick={() => patch({ date, dateChangeReason: reason.trim() })}
              className="rounded bg-stone-900 px-3 py-1 font-medium text-white disabled:opacity-40"
            >
              保存
            </button>
            <button onClick={() => setMode("view")} className="text-stone-500">
              やめる
            </button>
          </div>
        </div>
      )}
      {mode === "memo" && (
        <div className="space-y-2 rounded-lg bg-stone-50 p-3">
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            placeholder="やってみてどうだったか（次の代の知識になります）"
            className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
          />
          <div className="flex gap-2 text-sm">
            <button disabled={saving} onClick={() => patch({ memo: memo.trim() || null })} className="rounded bg-stone-900 px-3 py-1 font-medium text-white disabled:opacity-40">
              保存
            </button>
            <button onClick={() => setMode("view")} className="text-stone-500">
              やめる
            </button>
          </div>
        </div>
      )}
      {mode === "delete" && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm">
          <span className="text-red-800">この項目を計画から消しますか？</span>
          <button disabled={saving} onClick={remove} className="rounded bg-red-600 px-3 py-1 font-medium text-white">
            消す
          </button>
          <button onClick={() => setMode("view")} className="text-stone-500">
            やめる
          </button>
        </div>
      )}
      {mode === "view" && (
        <div className="flex gap-4 text-xs text-stone-500">
          <button onClick={() => setMode("date")} className="hover:text-stone-900">
            日付を変える
          </button>
          <button onClick={() => setMode("memo")} className="hover:text-stone-900">
            {item.memo ? "メモを直す" : "メモ・ふりかえりを書く"}
          </button>
          <button onClick={() => setMode("delete")} className="hover:text-red-700">
            消す
          </button>
          {item.updatedBy && <span className="ml-auto">最後に直した人: {item.updatedBy}</span>}
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </li>
  );
}

function rank(a: Advice) {
  if (a.kind === "record") return 0;
  return a.status === "confirmed" ? 1 : 2;
}

function AddItemForm({ onAdded, defaultDepartment }: { onAdded: () => Promise<unknown>; defaultDepartment: PlanDepartment }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayYmd());
  const [department, setDepartment] = useState<PlanDepartment>(defaultDepartment);
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/plan-items", { method: "POST", body: JSON.stringify({ title, date, department, detail }) });
      await onAdded();
      setTitle("");
      setDetail("");
      setOpen(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-xl border border-dashed border-stone-300 py-3 text-sm text-stone-600 hover:bg-white">
        ＋ 去年にはなかった仕事を計画に足す
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
      <div className="font-bold">計画に項目を足す</div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="やること" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
      <div className="flex flex-wrap gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        <select value={department} onChange={(e) => setDepartment(e.target.value as PlanDepartment)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
          {PLAN_DEPARTMENTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>
      <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="何をするか（任意）" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button disabled={saving || !title.trim()} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
          足す
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-stone-500">
          やめる
        </button>
      </div>
    </form>
  );
}
