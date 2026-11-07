import { z } from "zod";
import { runToolLoop } from "./claude";
import { formatCard } from "./cardTools";
import { clearPlan, createAdvice, createPlanItem, finishPlanGeneration, getGeneration, listCards, startPlanGeneration } from "./db";
import { PLAN_DEPARTMENTS, type PlanDepartment } from "./types";

// 計画づくり POST /api/plan
// 確認済みの知識カードと、その代の本番の日から、今年の計画の項目とアドバイスを作る

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function withWeekday(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${ymd}（${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}）`;
}

function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const PLAN_SYSTEM = `あなたは「1代上の先輩ノート」のエージェントです。学園祭の実行委員会 総務局で、前の代の先輩（B4）は半年間の長期インターン（実務訓練）で学校を離れ、国内外にいます。
先輩の代わりに、現役の代（B3）のための「今年の年間計画」を作ります。前の代までが確かめた知識カードだけを元にします。

計画の項目（add_plan_item）:
- 時期（when）のある知識カードから、今年やることを1つずつ項目にする。同じ仕事の知識カードは1つの項目にまとめる。時期のない知識カードだけでは項目を作らない
- 日付は今年の日付にする。代は「担当する本番の年」で数え、その代の1年は前の年の10月から本番の9月まで。10〜12月の時期は本番の前の年、1〜9月は本番の年の日付にする
- 「本番の6週間前」「本番の10日前」「本番前日」のような時期は、今年の本番の日から計算する。「6月中」「7月第3週」のような時期は、その期間の初めの日にし、detail に元の時期を書く
- 本番の日そのもの、引き継ぎ会など、知識カードにある節目も項目にしてよい
- department は 局全体・会場・備品・申請 のどれか。局長の仕事や局全体に関わることは 局全体
- detail には、何をするかを1〜2文で書く。知識カードに書いていないことは書かない
- 今日より前の日付になる項目も作る（現役の代がまだやっていなければ「今やること」に出る）

アドバイス（advice。項目ごとに0〜2件）:
- kind="record"（記録）: 知識カードに書かれている、昨年までの問題・理由・先輩の回答。「昨年（2026年度）は〜だったので、〜」のように、どの代の話かがわかるように書く。知識カードに書かれていることだけを書く
- kind="suggestion"（提案）: 記録をもとに、あなたが考えた「今年はこうするとよい」。記録の言い換えではなく、具体的な一手にする。先輩の確認を待つ提案として表示される
- どちらも、根拠の知識カードの id を card_ids に必ず入れる。同じアドバイスを複数の項目に重ねない
- 過去の指摘（lesson）や理由（why）がある知識カードは、関係する項目のアドバイスに必ず生かす

進め方:
- 1回の返事で、複数の add_plan_item をまとめて呼んでよい。全部の項目を作り終えたら、作った項目の数を一言で報告して終わる
- 口調は「です・ます」
- 「去年」とは書かず「昨年」と書く。「カード」とは書かず「知識カード」と書く`;

const addPlanItemTool = {
  name: "add_plan_item",
  description: "今年の計画に項目を1つ足す。アドバイスも一緒に付ける。",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "やること（短く）" },
      detail: { type: "string", description: "何をするか（1〜2文）。元の時期の書き方もここに書く" },
      date: { type: "string", description: "今年の日付 YYYY-MM-DD" },
      department: { type: "string", enum: [...PLAN_DEPARTMENTS] },
      card_ids: { type: "array", items: { type: "string" }, description: "元にした知識カードの id（1件以上）" },
      advice: {
        type: "array",
        description: "この項目へのアドバイス（0〜2件）",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["record", "suggestion"] },
            text: { type: "string" },
            card_ids: { type: "array", items: { type: "string" } },
          },
          required: ["kind", "text", "card_ids"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "detail", "date", "department", "card_ids", "advice"],
    additionalProperties: false,
  },
  strict: true,
};

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(v)), "日付が正しくありません");

const addPlanItemInput = z.object({
  title: z.string().min(1),
  detail: z.string(),
  date: ymd,
  department: z.enum(PLAN_DEPARTMENTS as unknown as [PlanDepartment, ...PlanDepartment[]]),
  card_ids: z.array(z.string()).min(1),
  advice: z
    .array(z.object({ kind: z.enum(["record", "suggestion"]), text: z.string().min(1), card_ids: z.array(z.string()).min(1) }))
    .max(2),
});

export interface PlanResult {
  started: boolean;
  items: number;
  advice: number;
  report: string;
}

export async function generatePlan(generation: number): Promise<PlanResult> {
  const gen = await getGeneration(generation);
  if (!gen) throw new Error(`${generation}年度の本番の日がまだ入っていません`);
  if (!(await startPlanGeneration(generation))) return { started: false, items: 0, advice: 0, report: "計画を作っているところです" };

  try {
    await clearPlan(generation);
    const cards = await listCards("confirmed");
    const cardIds = new Set(cards.map((c) => c.id));
    const checkCards = (ids: string[]) => {
      const bad = ids.filter((id) => !cardIds.has(id));
      if (bad.length) throw new Error(`確認済みの知識カードではありません: ${bad.join(", ")}`);
    };

    let items = 0;
    let adviceCount = 0;
    const report = await runToolLoop({
      system: [
        { type: "text", text: PLAN_SYSTEM },
        { type: "text", text: `## 確認済みの知識カード\n${cards.map(formatCard).join("\n\n")}`, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: [
            `現役の代: ${generation}年度の代（前の代は ${generation - 1}年度）`,
            `今年の本番の初日: ${withWeekday(gen.festivalDate)}`,
            `今日: ${withWeekday(todayJst())}`,
            "",
            "この代の年間計画を作ってください。",
          ].join("\n"),
        },
      ],
      tools: [addPlanItemTool],
      maxTurns: 12,
      handlers: {
        add_plan_item: async (raw) => {
          const input = addPlanItemInput.parse(raw);
          checkCards(input.card_ids);
          for (const a of input.advice) checkCards(a.card_ids);
          const planItemId = await createPlanItem({
            generation,
            title: input.title,
            detail: input.detail,
            date: input.date,
            department: input.department,
            cardIds: input.card_ids,
            origin: "generated",
            done: false,
            memo: null,
            dateChangeReason: null,
            originalDate: input.date,
            updatedBy: null,
          });
          for (const a of input.advice) {
            await createAdvice({
              planItemId,
              generation,
              kind: a.kind,
              text: a.text,
              cardIds: a.card_ids,
              // 記録は知識カードに書かれていることなので確認済み。提案は先輩が ✅ するまで draft
              status: a.kind === "record" ? "confirmed" : "draft",
              confirmedBy: null,
            });
            adviceCount++;
          }
          items++;
          return JSON.stringify({ ok: true, plan_item_id: planItemId });
        },
      },
    });
    await finishPlanGeneration(generation, true);
    return { started: true, items, advice: adviceCount, report };
  } catch (e) {
    await finishPlanGeneration(generation, false);
    throw e;
  }
}
