"use client";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Icon } from "./Icon";

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
    <div className="space-y-2 rounded-[8px] bg-paper p-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tag">判断と理由</span>
        <span className="tag tag-pen">先輩が確認済み</span>
        <span className="tag">2026年度の代</span>
      </div>
      <p className="text-sm font-bold">出店場所は7月第3週の局長会議で確定する</p>
      <dl className="grid grid-cols-[3em_1fr] gap-x-2 gap-y-1">
        <dt className="text-pencil">いつ</dt>
        <dd>7月第3週</dd>
        <dt className="text-pencil">なぜ</dt>
        <dd>制作局の看板の発注（7月末）に間に合わせるため</dd>
        <dt className="text-pencil">根拠</dt>
        <dd>Slack #総務局 の投稿、Notion の振り返り</dd>
      </dl>
    </div>
  );
}

const TOURS: Record<string, Step[]> = {
  "/kouhai": [
    {
      target: "profile-menu",
      title: "senpai-note へようこそ",
      body: "前の代（B4）が実務訓練でいなくても、現役の代が回せるように、アプリが先輩の代わりをします。ここに、あなたの役・代・部門が出ます。役を変えるときは、ここから登録し直します。",
    },
    {
      target: "tabs",
      title: "先輩の代わりをする2つの画面",
      body: "「今年の計画」では、先輩のほうから「今はこれをやる時期」と教えます。「質問する」では、先輩に聞くように質問できます。",
    },
    {
      target: "today",
      title: "今やること",
      body: "今日から30日以内にやることと、期限を過ぎたことです。前の代までの記録を、今年の本番の日に合わせて計算しています。",
    },
    {
      target: "plan-item",
      title: "今年の計画の項目",
      body: "終わったらチェック。日付を変えるときは理由を、やってみたらメモ・ふりかえりを書きます。それが次の代への知識になります。",
    },
    {
      target: "advice",
      title: "去年の問題とアドバイス",
      body: "赤ペンは、先輩の記録（去年どうして、何が起きたか）。鉛筆は、それをもとにしたエージェントの提案です。前の代の先輩が確かめると、鉛筆の提案も赤ペンになります。",
    },
    {
      target: "plan-item",
      title: "「知識カード」＝ 先輩の知識を1つずつまとめたメモ",
      body: "計画もアドバイスも、知識カードから作っています。前の代が「何を・いつ・なぜそう決めたか」を1枚に1つずつ書いたもので、元の Slack の投稿や資料（根拠）が付いています。項目の下で開いて確かめられます。",
      example: true,
    },
    {
      target: "dept-filter",
      title: "部門で絞り込む",
      body: "最初は登録した部門の項目（と局全体の項目）だけを出しています。「すべて」で局全体の計画を見られます。",
    },
    {
      target: "ask-tab",
      title: "記録にないことは、質問で",
      body: "「質問する」で聞くと、確認済みの知識カードだけを根拠に答えます。記録にないことは「先輩への質問」にまとめて前の代に届き、答えが返ると知識カードになります。",
    },
  ],
  "/senpai": [
    {
      target: "profile-menu",
      title: "前の代（先輩）の画面です",
      body: "現役の代の計画と回答は、ここで先輩が確かめた知識カードから作られます。実務訓練で忙しい先輩のすることは、確かめるか一言答えるだけです。",
    },
    {
      target: "ingest",
      title: "1. ためる",
      body: "Slack・Drive・Notion のふだんのやりとりと、現役の代が計画に残した記録を、エージェントが読んで知識カードにします。何を・いつ・なぜそう決めたかを1枚ずつまとめます。",
    },
    {
      target: "tabs",
      title: "2. 確かめる",
      body: "できたばかりの知識カードは「確認待ち」に入ります。先輩が確かめた知識カードだけが「確認済み」になり、現役の代の計画と回答に使われます。",
    },
    {
      target: "card-list",
      title: "自分の代の知識カードから",
      body: "最初は、自分の代のやり方の知識カードだけを出しています。「すべての代」で、それより前の代の知識カードも見られます。「理由が不明」のものは、根拠に理由が書かれていなかったものです。",
    },
    {
      target: "card-panel",
      title: "確かめるか、話して直すだけ",
      body: "正しければ確認済みにします。理由が不明な知識カードでは、エージェントが先に理由を尋ねます。一言答えれば、知識カードが直ります。根拠の元の投稿もここで見られます。",
    },
    {
      target: "suggestions-tab",
      title: "エージェントの提案を確かめる",
      body: "現役の代の計画に、エージェントが「今年はこうするとよい」と鉛筆で提案を書いています。経験から見て正しければ確かめ、違えば却下します。確かめた提案は、現役の画面で赤ペンになります。",
    },
    {
      target: "questions-tab",
      title: "抜けだけ答える",
      body: "知識カードで答えられなかった現役の代の質問が、似たものをまとめて届きます。答えると知識カードになり、質問した人にも届きます。",
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

  // 初めて開いたときは自動で始める。計画づくりやデータの読み込みが終わり、
  // 説明する要素がほぼそろうまで待つ（最大3分。それを過ぎたら、ある要素だけで始める）
  useEffect(() => {
    if (!all) return;
    let seen = false;
    storage((ls) => {
      seen = ls.getItem(SEEN_KEY(pathname)) === "1";
    });
    const forced = new URLSearchParams(window.location.search).get("tour") === "1";
    if (forced) window.history.replaceState(null, "", pathname);
    let timer: ReturnType<typeof setInterval> | undefined;
    if (!seen || forced) {
      const startedAt = Date.now();
      timer = setInterval(() => {
        const found = all.filter((s) => document.querySelector(`[data-tour="${s.target}"]`)).length;
        const waited = Date.now() - startedAt;
        if ((found >= all.length - 1 && waited > 1000) || (found > 0 && waited > 180_000)) {
          clearInterval(timer);
          start(forced);
        }
      }, 500);
    }
    const onStart = () => start(false);
    window.addEventListener("senpai-note:start-tour", onStart);
    return () => {
      clearInterval(timer);
      window.removeEventListener("senpai-note:start-tour", onStart);
    };
  }, [pathname, start, all]);

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
        className="pointer-events-none fixed rounded-[8px] ring-2 ring-sheet transition-all duration-300"
        style={{
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
          boxShadow: "0 0 0 9999px rgba(29, 43, 68, 0.55)",
        }}
      />
      <div
        role="dialog"
        className="pointer-events-auto fixed space-y-4 rounded-[8px] border-t-4 border-t-ink bg-sheet p-6 shadow-[0_16px_40px_rgba(29,43,68,0.24)] transition-all duration-300"
        style={{ top, left, width, transform: below ? undefined : "translateY(-100%)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-bold leading-snug">{step.title}</h2>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-pencil">
              {index + 1} / {steps.length}
            </span>
            <button
              onClick={() => close(false)}
              aria-label="ツアーを閉じる"
              title="閉じる（「？ 使い方」で続きから再開できます）"
              className="-mr-2 flex h-8 w-8 items-center justify-center rounded-[4px] text-pencil hover:bg-paper hover:text-ink"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
        </div>
        <p className="text-sm text-ink-soft">{step.body}</p>
        {step.example && <ExampleCard />}
        <div className="flex items-center justify-between">
          <div>
            {index > 0 && (
              <button onClick={() => setIndex(0)} className="btn-text">
                最初から
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {index > 0 && (
              <button onClick={() => setIndex(index - 1)} className="btn btn-line">
                戻る
              </button>
            )}
            <button
              onClick={() => {
                if (!isLast) return setIndex(index + 1);
                close(true);
              }}
              className="btn btn-ink"
            >
              {isLast ? "はじめる" : "次へ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
