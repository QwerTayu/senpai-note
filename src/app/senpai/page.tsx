"use client";
import { useCallback, useEffect, useState } from "react";
import { api, CardView, formatDate, SourceView, Spinner } from "@/components/ui";
import type { Card, CardMessage, Question, SenpaiQuestion, Source } from "@/lib/types";

type Tab = "draft" | "confirmed" | "questions";

interface CardDetail {
  card: Card;
  sources: Source[];
  messages: CardMessage[];
  answers: SenpaiQuestion[];
}

export default function SenpaiPage() {
  const [tab, setTab] = useState<Tab>("draft");
  const [cards, setCards] = useState<Card[]>([]);
  const [senpaiQuestions, setSenpaiQuestions] = useState<SenpaiQuestion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestMessage, setIngestMessage] = useState("");

  const reload = useCallback(async () => {
    const [c, s] = await Promise.all([
      api<{ cards: Card[] }>("/api/cards"),
      api<{ senpaiQuestions: SenpaiQuestion[] }>("/api/senpai-questions"),
    ]);
    setCards(c.cards);
    setSenpaiQuestions(s.senpaiQuestions);
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

  const drafts = cards.filter((c) => c.status === "draft");
  const confirmed = cards.filter((c) => c.status === "confirmed");
  const openQuestions = senpaiQuestions.filter((q) => q.status === "open");
  const list = tab === "draft" ? drafts : confirmed;

  useEffect(() => {
    if (tab !== "questions" && list.length > 0 && !list.some((c) => c.id === selectedId)) setSelectedId(list[0].id);
  }, [tab, list, selectedId]);

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4">
        <div>
          <h1 className="font-bold">先輩の画面</h1>
          <p className="text-sm text-stone-500">ふだんのやりとりから、エージェントが知識を1つずつ「知識カード」にまとめます。先輩は ✅ を押すか、話して直すだけ。</p>
        </div>
        <div className="flex items-center gap-3">
          {ingesting ? <Spinner label="Slack・Drive・Notion を読んで知識カードを作っています…" /> : ingestMessage && <span className="text-sm text-stone-600">{ingestMessage}</span>}
          <button data-tour="ingest" onClick={ingest} disabled={ingesting} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
            新しいやりとりを取り込む
          </button>
        </div>
      </section>

      <div data-tour="tabs" className="flex gap-2 text-sm">
        <TabButton active={tab === "draft"} onClick={() => setTab("draft")} label="確認待ち" count={drafts.length} />
        <TabButton active={tab === "confirmed"} onClick={() => setTab("confirmed")} label="確認済み" count={confirmed.length} />
        <span data-tour="questions-tab">
          <TabButton active={tab === "questions"} onClick={() => setTab("questions")} label="後輩からの質問" count={openQuestions.length} highlight />
        </span>
      </div>

      {tab === "questions" ? (
        <SenpaiQuestionList items={senpaiQuestions} onAnswered={reload} />
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <ul data-tour="card-list" className="space-y-2">
            {list.length === 0 && <li className="text-sm text-stone-500">知識カードはありません</li>}
            {list.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${selectedId === c.id ? "border-stone-900 bg-white" : "border-stone-200 bg-white hover:border-stone-400"}`}
                >
                  <div className="text-sm font-medium leading-snug">{c.title}</div>
                  <div className="mt-1 flex gap-2 text-xs text-stone-500">
                    {c.when && <span>🗓 {c.when}</span>}
                    {!c.why && <span className="text-amber-700">理由が不明</span>}
                    {c.answerIds.length > 0 && <span>先輩の回答から</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div>{selectedId ? <CardPanel key={selectedId} cardId={selectedId} onChanged={reload} /> : <p className="text-sm text-stone-500">左の知識カードを選んでください</p>}</div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label, count, highlight }: { active: boolean; onClick: () => void; label: string; count: number; highlight?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium ${active ? "bg-stone-900 text-white" : "bg-white text-stone-600 hover:text-stone-900"}`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-xs ${highlight && count > 0 ? "bg-red-500 text-white" : active ? "bg-white/20" : "bg-stone-100"}`}>{count}</span>
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

  if (!detail) return <Spinner label="読み込み中…" />;
  const { card, sources, messages, answers } = detail;

  return (
    <div data-tour="card-panel" className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
      <CardView card={card} />
      {card.status === "draft" && (
        <button onClick={confirm} className="w-full rounded-lg bg-green-600 py-2 text-sm font-bold text-white hover:bg-green-700">
          ✅ これで正しい
        </button>
      )}

      <details open className="space-y-2">
        <summary className="cursor-pointer text-sm font-medium text-stone-600">根拠（{sources.length + answers.length}件）</summary>
        <div className="mt-2 space-y-2">
          {sources.map((s) => (
            <SourceView key={s.id} source={s} />
          ))}
          {answers.map((a) => (
            <div key={a.id} className="rounded-lg border border-stone-200 p-3 text-sm">
              <div className="mb-1 text-xs text-stone-500">先輩への質問への回答 {a.answeredAt && formatDate(a.answeredAt)}</div>
              <div className="font-medium">Q. {a.text}</div>
              <div className="whitespace-pre-wrap">A. {a.answer}</div>
            </div>
          ))}
        </div>
      </details>

      <div className="space-y-2 border-t border-stone-100 pt-3">
        <div className="text-sm font-medium text-stone-600">エージェントと話して直す</div>
        {messages.map((m) => (
          <div key={m.id + m.createdAt} className={`flex ${m.role === "senpai" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "senpai" ? "bg-stone-900 text-white" : "bg-stone-100"}`}>{m.text}</div>
          </div>
        ))}
        {thinking && <Spinner label="エージェントが考えています…" />}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim() || thinking) return;
            send(text.trim());
            setText("");
          }}
          className="flex gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例: 7/10にしたのは、体育会の倉庫の棚卸しがあるから"
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <button disabled={thinking || !text.trim()} className="rounded-lg bg-stone-900 px-4 text-sm font-medium text-white disabled:opacity-40">
            送る
          </button>
        </form>
      </div>
    </div>
  );
}

function SenpaiQuestionList({ items, onAnswered }: { items: SenpaiQuestion[]; onAnswered: () => void }) {
  if (items.length === 0) return <p className="text-sm text-stone-500">後輩からの質問はまだありません。記録にないことを後輩が聞くと、ここに届きます。</p>;
  return (
    <ul className="space-y-3">
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
    <li className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="font-bold leading-snug">{q.text}</div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${q.status === "open" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800"}`}>
          {q.status === "open" ? "回答待ち" : "回答済み"}
        </span>
      </div>
      <div className="text-xs text-stone-500">
        後輩の質問 {q.questionIds.length}件をまとめました{originals.length > 0 && `: ${originals.map((o) => `「${o.text}」`).join(" ")}`}
      </div>
      {q.status === "open" ? (
        <form onSubmit={submit} className="space-y-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            placeholder="実務訓練の合間に、わかる範囲で一言。答えは知識カードになり、後輩にも届きます。"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            {sending && <Spinner label="知識カードにしています…" />}
            <button disabled={sending || !answer.trim()} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
              答える
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-lg bg-stone-50 p-3 text-sm whitespace-pre-wrap">{q.answer}</div>
      )}
    </li>
  );
}
