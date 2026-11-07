export type SourceKind = "slack" | "drive" | "notion" | "plan";
export type CardKind = "procedure" | "decision" | "exception" | "lesson" | "contact";

export const CARD_KINDS: CardKind[] = ["procedure", "decision", "exception", "lesson", "contact"];

export const CARD_KIND_LABEL: Record<CardKind, string> = {
  procedure: "手順",
  decision: "判断と理由",
  exception: "例外の対応",
  lesson: "過去の指摘",
  contact: "連絡先・窓口",
};

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  slack: "Slack",
  drive: "Drive",
  notion: "Notion",
  plan: "今年の計画",
};

// 日時はすべて ISO 文字列でやりとりする（Firestore には Timestamp で保存する）
export interface Source {
  id: string;
  kind: SourceKind;
  title: string;
  author: string;
  postedAt: string;
  url: string;
  body: string;
  ingestedAt: string | null;
  generation: number;
}

export interface Card {
  id: string;
  title: string;
  kind: CardKind;
  when: string | null;
  body: string;
  why: string | null;
  sourceIds: string[];
  answerIds: string[];
  status: "draft" | "confirmed";
  generation: number;
  confirmedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CardMessage {
  id: string;
  role: "senpai" | "agent";
  text: string;
  createdAt: string;
}

export interface Question {
  id: string;
  text: string;
  answer: string | null;
  citedCardIds: string[];
  status: "answered" | "gap";
  senpaiQuestionId: string | null;
  askedBy: string;
  createdAt: string;
}

export interface SenpaiQuestion {
  id: string;
  text: string;
  questionIds: string[];
  status: "open" | "answered";
  answer: string | null;
  cardId: string | null;
  answeredBy: string | null;
  createdAt: string;
  answeredAt: string | null;
}

// ---- 登録と代 ----

export type Role = "current" | "previous";
export const ROLE_LABEL: Record<Role, string> = { current: "現役の代", previous: "前の代" };

export const PROFILE_DEPARTMENTS = ["局長", "会場", "備品", "申請"] as const;
export type ProfileDepartment = (typeof PROFILE_DEPARTMENTS)[number];

export interface Profile {
  role: Role;
  generation: number; // 担当する（した）本番の年
  department: ProfileDepartment;
  name: string;
}

export function profileLabel(p: Pick<Profile, "name" | "generation">): string {
  return `${p.name}（${p.generation}年度）`;
}

// 代は担当する本番の年で数える。9月下旬の引き継ぎ（9/25）を境に、その日以降は翌年の代
export const HANDOVER_MONTH_DAY = "09-25";

export function generationOf(isoDate: string): number {
  const d = new Date(isoDate);
  // 日本時間で数える
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const md = `${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
  return md >= HANDOVER_MONTH_DAY ? year + 1 : year;
}

export interface Generation {
  year: number;
  festivalDate: string; // YYYY-MM-DD
  registeredBy: string;
  planStatus: "none" | "running" | "done" | "error";
  planGeneratedAt: string | null;
  createdAt: string;
}

// ---- 今年の計画とアドバイス ----

export const PLAN_DEPARTMENTS = ["局全体", "会場", "備品", "申請"] as const;
export type PlanDepartment = (typeof PLAN_DEPARTMENTS)[number];

export interface PlanItem {
  id: string;
  generation: number;
  title: string;
  detail: string;
  date: string; // YYYY-MM-DD
  department: PlanDepartment;
  cardIds: string[];
  origin: "generated" | "added";
  done: boolean;
  memo: string | null;
  dateChangeReason: string | null;
  originalDate: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Advice {
  id: string;
  planItemId: string;
  generation: number;
  kind: "record" | "suggestion";
  text: string;
  cardIds: string[];
  status: "confirmed" | "draft";
  confirmedBy: string | null;
  createdAt: string;
}
