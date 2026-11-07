"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, CardView, formatDate, SourceView, Spinner } from "@/components/ui";
import type { Card, Question, SenpaiQuestion, Source } from "@/lib/types";

const EXAMPLES = ["教室使用申請はいつまでに、どうやって出せばいいですか？", "備品貸出の締切はいつで、なぜその日なんですか？", "本番の日に雨が降ったら、屋外の企画は体育館に移せますか？"];

export default function KouhaiPage() {
  const [text, setText] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [senpaiQuestions, setSenpaiQuestions] = useState<SenpaiQuestion[]>([]);
  const [showCards, setShowCards] = useState(false);

  const reload = useCallback(async () => {
    const [q, c, s, sq] = await Promise.all([
      api<{ questions: Question[] }>("/api/questions"),
      api<{ cards: Card[] }>("/api/cards"),
      api<{ sources: Source[] }>("/api/sources"),
      api<{ senpaiQuestions: SenpaiQuestion[] }>("/api/senpai-questions"),
    ]);
    setQuestions(q.questions);
    setCards(c.cards.filter((x) => x.status === "confirmed"));
    setSources(s.sources);
    setSenpaiQuestions(sq.senpaiQuestions);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function ask(question: string) {
    setAsking(true);
    setError("");
    try {
      await api("/api/questions", { method: "POST", body: JSON.stringify({ text: question }) });
      setText("");
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setAsking(false);
    }
  }

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);
  const senpaiById = useMemo(() => new Map(senpaiQuestions.map((s) => [s.id, s])), [senpaiQuestions]);

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <div>
          <h1 className="font-bold">後輩の画面</h1>
          <p className="text-sm text-stone-500">去年の先輩の知識（何を・いつ・なぜ）を1つずつまとめた「知識カード」から、元の投稿を示して答えます。記録にないことは、先輩への質問にまとめます。</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() && !asking) ask(text.trim());
          }}
          data-tour="ask"
          className="flex gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="去年はどうしていましたか？"
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2"
          />
          <button disabled={asking || !text.trim()} className="rounded-lg bg-stone-900 px-5 font-medium text-white disabled:opacity-40">
            聞く
          </button>
        </form>
        <div data-tour="examples" className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setText(ex)} className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600 hover:bg-stone-200">
              {ex}
            </button>
          ))}
        </div>
        {asking && <Spinner label="知識カードを探しています…" />}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>

      <ul data-tour="answers" className="space-y-4">
        {questions.length === 0 && <li className="rounded-xl border border-dashed border-stone-300 p-4 text-sm text-stone-500">ここに回答が出ます</li>}
        {questions.map((q) => (
          <QuestionItem key={q.id} q={q} cardById={cardById} sourceById={sourceById} senpai={q.senpaiQuestionId ? senpaiById.get(q.senpaiQuestionId) : undefined} />
        ))}
      </ul>

      <section className="space-y-3">
        <button data-tour="cards" onClick={() => setShowCards((v) => !v)} className="text-sm font-medium text-stone-600 underline">
          確認済みの知識カードを見る（{cards.length}枚）
        </button>
        {showCards && (
          <div className="grid gap-3 md:grid-cols-2">
            {cards.map((c) => (
              <div key={c.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <CardView card={c} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function QuestionItem({
  q,
  cardById,
  sourceById,
  senpai,
}: {
  q: Question;
  cardById: Map<string, Card>;
  sourceById: Map<string, Source>;
  senpai?: SenpaiQuestion;
}) {
  const cited = q.citedCardIds.map((id) => cardById.get(id)).filter((c): c is Card => !!c);
  const waiting = q.status === "gap" && senpai?.status === "open";
  return (
    <li className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="font-bold">Q. {q.text}</div>
        <span className="shrink-0 text-xs text-stone-400">{formatDate(q.createdAt)}</span>
      </div>
      {q.answer && <div className="whitespace-pre-wrap leading-relaxed">{q.answer}</div>}
      {waiting && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <div className="font-medium text-amber-900">記録にないので、前の代の先輩に聞いています</div>
          <div className="mt-1 text-amber-800">先輩への質問: 「{senpai.text}」</div>
          {senpai.questionIds.length > 1 && <div className="mt-1 text-xs text-amber-700">同じことを聞いた人がほかに{senpai.questionIds.length - 1}人います</div>}
        </div>
      )}
      {q.status === "answered" && senpai?.status === "answered" && <div className="text-xs font-medium text-green-700">先輩が答えてくれました（知識カードにもなりました）</div>}
      {cited.length > 0 && (
        <details className="space-y-2">
          <summary className="cursor-pointer text-sm font-medium text-stone-600">根拠の知識カード（{cited.length}枚）と元の投稿</summary>
          <div className="mt-2 space-y-3">
            {cited.map((c) => (
              <div key={c.id} className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <CardView card={c} />
                {c.sourceIds.map((sid) => {
                  const s = sourceById.get(sid);
                  return s ? <SourceView key={sid} source={s} /> : null;
                })}
              </div>
            ))}
          </div>
        </details>
      )}
    </li>
  );
}
