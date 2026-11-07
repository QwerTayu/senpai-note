export type SourceKind = "slack" | "drive" | "notion";
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
  createdAt: string;
}

export interface SenpaiQuestion {
  id: string;
  text: string;
  questionIds: string[];
  status: "open" | "answered";
  answer: string | null;
  cardId: string | null;
  createdAt: string;
  answeredAt: string | null;
}
