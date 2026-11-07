import { z } from "zod";
import { runToolLoop } from "./claude";
import { createCardInputSchema, formatCard, formatSource, handleUpdateCard, updateCardInputSchema } from "./cardTools";
import {
  addCardMessage,
  answerSenpaiQuestion,
  createCard,
  createQuestion,
  createSenpaiQuestion,
  getCard,
  getQuestion,
  getSourcesByIds,
  joinSenpaiQuestion,
  listCardMessages,
  listCards,
  listSenpaiQuestions,
  listSources,
  updateCard,
  updateQuestion,
} from "./db";
import { CARD_KINDS, profileLabel, type Card, type Profile, type SenpaiQuestion } from "./types";

const ORG = "学園祭の実行委員会 総務局（毎年9月下旬に代替わりし、前の代の B4 は10月から実務訓練で学校を離れる）";

// 返事の言葉づかいの決まり。すべてのエージェントの指示文の最後に付ける
const STYLE = "\n\n言葉づかい: 「去年」とは書かず「昨年」と書く。「カード」とは書かず「知識カード」と書く。";

// ---- 修正の会話 POST /api/cards/[id]/chat ----

const CHAT_SYSTEM = `あなたは「1代上の先輩ノート」のエージェントです。${ORG}の知識カードを、前の代の先輩と一緒に確かめて直します。
先輩は忙しいので、短く、1回に1つだけ聞いてください。

- 知識カードの理由（why）が「不明」なら、まず理由を先輩に尋ねる
- 先輩の答えで知識カードを直すときは update_card を呼ぶ（この知識カードの id だけ）。先輩が言っていないことは書かない
- 先輩が「これで正しい」「OK」などと確認したら confirm_card を呼ぶ
- 直したら、何をどう直したかを一言で伝え、ほかに直すところがないか、確定してよいかを尋ねる${STYLE}`;

const confirmCardTool = {
  name: "confirm_card",
  description: "先輩が内容を確認したので、この知識カードを確認済み（confirmed）にする。",
  input_schema: { type: "object" as const, properties: {}, additionalProperties: false },
};

export async function chatOnCard(cardId: string, senpaiText: string | null, profile: Profile): Promise<string> {
  const card = await getCard(cardId);
  if (!card) throw new Error("知識カードがありません");
  if (senpaiText) await addCardMessage(cardId, "senpai", senpaiText);

  const [sources, history, allSources] = await Promise.all([getSourcesByIds(card.sourceIds), listCardMessages(cardId), listSources()]);
  const knownSourceIds = new Set(allSources.map((s) => s.id));

  const context = [
    "## 知識カード",
    formatCard(card),
    "",
    "## 根拠の投稿・資料",
    sources.map(formatSource).join("\n\n") || "（なし）",
  ].join("\n");

  // 会話の履歴を user / assistant に並べる。最初の user に知識カードと根拠を入れる
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  const opener = history.length === 0 ? "この知識カードを確かめたいです。最初に聞きたいことを1つ聞いてください。" : "この知識カードを確かめています。";
  messages.push({ role: "user", content: `${context}\n\n${opener}` });
  for (const m of history) {
    const role = m.role === "senpai" ? "user" : "assistant";
    const last = messages[messages.length - 1];
    if (last.role === role) last.content += `\n\n${m.text}`;
    else messages.push({ role, content: m.text });
  }
  if (messages[messages.length - 1].role === "assistant") messages.push({ role: "user", content: "（続けてください）" });

  const reply = await runToolLoop({
    system: CHAT_SYSTEM,
    messages,
    tools: [
      { name: "update_card", description: "この知識カードを直す。変える項目だけを渡す。", input_schema: updateCardInputSchema },
      confirmCardTool,
    ],
    handlers: {
      update_card: (input) => handleUpdateCard(input, knownSourceIds, { backToDraft: false, onlyCardId: cardId }),
      confirm_card: async () => {
        await updateCard(cardId, { status: "confirmed", confirmedBy: profileLabel(profile) });
        return JSON.stringify({ ok: true });
      },
    },
  });
  const text = reply || "直しました。";
  await addCardMessage(cardId, "agent", text);
  return text;
}

// ---- 質問への回答 POST /api/questions ----

const ANSWER_SYSTEM = `あなたは「1代上の先輩ノート」のエージェントです。${ORG}の新しい代（後輩）の質問に、前の代が確認した知識カードだけを根拠に答えます。

- 知識カードで答えられるときは answer を呼ぶ。根拠にした知識カードの id を必ず付ける。知識カードに書いていないことは足さない
- 知識カードで答えられない、または一部しか答えられないときは report_gap を呼び、前の代の先輩に聞く質問を短く1文で書く。
  すでに似た「先輩への質問」が open で出ていれば、その id を join_id に入れて合流させる
- 一部だけ答えられるときは、answer で答えられる部分を答えたうえで report_gap も呼ぶ
- 回答は「です・ます」で、短く。時期・締切・理由があれば書く${STYLE}`;

const answerTool = {
  name: "answer",
  description: "確認済みの知識カードを根拠に後輩の質問に答える。",
  input_schema: {
    type: "object" as const,
    properties: {
      answer: { type: "string", description: "回答の本文" },
      cited_card_ids: { type: "array", items: { type: "string" }, description: "根拠にした知識カードの id（1件以上）" },
    },
    required: ["answer", "cited_card_ids"],
    additionalProperties: false,
  },
  strict: true,
};

const reportGapTool = {
  name: "report_gap",
  description: "知識カードでは答えられないことを、前の代の先輩への質問にする。",
  input_schema: {
    type: "object" as const,
    properties: {
      senpai_question: { type: "string", description: "先輩に聞く質問（短く1文）" },
      join_id: { type: ["string", "null"], description: "合流させる open の先輩への質問の id。なければ null" },
    },
    required: ["senpai_question", "join_id"],
    additionalProperties: false,
  },
  strict: true,
};

export interface AskResult {
  questionId: string;
  answer: string | null;
  citedCards: Card[];
  status: "answered" | "gap";
  senpaiQuestion: SenpaiQuestion | null;
}

export async function askQuestion(text: string, profile: Profile): Promise<AskResult> {
  const [cards, openSenpaiQuestions] = await Promise.all([listCards("confirmed"), listSenpaiQuestions("open")]);
  const cardIds = new Set(cards.map((c) => c.id));
  const questionId = await createQuestion({
    text,
    answer: null,
    citedCardIds: [],
    status: "gap",
    senpaiQuestionId: null,
    askedBy: profileLabel(profile),
  });

  let answer: string | null = null;
  let cited: string[] = [];
  let senpaiQuestionId: string | null = null;

  const cardsText = cards.length ? cards.map(formatCard).join("\n\n") : "（確認済みの知識カードはまだありません）";
  const openText = openSenpaiQuestions.length
    ? openSenpaiQuestions.map((q) => `- id=${q.id}: ${q.text}`).join("\n")
    : "（ありません）";

  await runToolLoop({
    // 知識カードはすべて system に入れてキャッシュする（ベクトル検索は使わない）
    system: [
      { type: "text", text: ANSWER_SYSTEM },
      { type: "text", text: `## 確認済みの知識カード\n${cardsText}`, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: `## open の先輩への質問\n${openText}\n\n## 後輩の質問\n${text}` }],
    tools: [answerTool, reportGapTool],
    handlers: {
      answer: async (input) => {
        const parsed = z.object({ answer: z.string(), cited_card_ids: z.array(z.string()) }).parse(input);
        const bad = parsed.cited_card_ids.filter((id) => !cardIds.has(id));
        if (bad.length) throw new Error(`確認済みの知識カードではありません: ${bad.join(", ")}`);
        answer = parsed.answer;
        cited = parsed.cited_card_ids;
        return JSON.stringify({ ok: true });
      },
      report_gap: async (input) => {
        const parsed = z.object({ senpai_question: z.string(), join_id: z.string().nullable() }).parse(input);
        const join = parsed.join_id && openSenpaiQuestions.find((q) => q.id === parsed.join_id);
        if (join) {
          await joinSenpaiQuestion(join.id, questionId);
          senpaiQuestionId = join.id;
        } else {
          senpaiQuestionId = await createSenpaiQuestion(parsed.senpai_question, questionId);
        }
        return JSON.stringify({ ok: true, senpai_question_id: senpaiQuestionId });
      },
    },
  });

  const status = senpaiQuestionId || !answer ? "gap" : "answered";
  await updateQuestion(questionId, { answer, citedCardIds: cited, status, senpaiQuestionId });
  const senpaiQuestion = senpaiQuestionId
    ? ((await listSenpaiQuestions("open")).find((q) => q.id === senpaiQuestionId) ?? null)
    : null;
  return {
    questionId,
    answer,
    citedCards: cards.filter((c) => cited.includes(c.id)),
    status,
    senpaiQuestion,
  };
}

// ---- 先輩の回答 POST /api/senpai-questions/[id]/answer ----

const SENPAI_ANSWER_SYSTEM = `あなたは「1代上の先輩ノート」のエージェントです。${ORG}で、後輩が聞いたことに前の代の先輩が答えました。

1. 先輩の答えを知識カードにする（create_card）。先輩が言ったことだけを書き、理由が言われていなければ why は null
2. 元の後輩の質問それぞれに、先輩の答えをもとに回答する（answer_kouhai）。「先輩からの回答です」と分かるように書く${STYLE}`;

const answerKouhaiTool = {
  name: "answer_kouhai",
  description: "元の後輩の質問に回答を返す。",
  input_schema: {
    type: "object" as const,
    properties: {
      question_id: { type: "string" },
      answer: { type: "string" },
    },
    required: ["question_id", "answer"],
    additionalProperties: false,
  },
  strict: true,
};

export async function answerAsSenpai(
  senpaiQuestion: SenpaiQuestion,
  answerText: string,
  profile: Profile,
): Promise<{ cardId: string | null }> {
  const questions = (await Promise.all(senpaiQuestion.questionIds.map((id) => getQuestion(id)))).filter((q) => q !== null);
  let cardId: string | null = null;

  const createInput = z.object({
    title: z.string(),
    kind: z.enum(CARD_KINDS as [Card["kind"], ...Card["kind"][]]),
    when: z.string().nullable(),
    body: z.string(),
    why: z.string().nullable(),
  });

  await runToolLoop({
    system: SENPAI_ANSWER_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `## 先輩への質問 (id=${senpaiQuestion.id})`,
          senpaiQuestion.text,
          "",
          "## 元の後輩の質問",
          questions.map((q) => `- id=${q.id}: ${q.text}`).join("\n"),
          "",
          "## 先輩の答え",
          answerText,
        ].join("\n"),
      },
    ],
    tools: [
      {
        name: "create_card",
        description: `先輩の答えから確認済みの知識カードを作る。根拠は先輩の答えなので source_ids は空の配列にする。generation は ${profile.generation}（答えた先輩の代）。`,
        input_schema: createCardInputSchema,
      },
      answerKouhaiTool,
    ],
    handlers: {
      create_card: async (input) => {
        const parsed = createInput.parse(input);
        // 根拠は先輩の答え。答えた先輩の代の知識として、確認済みで作る
        cardId = await createCard({
          ...parsed,
          sourceIds: [],
          answerIds: [senpaiQuestion.id],
          status: "confirmed",
          generation: profile.generation,
          confirmedBy: profileLabel(profile),
        });
        return JSON.stringify({ ok: true, card_id: cardId });
      },
      answer_kouhai: async (input) => {
        const parsed = z.object({ question_id: z.string(), answer: z.string() }).parse(input);
        if (!senpaiQuestion.questionIds.includes(parsed.question_id)) throw new Error("この先輩への質問に含まれない質問です");
        await updateQuestion(parsed.question_id, {
          answer: parsed.answer,
          status: "answered",
          citedCardIds: cardId ? [cardId] : [],
        });
        return JSON.stringify({ ok: true });
      },
    },
  });

  await answerSenpaiQuestion(senpaiQuestion.id, answerText, cardId, profileLabel(profile));
  return { cardId };
}
