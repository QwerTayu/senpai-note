"use client";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

// 画面の要素を1つずつ明るくして説明するツアー。
// 要素には data-tour="..." を付ける。見つからない手順は飛ばす。

interface Step {
  target: string;
  title: string;
  body: string;
  example?: boolean; // 見本の知識カードを吹き出しに出す
}

function ExampleCard() {
  return (
    <div className="space-y-1.5 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-800">判断と理由</span>
        <span className="rounded bg-green-600 px-1.5 py-0.5 font-medium text-white">✅ 確認済み</span>
        <span className="text-stone-500">🗓 7月第3週</span>
      </div>
      <div className="text-sm font-bold">出店場所は7月第3週の局長会議で確定する</div>
      <div><span className="text-stone-500">なぜ: </span>制作局の看板の発注（7月末）に間に合わせるため</div>
      <div className="text-stone-500">根拠: Slack #総務局 の投稿 / Notion の振り返り など</div>
    </div>
  );
}

// 最後の手順のあとに続ける画面
const NEXT: Record<string, { href: string; label: string }> = {
  "/kouhai": { href: "/senpai?tour=1", label: "先輩の画面へ →" },
};

const TOURS: Record<string, Step[]> = {
  "/senpai": [
    {
      target: "role-switch",
      title: "今度は先輩（前の代）の画面です",
      body: "後輩が聞いた答えの元になる知識カードは、ここで作られ、先輩が確かめています。先輩（B4）は実務訓練で忙しいので、することは最小限です。",
    },
    {
      target: "ingest",
      title: "1. ためる",
      body: "Slack・Drive・Notion のふだんのやりとりを、エージェントが読んで「知識カード」にします。何を、いつ、なぜそう決めたかを1枚ずつまとめます。",
    },
    {
      target: "tabs",
      title: "2. 確かめる",
      body: "できたばかりの知識カードは「確認待ち」に入ります。先輩が確かめた知識カードだけが「確認済み」になり、後輩への回答に使われます。",
    },
    {
      target: "card-list",
      title: "知識カードを選ぶ",
      body: "知識カードを選ぶと右に中身が出ます。「理由が不明」と出ている知識カードは、根拠の投稿に理由が書かれていなかったものです。",
    },
    {
      target: "card-panel",
      title: "✅ を押すか、話して直すだけ",
      body: "正しければ ✅。理由が不明な知識カードでは、エージェントが先に理由を尋ねます。一言答えれば、知識カードが直ります。根拠の元の投稿もここで見られます。",
    },
    {
      target: "questions-tab",
      title: "4. 抜けだけ聞く",
      body: "知識カードで答えられなかった後輩の質問は、似たものをまとめて「後輩からの質問」に届きます。先輩が答えると、その答えが知識カードになり、後輩にも届きます。",
    },
  ],
  "/kouhai": [
    {
      target: "role-switch",
      title: "senpai-note へようこそ",
      body: "毎年メンバーが入れ替わる組織のための「1代上の先輩」ノートです。ここで役を切り替えます（ログインはありません）。まずは新しい代（後輩）の画面から見ていきます。",
    },
    {
      target: "cards",
      title: "「知識カード」＝ 先輩の知識を1つずつまとめたメモ",
      body: "去年の先輩が「何を・いつ・なぜそう決めたか」を、1枚に1つずつ書いたものです。どの知識カードにも、元になった Slack の投稿や資料（根拠）が付いています。先輩が「正しい」と確かめたものに ✅ が付きます。",
      example: true,
    },
    {
      target: "ask",
      title: "3. 答える",
      body: "「去年はどうしていましたか？」と聞くように質問します。先輩が確認した知識カードだけを根拠に、エージェントが答えます。",
    },
    {
      target: "examples",
      title: "質問の例",
      body: "押すと質問欄に入ります。3つ目の「雨の日」は記録にないので、先輩への質問になります。",
    },
    {
      target: "answers",
      title: "根拠つきの回答",
      body: "回答の下の「根拠の知識カード」を開くと、元の Slack の投稿や資料まで確かめられます。記録にないことは「先輩に聞いています」と出て、先輩が答えるとここに届きます。",
    },
    {
      target: "cards",
      title: "知識カードを読む",
      body: "確認済みの知識カードは、質問しなくても一覧で読めます。では、この知識カードはどうやってできるのか？ 先輩の画面で見てみましょう。",
    },
  ],
};

const SEEN_KEY = (path: string) => `senpai-note:tour-seen:${path}`;
// 途中で閉じたときに、どの手順まで見たかを覚えておく（手順の target で持つ）
const PROGRESS_KEY = (path: string) => `senpai-note:tour-progress:${path}`;

function storage(fn: (s: Storage) => void) {
  try {
    fn(localStorage);
  } catch {}
}
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

  const start = useCallback(
    (fromBeginning: boolean) => {
      if (!all) return;
      const available = all.filter((s) => document.querySelector(`[data-tour="${s.target}"]`));
      if (available.length === 0) return;
      let resumeAt = 0;
      if (!fromBeginning) {
        storage((ls) => {
          const saved = ls.getItem(PROGRESS_KEY(pathname));
          resumeAt = Math.max(0, available.findIndex((s) => s.target === saved));
        });
      }
      setSteps(available);
      setIndex(resumeAt);
    },
    [all, pathname],
  );

  // completed: 最後まで見た（続きの記録を消す）/ false: 途中で閉じた（続きから再開できる）
  const close = useCallback(
    (completed: boolean) => {
      setSteps(null);
      setRect(null);
      storage((ls) => {
        ls.setItem(SEEN_KEY(pathname), "1");
        if (completed) ls.removeItem(PROGRESS_KEY(pathname));
      });
    },
    [pathname],
  );

  // 初めて開いたときは自動で始める（データの読み込みを少し待つ）
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY(pathname)) === "1";
    } catch {}
    const forced = new URLSearchParams(window.location.search).get("tour") === "1";
    if (forced) window.history.replaceState(null, "", pathname);
    const timer = seen && !forced ? undefined : setTimeout(() => start(forced), 1200);
    const onStart = () => start(false);
    window.addEventListener("senpai-note:start-tour", onStart);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("senpai-note:start-tour", onStart);
    };
  }, [pathname, start]);

  const step = steps?.[index];

  useEffect(() => {
    if (step) storage((ls) => ls.setItem(PROGRESS_KEY(pathname), step.target));
  }, [step, pathname]);

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
      // 入力欄で文字を打っているときは、矢印キーを横取りしない
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") close(false);
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps, close]);

  if (!steps || !step || !rect) return null;

  const isLast = index === steps.length - 1;
  const next = NEXT[pathname];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(360, vw - 32);
  const below = rect.bottom + 180 < vh || rect.top < 200;
  const top = below ? Math.min(rect.bottom + PAD + 12, vh - 200) : Math.max(rect.top - PAD - 12, 16);
  const left = Math.min(Math.max(rect.left, 16), vw - width - 16);

  return (
    // ツアー中もアプリを触れるように、重ねる層はクリックを通す（閉じるのはボタンと Esc だけ）
    <div className="pointer-events-none fixed inset-0 z-50">
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
        className="pointer-events-auto fixed space-y-3 rounded-xl bg-white p-4 shadow-2xl transition-all duration-300"
        style={{ top, left, width, transform: below ? undefined : "translateY(-100%)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="font-bold">{step.title}</div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-stone-400">
              {index + 1} / {steps.length}
            </span>
            <button
              onClick={() => close(false)}
              aria-label="ツアーを閉じる"
              title="閉じる（「？ 使い方」で続きから再開できます）"
              className="-mr-1 flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-stone-400 hover:bg-stone-100 hover:text-stone-800"
            >
              ×
            </button>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-stone-700">{step.body}</p>
        {step.example && <ExampleCard />}
        <div className="flex items-center justify-between">
          <div>
            {index > 0 && (
              <button onClick={() => setIndex(0)} className="text-sm text-stone-500 hover:text-stone-800">
                最初から
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {index > 0 && (
              <button onClick={() => setIndex(index - 1)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm">
                戻る
              </button>
            )}
            <button
              onClick={() => {
                if (!isLast) return setIndex(index + 1);
                close(true);
                if (next) window.location.href = next.href;
              }}
              className="rounded-lg bg-stone-900 px-4 py-1.5 text-sm font-medium text-white"
            >
              {isLast ? (next ? next.label : "はじめる") : "次へ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
