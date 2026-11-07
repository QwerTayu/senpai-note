import { z } from "zod";
import { createCard, getCard, updateCard } from "./db";
import { CARD_KINDS, type Card, type Source } from "./types";

// カードを作る・直すツールの定義。取り込み（Managed Agents のカスタムツール）と
// 修正の会話（Messages API）で同じスキーマを使う。

type ObjectSchema = { type: "object"; properties: Record<string, unknown>; required: string[]; additionalProperties: false };

const cardFieldsSchema = {
  title: { type: "string", description: "カードの見出し。何についてのカードかが一目でわかる短い文" },
  kind: {
    type: "string",
    enum: [...CARD_KINDS],
    description: "procedure=手順 / decision=判断とその理由 / exception=例外の対応 / lesson=過去の失敗・指摘とそれを受けたやり方 / contact=連絡先・窓口",
  },
  when: { type: ["string", "null"], description: "時期（例: 「6月中」「本番の10日前まで」）。時期に関係なければ null" },
  body: { type: "string", description: "何をするか・何を決めたか。根拠に書かれていることだけを書く" },
  why: { type: ["string", "null"], description: "理由。根拠に理由が書かれていなければ推測せず null" },
} as const;

export const createCardInputSchema: ObjectSchema = {
  type: "object",
  properties: {
    ...cardFieldsSchema,
    source_ids: { type: "array", items: { type: "string" }, description: "根拠の投稿・資料の id（1件以上）" },
  },
  required: ["title", "kind", "when", "body", "why", "source_ids"],
  additionalProperties: false,
};

export const updateCardInputSchema: ObjectSchema = {
  type: "object",
  properties: {
    card_id: { type: "string", description: "直すカードの id" },
    ...cardFieldsSchema,
    add_source_ids: { type: "array", items: { type: "string" }, description: "根拠に足す投稿・資料の id" },
  },
  required: ["card_id"],
  additionalProperties: false,
};

const kindEnum = z.enum(CARD_KINDS as [Card["kind"], ...Card["kind"][]]);

const createInput = z.object({
  title: z.string().min(1),
  kind: kindEnum,
  when: z.string().nullable(),
  body: z.string().min(1),
  why: z.string().nullable(),
  source_ids: z.array(z.string()).min(1),
});

const updateInput = z.object({
  card_id: z.string(),
  title: z.string().min(1).optional(),
  kind: kindEnum.optional(),
  when: z.string().nullable().optional(),
  body: z.string().min(1).optional(),
  why: z.string().nullable().optional(),
  add_source_ids: z.array(z.string()).optional(),
});

// 取り込みで使う。根拠の id は、渡した sources か既存のカードの根拠の中にあるものだけ認める
export async function handleCreateCard(raw: unknown, knownSourceIds: Set<string>): Promise<string> {
  const input = createInput.parse(raw);
  const unknown = input.source_ids.filter((id) => !knownSourceIds.has(id));
  if (unknown.length) throw new Error(`存在しない根拠の id: ${unknown.join(", ")}`);
  const id = await createCard({
    title: input.title,
    kind: input.kind,
    when: input.when,
    body: input.body,
    why: input.why,
    sourceIds: input.source_ids,
    answerIds: [],
    status: "draft",
  });
  return JSON.stringify({ ok: true, card_id: id });
}

// 取り込みで既存のカードに統合するときは、先輩に確かめ直してもらうため draft に戻す
export async function handleUpdateCard(
  raw: unknown,
  knownSourceIds: Set<string>,
  opts: { backToDraft: boolean; onlyCardId?: string },
): Promise<string> {
  const input = updateInput.parse(raw);
  if (opts.onlyCardId && input.card_id !== opts.onlyCardId) throw new Error("この会話では、このカードしか直せません");
  const card = await getCard(input.card_id);
  if (!card) throw new Error(`カードがありません: ${input.card_id}`);
  const added = input.add_source_ids ?? [];
  const unknown = added.filter((id) => !knownSourceIds.has(id));
  if (unknown.length) throw new Error(`存在しない根拠の id: ${unknown.join(", ")}`);
  const patch: Partial<Card> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.when !== undefined) patch.when = input.when;
  if (input.body !== undefined) patch.body = input.body;
  if (input.why !== undefined) patch.why = input.why;
  if (added.length) patch.sourceIds = Array.from(new Set([...card.sourceIds, ...added]));
  if (opts.backToDraft) patch.status = "draft";
  await updateCard(input.card_id, patch);
  return JSON.stringify({ ok: true, card_id: input.card_id });
}

export function formatSource(s: Source): string {
  return `<source id="${s.id}" kind="${s.kind}" title="${s.title}" author="${s.author}" posted_at="${s.postedAt}">\n${s.body}\n</source>`;
}

export function formatCard(c: Card): string {
  return [
    `<card id="${c.id}" kind="${c.kind}" status="${c.status}">`,
    `title: ${c.title}`,
    `when: ${c.when ?? "（なし）"}`,
    `body: ${c.body}`,
    `why: ${c.why ?? "（不明）"}`,
    `source_ids: ${c.sourceIds.join(", ") || "（なし）"}`,
    c.answerIds.length ? `answer_ids: ${c.answerIds.join(", ")}` : "",
    `</card>`,
  ]
    .filter(Boolean)
    .join("\n");
}
