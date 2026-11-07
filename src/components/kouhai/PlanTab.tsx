"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CitedCards } from "@/components/CitedCards";
import { Icon, type IconName } from "@/components/Icon";
import { addDaysYmd, api, daysBetween, formatYmd, Spinner, todayYmd } from "@/components/ui";
import { PLAN_DEPARTMENTS, type Advice, type Card, type Generation, type PlanDepartment, type PlanItem, type Profile, type Source } from "@/lib/types";

interface PlanData {
  generation: Generation | null;
  items: PlanItem[];
  advice: Advice[];
}

type DeptFilter = "all" | PlanDepartment;

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

  if (!data) return <Spinner label="読み込み中" />;
  const gen = data.generation;
  const today = todayYmd();

  if (!gen) {
    return (
      <div className="page p-6 text-sm text-ink-soft">
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
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-1">
          <p className="text-sm text-pencil">{gen.year}年度の代の年間計画</p>
          <h1 className="text-2xl font-bold leading-snug">
            本番 {formatYmd(gen.festivalDate, true)}
            {daysLeft >= 0 && <span className="ml-3 text-base font-normal text-ink-soft">まであと{daysLeft}日</span>}
          </h1>
          <p className="max-w-[40em] text-sm text-ink-soft">前の代までが確かめた知識カードから作った計画です。日付やメモは、今年のやり方に合わせて直してください。</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div data-tour="dept-filter" role="group" aria-label="部門で絞り込む" className="flex overflow-hidden rounded-[4px] border border-rule bg-sheet text-sm">
            {(["all", ...PLAN_DEPARTMENTS] as DeptFilter[]).map((d) => (
              <button
                key={d}
                onClick={() => setFilter(d)}
                aria-pressed={filter === d}
                className={`border-l border-rule px-3 py-1 first:border-l-0 ${filter === d ? "bg-ink font-bold text-sheet" : "text-ink-soft hover:bg-paper"}`}
              >
                {d === "all" ? "すべて" : d}
              </button>
            ))}
          </div>
          {data.items.length > 0 && !running && (
            <div className="text-xs">
              {confirmRegenerate ? (
                <span className="flex items-center gap-3">
                  <span className="text-pen">直した日付・メモ・足した項目も消えます。</span>
                  <button onClick={generate} className="btn btn-pen px-3 py-1 text-xs">
                    作り直す
                  </button>
                  <button onClick={() => setConfirmRegenerate(false)} className="btn-text">
                    やめる
                  </button>
                </span>
              ) : (
                <button onClick={() => setConfirmRegenerate(true)} className="btn-text">
                  計画を作り直す
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {error && <p className="text-sm text-pen">{error}</p>}

      {running ? (
        <div className="page space-y-2 p-6">
          <Spinner label="前の代までの知識カードを読んで、今年の計画とアドバイスを作っています（1〜2分）" />
          <p className="text-sm text-pencil">時期のある知識カードを今年の日付に直し、去年の問題とアドバイスを付けています。</p>
        </div>
      ) : data.items.length === 0 ? (
        <div className="page space-y-4 p-6 text-sm">
          <p>まだ計画がありません。前の代までの知識カードから、今年の年間計画を作ります。</p>
          <button onClick={generate} className="btn btn-ink">
            <Icon name="calendar" />
            今年の計画を作る
          </button>
        </div>
      ) : (
        <>
          <section data-tour="today" className="page border-t-4 border-t-ink">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-6 pb-2 pt-4">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Icon name="today" size={22} />
                今やること
              </h2>
              <p className="text-xs text-pencil">期限を過ぎたものと、30日以内にやること（{formatYmd(today)}時点）</p>
            </div>
            {soon.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-ink-soft">今やることはありません。</p>
            ) : (
              <ul>
                {soon.map((i) => {
                  const overdue = i.date < today;
                  const advice = adviceByItem.get(i.id) ?? [];
                  return (
                    <li key={i.id} className="border-t border-rule">
                      <a href={`#plan-${i.id}`} className="grid grid-cols-[7em_1fr_auto] items-baseline gap-4 px-6 py-3 text-sm hover:bg-paper">
                        <span className={overdue ? "font-bold text-pen" : "text-ink-soft"}>
                          {formatYmd(i.date)}
                          {overdue && (
                            <span className="flex items-center gap-1 text-xs font-normal">
                              <Icon name="error" size={14} />
                              期限を過ぎています
                            </span>
                          )}
                        </span>
                        <span>
                          <span className="font-bold">{i.title}</span>
                          {advice.length > 0 && (
                            <span className="ml-3 inline-flex items-center gap-1 text-xs text-pen">
                              <Icon name="pen" size={14} />
                              {advice.length}件
                            </span>
                          )}
                        </span>
                        <span className="tag">{i.department}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section data-tour="plan-timeline" className="page">
            {[...byMonth.entries()].map(([month, monthItems]) => (
              <div key={month} className="grid border-t border-rule first:border-t-0 md:grid-cols-[120px_1fr]">
                <h3 className="px-6 pt-4 text-sm font-bold text-pencil md:border-r md:border-rule md:py-6">
                  {Number(month.slice(0, 4))}年
                  <span className="ml-1 text-xl text-ink md:ml-0 md:block">{Number(month.slice(5, 7))}月</span>
                </h3>
                <ul>
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

// 記録は先輩の赤ペン。提案はエージェントの鉛筆で、先輩が確かめると赤ペンになる
function noteStyle(a: Advice): { className: string; label: string; icon: IconName } {
  if (a.kind === "record") return { className: "note-pen", label: "先輩の記録（去年まで）", icon: "pen" };
  if (a.status === "confirmed") return { className: "note-pen", label: `先輩が確かめた提案${a.confirmedBy ? `（${a.confirmedBy}）` : ""}`, icon: "pen" };
  return { className: "note-pencil", label: "エージェントの提案（先輩の確認待ち）", icon: "agent" };
}

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
    <li id={`plan-${item.id}`} data-tour={tourAdvice ? "plan-item" : undefined} className="scroll-mt-8 space-y-4 border-t border-rule px-6 py-6 first:border-t-0">
      <div className="flex items-start gap-4">
        <input
          type="checkbox"
          checked={item.done}
          disabled={saving}
          onChange={(e) => patch({ done: e.target.checked })}
          className="mt-1 h-5 w-5 shrink-0 accent-ink"
          aria-label={`${item.title}を終わったことにする`}
        />
        <div className={`min-w-0 flex-1 space-y-2 ${item.done ? "text-pencil" : ""}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={`text-sm font-bold ${overdue ? "text-pen" : "text-ink-soft"}`}>{formatYmd(item.date)}</span>
            <span className="tag">{item.department}</span>
            {item.origin === "added" && <span className="tag">自分たちで足した項目</span>}
            {item.done && <span className="text-xs">終わった</span>}
          </div>
          <h4 className={`text-base font-bold leading-snug ${item.done ? "line-through" : ""}`}>{item.title}</h4>
          {item.detail && <p className="max-w-[40em] text-sm text-ink-soft">{item.detail}</p>}
          {item.originalDate && item.originalDate !== item.date && (
            <p className="text-xs text-pencil">
              最初の予定{formatYmd(item.originalDate)}から変えました{item.dateChangeReason && `。理由: ${item.dateChangeReason}`}
            </p>
          )}
          {item.memo && mode !== "memo" && (
            <p className="max-w-[40em] border-l-2 border-ink pl-4 text-sm">
              <span className="block text-xs font-bold text-pencil">ふりかえり</span>
              {item.memo}
            </p>
          )}
        </div>
      </div>

      {sorted.length > 0 && (
        <div data-tour={tourAdvice ? "advice" : undefined} className="ml-9 max-w-[40em] space-y-4">
          {sorted.map((a) => {
            const style = noteStyle(a);
            const adviceCards = a.cardIds.map((id) => cardById.get(id)).filter((c): c is Card => !!c);
            return (
              <div key={a.id} className={style.className}>
                <span className="note-label">
                  <Icon name={style.icon} size={16} />
                  {style.label}
                </span>
                <p>{a.text}</p>
                <div className="mt-1 font-sans">
                  <CitedCards cards={adviceCards} sourceById={sourceById} label={`根拠の知識カード（${adviceCards.length}枚）を見る`} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="ml-9 space-y-3">
        <CitedCards cards={cards} sourceById={sourceById} label={`元にした知識カード（${cards.length}枚）と元の投稿を見る`} />

        {mode === "date" && (
          <div className="max-w-[40em] space-y-3 rounded-[8px] bg-paper p-4">
            <label className="flex flex-wrap items-center gap-3 text-sm">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field w-auto" />
              <span className="text-ink-soft">に変える</span>
            </label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="変える理由（次の代の知識になります）" className="field" />
            <div className="flex gap-3">
              <button
                disabled={saving || !reason.trim() || date === item.date}
                onClick={() => patch({ date, dateChangeReason: reason.trim() })}
                className="btn btn-ink"
              >
                日付を変える
              </button>
              <button onClick={() => setMode("view")} className="btn-text">
                やめる
              </button>
            </div>
          </div>
        )}
        {mode === "memo" && (
          <div className="max-w-[40em] space-y-3 rounded-[8px] bg-paper p-4">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              placeholder="やってみてどうだったか（次の代の知識になります）"
              className="field"
            />
            <div className="flex gap-3">
              <button disabled={saving} onClick={() => patch({ memo: memo.trim() || null })} className="btn btn-ink">
                ふりかえりを残す
              </button>
              <button onClick={() => setMode("view")} className="btn-text">
                やめる
              </button>
            </div>
          </div>
        )}
        {mode === "delete" && (
          <div className="flex max-w-[40em] flex-wrap items-center gap-3 rounded-[8px] bg-pen-wash p-4 text-sm">
            <span className="text-pen">この項目を計画から消しますか？</span>
            <button disabled={saving} onClick={remove} className="btn btn-pen">
              消す
            </button>
            <button onClick={() => setMode("view")} className="btn-text">
              やめる
            </button>
          </div>
        )}
        {mode === "view" && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <button onClick={() => setMode("date")} className="btn-text">
              <Icon name="editDate" size={16} />
              日付を変える
            </button>
            <button onClick={() => setMode("memo")} className="btn-text">
              <Icon name="editNote" size={16} />
              {item.memo ? "ふりかえりを直す" : "ふりかえりを書く"}
            </button>
            <button onClick={() => setMode("delete")} className="btn-text">
              <Icon name="delete" size={16} />
              消す
            </button>
            {item.updatedBy && <span className="text-xs text-pencil md:ml-auto">最後に直した人: {item.updatedBy}</span>}
          </div>
        )}
        {error && <p className="text-sm text-pen">{error}</p>}
      </div>
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
      <button onClick={() => setOpen(true)} className="btn btn-line w-full border-dashed py-3">
        <Icon name="add" size={20} />
        去年にはなかった仕事を計画に足す
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="page space-y-4 p-6">
      <h3 className="font-bold">計画に項目を足す</h3>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="やること" className="field" />
      <div className="flex flex-wrap gap-3">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field w-auto" />
        <select value={department} onChange={(e) => setDepartment(e.target.value as PlanDepartment)} className="field w-auto">
          {PLAN_DEPARTMENTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>
      <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="何をするか（なくてもよい）" className="field" />
      {error && <p className="text-sm text-pen">{error}</p>}
      <div className="flex gap-3">
        <button disabled={saving || !title.trim()} className="btn btn-ink">
          計画に足す
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-text">
          やめる
        </button>
      </div>
    </form>
  );
}
