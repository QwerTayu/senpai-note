"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CitedCards } from "@/components/CitedCards";
import { Icon } from "@/components/Icon";
import { api, CardView, formatDate, Spinner } from "@/components/ui";
import type { Card, Question, SenpaiQuestion, Source } from "@/lib/types";

const EXAMPLES = ["教室使用申請はいつまでに、どうやって出せばいいですか？", "備品貸出の締切はいつで、なぜその日なんですか？", "局内で飲み会を開く時の幹事の仕事と手順は？"];

export function AskTab({ cards, sourceById }: { cards: Card[]; sourceById: Map<string, Source> }) {
  const [text, setText] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [senpaiQuestions, setSenpaiQuestions] = useState<SenpaiQuestion[]>([]);
  const [showCards, setShowCards] = useState(true);

  const reload = useCallback(async () => {
    const [q, sq] = await Promise.all([
      api<{ questions: Question[] }>("/api/questions"),
      api<{ senpaiQuestions: SenpaiQuestion[] }>("/api/senpai-questions"),
    ]);
    setQuestions(q.questions);
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
  const senpaiById = useMemo(() => new Map(senpaiQuestions.map((s) => [s.id, s])), [senpaiQuestions]);

  return (
    <div className="space-y-8">
      <section className="page space-y-4 p-6">
        <p className="max-w-[40em] text-sm text-ink-soft">
          昨年までの先輩の知識（何を・いつ・なぜ）を1つずつまとめた「知識カード」から、元の投稿を示して答えます。記録にないことは、先輩への質問にまとめます。
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() && !asking) ask(text.trim());
          }}
          data-tour="ask"
          className="flex gap-3"
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="昨年はどうしていましたか？" className="field flex-1" />
          <button disabled={asking || !text.trim()} className="btn btn-ink">
            聞く
          </button>
        </form>
        <div data-tour="examples" className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <span className="text-xs text-pencil">質問の例</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setText(ex)} className="btn-text text-left">
              {ex}
            </button>
          ))}
        </div>
        {asking && <Spinner label="知識カードを探しています" />}
        {error && <p className="text-sm text-pen">{error}</p>}
      </section>

      <ul data-tour="answers" className="page">
        {questions.length === 0 && <li className="p-6 text-sm text-pencil">質問すると、ここに回答が出ます。</li>}
        {questions.map((q) => (
          <QuestionItem
            key={q.id}
            q={q}
            cited={q.citedCardIds.map((id) => cardById.get(id)).filter((c): c is Card => !!c)}
            sourceById={sourceById}
            senpai={q.senpaiQuestionId ? senpaiById.get(q.senpaiQuestionId) : undefined}
          />
        ))}
      </ul>

      <section className="space-y-4">
        <button data-tour="cards" onClick={() => setShowCards((v) => !v)} aria-expanded={showCards} className="btn-text">
          {showCards ? "知識カードを閉じる" : `確認済みの知識カードを見る（${cards.length}枚）`}
        </button>
        {showCards && (
          <div className="grid gap-4 md:grid-cols-2">
            {cards.map((c) => (
              <div key={c.id} className="page p-6">
                <CardView card={c} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function QuestionItem({ q, cited, sourceById, senpai }: { q: Question; cited: Card[]; sourceById: Map<string, Source>; senpai?: SenpaiQuestion }) {
  const waiting = q.status === "gap" && senpai?.status === "open";
  return (
    <li className="space-y-4 border-t border-rule p-6 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-bold">{q.text}</h3>
        <span className="text-xs text-pencil">
          {q.askedBy && `${q.askedBy}・`}
          {formatDate(q.createdAt)}
        </span>
      </div>
      {q.answer && <div className="max-w-[40em] whitespace-pre-wrap">{q.answer}</div>}
      {waiting && (
        <div className="note-pencil max-w-[40em]">
          <span className="note-label">
            <Icon name="question" size={16} />
            記録にないので、前の代の先輩に聞いています
          </span>
          <p>{senpai.text}</p>
          {senpai.questionIds.length > 1 && <p className="font-sans text-xs">同じことを聞いた人がほかに{senpai.questionIds.length - 1}人います</p>}
        </div>
      )}
      {q.status === "answered" && senpai?.status === "answered" && (
        <p className="flex items-center gap-1 text-xs font-bold text-pen">
          <Icon name="pen" size={16} />
          {senpai.answeredBy ?? "先輩"}が答えました。この答えは知識カードにもなりました。
        </p>
      )}
      <CitedCards cards={cited} sourceById={sourceById} />
    </li>
  );
}
