import { FieldValue, Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import { firestore } from "./firebase";
import type { Card, CardMessage, Question, SenpaiQuestion, Source } from "./types";

// Firestore の Timestamp を ISO 文字列に直して、id を付けて返す
function toPlain<T>(snap: DocumentSnapshot): T {
  const data = snap.data() ?? {};
  const out: Record<string, unknown> = { id: snap.id };
  for (const [k, v] of Object.entries(data)) {
    out[k] = v instanceof Timestamp ? v.toDate().toISOString() : v;
  }
  return out as T;
}

const col = {
  sources: () => firestore().collection("sources"),
  cards: () => firestore().collection("cards"),
  questions: () => firestore().collection("questions"),
  senpaiQuestions: () => firestore().collection("senpaiQuestions"),
};

// ---- sources ----

export async function listSources(): Promise<Source[]> {
  const snap = await col.sources().orderBy("postedAt").get();
  return snap.docs.map((d) => toPlain<Source>(d));
}

export async function listUningestedSources(): Promise<Source[]> {
  const snap = await col.sources().where("ingestedAt", "==", null).get();
  return snap.docs.map((d) => toPlain<Source>(d)).sort((a, b) => a.postedAt.localeCompare(b.postedAt));
}

export async function getSourcesByIds(ids: string[]): Promise<Source[]> {
  if (ids.length === 0) return [];
  const snaps = await firestore().getAll(...ids.map((id) => col.sources().doc(id)));
  return snaps.filter((s) => s.exists).map((s) => toPlain<Source>(s));
}

export async function markSourcesIngested(ids: string[]) {
  const batch = firestore().batch();
  for (const id of ids) batch.update(col.sources().doc(id), { ingestedAt: FieldValue.serverTimestamp() });
  await batch.commit();
}

// ---- cards ----

export async function listCards(status?: Card["status"]): Promise<Card[]> {
  const q = status ? col.cards().where("status", "==", status) : col.cards();
  const snap = await q.get();
  return snap.docs.map((d) => toPlain<Card>(d)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getCard(id: string): Promise<Card | null> {
  const snap = await col.cards().doc(id).get();
  return snap.exists ? toPlain<Card>(snap) : null;
}

export type CardInput = Pick<Card, "title" | "kind" | "when" | "body" | "why" | "sourceIds" | "answerIds" | "status">;

export async function createCard(input: CardInput): Promise<string> {
  const ref = await col.cards().add({
    ...input,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateCard(id: string, patch: Partial<CardInput>) {
  await col.cards().doc(id).update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
}

export async function listCardMessages(cardId: string): Promise<CardMessage[]> {
  const snap = await col.cards().doc(cardId).collection("messages").orderBy("createdAt").get();
  return snap.docs.map((d) => toPlain<CardMessage>(d));
}

export async function addCardMessage(cardId: string, role: CardMessage["role"], text: string) {
  await col.cards().doc(cardId).collection("messages").add({ role, text, createdAt: FieldValue.serverTimestamp() });
}

// ---- questions ----

export async function listQuestions(): Promise<Question[]> {
  const snap = await col.questions().orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => toPlain<Question>(d));
}

export async function getQuestion(id: string): Promise<Question | null> {
  const snap = await col.questions().doc(id).get();
  return snap.exists ? toPlain<Question>(snap) : null;
}

export async function createQuestion(input: Omit<Question, "id" | "createdAt">): Promise<string> {
  const ref = await col.questions().add({ ...input, createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}

export async function updateQuestion(id: string, patch: Partial<Omit<Question, "id" | "createdAt">>) {
  await col.questions().doc(id).update(patch);
}

// ---- senpaiQuestions ----

export async function listSenpaiQuestions(status?: SenpaiQuestion["status"]): Promise<SenpaiQuestion[]> {
  const q = status ? col.senpaiQuestions().where("status", "==", status) : col.senpaiQuestions();
  const snap = await q.get();
  return snap.docs.map((d) => toPlain<SenpaiQuestion>(d)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSenpaiQuestion(id: string): Promise<SenpaiQuestion | null> {
  const snap = await col.senpaiQuestions().doc(id).get();
  return snap.exists ? toPlain<SenpaiQuestion>(snap) : null;
}

export async function createSenpaiQuestion(text: string, questionId: string): Promise<string> {
  const ref = await col.senpaiQuestions().add({
    text,
    questionIds: [questionId],
    status: "open",
    answer: null,
    cardId: null,
    createdAt: FieldValue.serverTimestamp(),
    answeredAt: null,
  });
  return ref.id;
}

export async function joinSenpaiQuestion(id: string, questionId: string) {
  await col.senpaiQuestions().doc(id).update({ questionIds: FieldValue.arrayUnion(questionId) });
}

export async function answerSenpaiQuestion(id: string, answer: string, cardId: string | null) {
  await col.senpaiQuestions().doc(id).update({
    status: "answered",
    answer,
    cardId,
    answeredAt: FieldValue.serverTimestamp(),
  });
}
