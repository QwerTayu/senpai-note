"use client";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

// 画面の要素を1つずつ明るくして説明するツアー。
// 要素には data-tour="..." を付ける。見つからない手順は飛ばす。

interface Step {
  target: string;
  title: string;
  body: string;
}

const TOURS: Record<string, Step[]> = {
  "/senpai": [
    {
      target: "role-switch",
      title: "ここで役を切り替えます",
      body: "前の代の先輩（B4）と、新しい代の後輩を切り替えます。今は先輩の画面です。ログインはありません。",
    },
    {
      target: "ingest",
      title: "1. ためる",
      body: "Slack・Drive・Notion のふだんのやりとりを、エージェントが読んで「カード」にします。何を、いつ、なぜそう決めたかを1枚ずつまとめます。",
    },
    {
      target: "tabs",
      title: "2. 確かめる",
      body: "できたばかりのカードは「確認待ち」に入ります。先輩が確かめたカードだけが「確認済み」になり、後輩への回答に使われます。",
    },
    {
      target: "card-list",
      title: "カードを選ぶ",
      body: "カードを選ぶと右に中身が出ます。「理由が不明」と出ているカードは、根拠の投稿に理由が書かれていなかったものです。",
    },
    {
      target: "card-panel",
      title: "✅ を押すか、話して直すだけ",
      body: "正しければ ✅。理由が不明なカードでは、エージェントが先に理由を尋ねます。一言答えれば、カードが直ります。根拠の元の投稿もここで見られます。",
    },
    {
      target: "questions-tab",
      title: "4. 抜けだけ聞く",
      body: "カードで答えられなかった後輩の質問は、似たものをまとめて「後輩からの質問」に届きます。先輩が答えると、その答えがカードになり、後輩にも届きます。",
    },
  ],
  "/kouhai": [
    {
      target: "role-switch",
      title: "ここで役を切り替えます",
      body: "今は新しい代（後輩）の画面です。先輩の画面に切り替えると、カードの確認や先輩への質問への回答ができます。",
    },
    {
      target: "ask",
      title: "3. 答える",
      body: "「去年はどうしていましたか？」と聞くように質問します。先輩が確認したカードだけを根拠に、エージェントが答えます。",
    },
    {
      target: "examples",
      title: "質問の例",
      body: "押すと質問欄に入ります。3つ目の「雨の日」は記録にないので、先輩への質問になります。",
    },
    {
      target: "answers",
      title: "根拠つきの回答",
      body: "回答の下の「根拠のカード」を開くと、元の Slack の投稿や資料まで確かめられます。記録にないことは「先輩に聞いています」と出て、先輩が答えるとここに届きます。",
    },
    {
      target: "cards",
      title: "カードを読む",
      body: "確認済みのカードは、質問しなくても一覧で読めます。",
    },
  ],
};

const SEEN_KEY = (path: string) => `senpai-note:tour-seen:${path}`;
const PAD = 8;

export function startTour() {
  window.dispatchEvent(new Event("senpai-note:start-tour"));
}

export function TourButton() {
  const pathname = usePathname();
  if (!TOURS[pathname]) return null;
  return (
    <button onClick={startTour} className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100">
      ？ 使い方
    </button>
  );
}

export function Tour() {
  const pathname = usePathname();
  const all = TOURS[pathname];
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const start = useCallback(() => {
    if (!all) return;
    const available = all.filter((s) => document.querySelector(`[data-tour="${s.target}"]`));
    if (available.length === 0) return;
    setSteps(available);
    setIndex(0);
  }, [all]);

  const finish = useCallback(() => {
    setSteps(null);
    setRect(null);
    try {
      localStorage.setItem(SEEN_KEY(pathname), "1");
    } catch {}
  }, [pathname]);

  // 初めて開いたときは自動で始める（データの読み込みを少し待つ）
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY(pathname)) === "1";
    } catch {}
    const timer = seen ? undefined : setTimeout(start, 1200);
    window.addEventListener("senpai-note:start-tour", start);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("senpai-note:start-tour", start);
    };
  }, [pathname, start]);

  const step = steps?.[index];

  useLayoutEffect(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const update = () => setRect(el.getBoundingClientRect());
    update();
    const timer = setInterval(update, 200); // スクロール中と、中身が読み込まれて大きさが変わるときに追う
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step]);

  useEffect(() => {
    if (!steps) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps, finish]);

  if (!steps || !step || !rect) return null;

  const isLast = index === steps.length - 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(360, vw - 32);
  const below = rect.bottom + 180 < vh || rect.top < 200;
  const top = below ? Math.min(rect.bottom + PAD + 12, vh - 200) : Math.max(rect.top - PAD - 12, 16);
  const left = Math.min(Math.max(rect.left, 16), vw - width - 16);

  return (
    <div className="fixed inset-0 z-50" onClick={finish}>
      {/* 明るく見せる枠。外側を大きな影で暗くする */}
      <div
        className="pointer-events-none fixed rounded-xl ring-2 ring-white transition-all duration-300"
        style={{
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
          boxShadow: "0 0 0 9999px rgba(20, 20, 20, 0.6)",
        }}
      />
      <div
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        className="fixed space-y-3 rounded-xl bg-white p-4 shadow-2xl transition-all duration-300"
        style={{ top, left, width, transform: below ? undefined : "translateY(-100%)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="font-bold">{step.title}</div>
          <span className="shrink-0 text-xs text-stone-400">
            {index + 1} / {steps.length}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-stone-700">{step.body}</p>
        <div className="flex items-center justify-between">
          <button onClick={finish} className="text-sm text-stone-500 hover:text-stone-800">
            スキップ
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button onClick={() => setIndex(index - 1)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm">
                戻る
              </button>
            )}
            <button
              onClick={() => (isLast ? finish() : setIndex(index + 1))}
              className="rounded-lg bg-stone-900 px-4 py-1.5 text-sm font-medium text-white"
            >
              {isLast ? "はじめる" : "次へ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
