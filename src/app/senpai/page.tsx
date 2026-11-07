"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, CardView, formatDate, formatYmd, SourceView, Spinner } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { useProfile } from "@/components/useProfile";
import type { Advice, Card, CardMessage, PlanItem, Question, SenpaiQuestion, Source } from "@/lib/types";

type Tab = "draft" | "confirmed" | "suggestions" | "questions";

type Suggestion = Advice & { planItem: PlanItem };

interface CardDetail {
  card: Card;
  sources: Source[];
  messages: CardMessage[];
  answers: SenpaiQuestion[];
}

export default function SenpaiPage() {
  const profile = useProfile();
  const [tab, setTab] = useState<Tab>("draft");
  const [cards, setCards] = useState<Card[]>([]);
  const [senpaiQuestions, setSenpaiQuestions] = useState<SenpaiQuestion[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionGeneration, setSuggestionGeneration] = useState<number | null>(null);
  const [onlyMine, setOnlyMine] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestMessage, setIngestMessage] = useState("");

  const reload = useCallback(async () => {
    const [c, s, a] = await Promise.all([
      api<{ cards: Card[] }>("/api/cards"),
      api<{ senpaiQuestions: SenpaiQuestion[] }>("/api/senpai-questions"),
      api<{ generation: number; suggestions: Suggestion[] }>("/api/advice"),
    ]);
    setCards(c.cards);
    setSenpaiQuestions(s.senpaiQuestions);
    setSuggestions(a.suggestions);
    setSuggestionGeneration(a.generation);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function ingest() {
    setIngesting(true);
    setIngestMessage("");
    try {
      const r = await api<{ sourceCount: number; created: number; updated: number; report: string }>("/api/ingest", { method: "POST" });
      setIngestMessage(
        r.sourceCount === 0 ? "新しい投稿・資料はありません" : `${r.sourceCount}件の投稿・資料から、知識カードを${r.created}枚作り、${r.updated}枚に統合しました`,
      );
      await reload();
    } catch (e) {
      setIngestMessage(String(e));
    } finally {
      setIngesting(false);
    }
  }

  // 自分の代の知識カードを最初に出す（ほかの代のものは「すべての代」で見える）
  const visible = useMemo(
    () => (onlyMine && profile ? cards.filter((c) => c.generation === profile.generation) : cards),
    [cards, onlyMine, profile],
  );
  const drafts = visible.filter((c) => c.status === "draft");
  const confirmed = visible.filter((c) => c.status === "confirmed");
  const openQuestions = senpaiQuestions.filter((q) => q.status === "open");
  const list = useMemo(() => (tab === "draft" ? drafts : tab === "confirmed" ? confirmed : []), [tab, drafts, confirmed]);

  useEffect(() => {
    if (list.length > 0 && !list.some((c) => c.id === selectedId)) setSelectedId(list[0].id);
  }, [list, selectedId]);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-1">
          <p className="text-sm text-pencil">{profile ? `${profile.generation}年度の代` : "前の代"}の先輩の画面</p>
          <h1 className="text-2xl font-bold leading-snug">確かめて、一言答えるだけ</h1>
          <p className="hidden max-w-[40em] text-sm text-ink-soft sm:block">
            ふだんのやりとりから、エージェントが知識を1つずつ「知識カード」にまとめます。正しければ確認済みにし、違えばエージェントと話して直します。現役の代の計画に付いた提案と、記録にない質問も、ここに届きます。
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button data-tour="ingest" onClick={ingest} disabled={ingesting} className="btn btn-ink">
            <Icon name="ingest" />
            新しいやりとりを取り込む
          </button>
          {ingesting ? <Spinner label="Slack・Drive・Notion を読んで知識カードを作っています" /> : ingestMessage && <p className="text-sm text-ink-soft">{ingestMessage}</p>}
        </div>
      </section>

      <div data-tour="tabs" role="tablist" className="flex flex-wrap gap-x-6 border-b border-rule">
        <TabButton active={tab === "draft"} onClick={() => setTab("draft")} label="確認待ち" count={drafts.length} icon="inbox" />
        <TabButton active={tab === "confirmed"} onClick={() => setTab("confirmed")} label="確認済み" count={confirmed.length} icon="checkCircle" />
        <span data-tour="suggestions-tab">
          <TabButton active={tab === "suggestions"} onClick={() => setTab("suggestions")} label="エージェントの提案" count={suggestions.length} icon="agent" alert />
        </span>
        <span data-tour="questions-tab">
          <TabButton active={tab === "questions"} onClick={() => setTab("questions")} label="後輩からの質問" count={openQuestions.length} icon="question" alert />
        </span>
      </div>

      {tab === "questions" ? (
        <SenpaiQuestionList items={senpaiQuestions} onAnswered={reload} />
      ) : tab === "suggestions" ? (
        <SuggestionList items={suggestions} generation={suggestionGeneration} cards={cards} onChanged={reload} />
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div data-tour="card-list" className="page">
            <div role="group" aria-label="代で絞り込む" className="flex gap-4 border-b border-rule px-4 py-3 text-sm">
              <button onClick={() => setOnlyMine(true)} aria-pressed={onlyMine} className={onlyMine ? "font-bold" : "btn-text"}>
                自分の代{profile && `（${profile.generation}年度）`}
              </button>
              <button onClick={() => setOnlyMine(false)} aria-pressed={!onlyMine} className={!onlyMine ? "font-bold" : "btn-text"}>
                すべての代
              </button>
            </div>
            <ul>
              {list.length === 0 && <li className="p-4 text-sm text-pencil">知識カードはありません</li>}
              {list.map((c) => (
                <li key={c.id} className="border-t border-rule first:border-t-0">
                  <button
                    onClick={() => setSelectedId(c.id)}
                    aria-current={selectedId === c.id}
                    className={`w-full border-l-4 px-4 py-3 text-left ${selectedId === c.id ? "border-l-ink bg-paper" : "border-l-transparent hover:bg-paper"}`}
                  >
                    <span className="block text-sm font-bold leading-snug">{c.title}</span>
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-pencil">
                      {!onlyMine && <span>{c.generation}年度の代</span>}
                      {c.when && <span>{c.when}</span>}
                      {!c.why && <span className="text-pen">理由が不明</span>}
                      {c.answerIds.length > 0 && <span>先輩の回答から</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>{selectedId ? <CardPanel key={selectedId} cardId={selectedId} onChanged={reload} /> : <p className="text-sm text-pencil">左の知識カードを選んでください</p>}</div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  icon,
  alert,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon: IconName;
  alert?: boolean;
}) {
  return (
    <button role="tab" aria-selected={active} onClick={onClick} className="tab -mb-px">
      <Icon name={icon} size={20} />
      {label}
      <span className={alert && count > 0 ? "count-alert" : "count"}>{count}</span>
    </button>
  );
}

function CardPanel({ cardId, onChanged }: { cardId: string; onChanged: () => void }) {
  const [detail, setDetail] = useState<CardDetail | null>(null);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const d = await api<CardDetail>(`/api/cards/${cardId}`);
    setDetail(d);
    return d;
  }, [cardId]);

  const send = useCallback(
    async (message: string | null) => {
      setThinking(true);
      setError("");
      if (message) {
        setDetail((d) => d && { ...d, messages: [...d.messages, { id: "pending", role: "senpai", text: message, createdAt: new Date().toISOString() }] });
      }
      try {
        await api(`/api/cards/${cardId}/chat`, { method: "POST", body: JSON.stringify({ text: message }) });
        await load();
        onChanged();
      } catch (e) {
        setError(String(e));
      } finally {
        setThinking(false);
      }
    },
    [cardId, load, onChanged],
  );

  useEffect(() => {
    // 理由がわからない知識カードを開いたら、エージェントが先に理由を尋ねる
    load().then((d) => {
      if (d.card.status === "draft" && !d.card.why && d.messages.length === 0) send(null);
    });
  }, [load, send]);

  async function confirm() {
    await api(`/api/cards/${cardId}/confirm`, { method: "POST" });
    await load();
    onChanged();
  }

  if (!detail) return <Spinner label="読み込み中" />;
  const { card, sources, messages, answers } = detail;

  return (
    <div data-tour="card-panel" className="page">
      <div className="space-y-4 p-6">
        <CardView card={card} />
        {card.status === "draft" && (
          <button onClick={confirm} className="btn btn-pen w-full py-3">
            <Icon name="check" size={20} />
            正しいので確認済みにする
          </button>
        )}
      </div>

      <details open className="group border-t border-rule px-6 py-4">
        <summary className="cursor-pointer list-none text-sm font-bold text-ink-soft">
          根拠（{sources.length + answers.length}件）
          <span className="ml-2 text-xs font-normal text-pencil group-open:hidden">開く</span>
        </summary>
        <div className="mt-3 space-y-3">
          {sources.map((s) => (
            <SourceView key={s.id} source={s} />
          ))}
          {answers.map((a) => (
            <div key={a.id} className="border-l-2 border-rule py-1 pl-4 text-sm">
              <p className="mb-1 text-xs text-pencil">
                先輩への質問への回答 {a.answeredBy && `${a.answeredBy}、`}
                {a.answeredAt && formatDate(a.answeredAt)}
              </p>
              <p className="font-bold">{a.text}</p>
              <p className="whitespace-pre-wrap">{a.answer}</p>
            </div>
          ))}
        </div>
      </details>

      <div className="space-y-3 border-t border-rule px-6 py-4">
        <h4 className="flex items-center gap-2 text-sm font-bold text-ink-soft">
          <Icon name="agent" />
          エージェントと話して直す
        </h4>
        {messages.map((m) => (
          <div key={m.id + m.createdAt} className={`flex ${m.role === "senpai" ? "justify-end" : "justify-start"}`}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-[8px] px-4 py-2 text-sm ${m.role === "senpai" ? "bg-ink text-sheet" : "bg-paper text-ink"}`}
            >
              {m.text}
            </p>
          </div>
        ))}
        {thinking && <Spinner label="エージェントが考えています" />}
        {error && <p className="text-sm text-pen">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim() || thinking) return;
            send(text.trim());
            setText("");
          }}
          className="flex gap-3"
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="例: 7/10にしたのは、体育会の倉庫の棚卸しがあるから" className="field flex-1 text-sm" />
          <button disabled={thinking || !text.trim()} className="btn btn-ink">
            送る
          </button>
        </form>
      </div>
    </div>
  );
}

function SenpaiQuestionList({ items, onAnswered }: { items: SenpaiQuestion[]; onAnswered: () => void }) {
  if (items.length === 0) return <p className="text-sm text-pencil">後輩からの質問はまだありません。記録にないことを後輩が聞くと、ここに届きます。</p>;
  return (
    <ul className="page">
      {items.map((q) => (
        <SenpaiQuestionItem key={q.id} q={q} onAnswered={onAnswered} />
      ))}
    </ul>
  );
}

function SenpaiQuestionItem({ q, onAnswered }: { q: SenpaiQuestion; onAnswered: () => void }) {
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [originals, setOriginals] = useState<Question[]>([]);

  useEffect(() => {
    api<{ questions: Question[] }>("/api/questions").then((r) => setOriginals(r.questions.filter((x) => q.questionIds.includes(x.id))));
  }, [q.questionIds]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await api(`/api/senpai-questions/${q.id}/answer`, { method: "POST", body: JSON.stringify({ answer }) });
      onAnswered();
    } catch (err) {
      setError(String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <li className="space-y-4 border-t border-rule p-6 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h3 className="font-bold leading-snug">{q.text}</h3>
        <span className={`tag ${q.status === "open" ? "tag-pen" : ""}`}>{q.status === "open" ? "回答待ち" : "回答済み"}</span>
      </div>
      <p className="text-xs text-pencil">
        後輩の質問{q.questionIds.length}件をまとめました{originals.length > 0 && `: ${originals.map((o) => `「${o.text}」`).join(" ")}`}
      </p>
      {q.status === "open" ? (
        <form onSubmit={submit} className="space-y-3">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            placeholder="実務訓練の合間に、わかる範囲で一言。答えは知識カードになり、質問した人にも届きます。"
            className="field text-sm"
          />
          {error && <p className="text-sm text-pen">{error}</p>}
          <div className="flex items-center justify-end gap-4">
            {sending && <Spinner label="知識カードにしています" />}
            <button disabled={sending || !answer.trim()} className="btn btn-ink">
              答える
            </button>
          </div>
        </form>
      ) : (
        <div className="note-pen">
          {q.answeredBy && (
            <span className="note-label">
              <Icon name="pen" size={16} />
              {q.answeredBy}の回答
            </span>
          )}
          <p className="whitespace-pre-wrap">{q.answer}</p>
        </div>
      )}
    </li>
  );
}

function SuggestionList({ items, generation, cards, onChanged }: { items: Suggestion[]; generation: number | null; cards: Card[]; onChanged: () => void }) {
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  if (items.length === 0) {
    return <p className="text-sm text-pencil">確認待ちの提案はありません。現役の代（{generation}年度）が計画を作ると、エージェントの提案がここに届きます。</p>;
  }
  return (
    <div className="space-y-4">
      <p className="max-w-[40em] text-sm text-ink-soft">
        {generation}年度の代の計画に、エージェントが鉛筆で書いた提案です。経験から見て正しければ、赤ペンでなぞるように確かめてください。現役の画面で「先輩が確かめた提案」になります。
      </p>
      <ul className="page">
        {items.map((s) => (
          <SuggestionItem key={s.id} s={s} cards={s.cardIds.map((id) => cardById.get(id)).filter((c): c is Card => !!c)} onChanged={onChanged} />
        ))}
      </ul>
    </div>
  );
}

function SuggestionItem({ s, cards, onChanged }: { s: Suggestion; cards: Card[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function act(method: "POST" | "DELETE") {
    setBusy(true);
    setError("");
    try {
      await api(`/api/advice/${s.id}`, { method });
      onChanged();
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }
  return (
    <li className="space-y-4 border-t border-rule p-6 first:border-t-0">
      <p className="text-sm">
        <span className="font-bold text-ink-soft">{formatYmd(s.planItem.date)}</span>
        <span className="ml-3 font-bold">{s.planItem.title}</span>
        <span className="tag ml-3">{s.planItem.department}</span>
      </p>
      <div className="note-pencil max-w-[40em]">
        <span className="note-label">
          <Icon name="agent" size={16} />
          エージェントの提案
        </span>
        <p>{s.text}</p>
      </div>
      {cards.length > 0 && <p className="text-xs text-pencil">根拠: {cards.map((c) => `「${c.title}」（${c.generation}年度）`).join(" ")}</p>}
      {error && <p className="text-sm text-pen">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button disabled={busy} onClick={() => act("POST")} className="btn btn-pen">
          <Icon name="check" />
          この提案でよい
        </button>
        <button disabled={busy} onClick={() => act("DELETE")} className="btn btn-line">
          <Icon name="close" />
          却下する
        </button>
      </div>
    </li>
  );
}
