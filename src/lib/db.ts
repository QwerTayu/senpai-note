import { FieldValue, Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import { firestore } from "./firebase";
import type { Advice, Card, CardMessage, Generation, PlanItem, Question, SenpaiQuestion, Source } from "./types";

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
  generations: () => firestore().collection("generations"),
  planItems: () => firestore().collection("planItems"),
  advice: () => firestore().collection("advice"),
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

export type CardInput = Pick<Card, "title" | "kind" | "when" | "body" | "why" | "sourceIds" | "answerIds" | "status" | "generation" | "confirmedBy">;

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
    answeredBy: null,
    createdAt: FieldValue.serverTimestamp(),
    answeredAt: null,
  });
  return ref.id;
}

export async function joinSenpaiQuestion(id: string, questionId: string) {
  await col.senpaiQuestions().doc(id).update({ questionIds: FieldValue.arrayUnion(questionId) });
}

export async function answerSenpaiQuestion(id: string, answer: string, cardId: string | null, answeredBy: string) {
  await col.senpaiQuestions().doc(id).update({
    status: "answered",
    answer,
    cardId,
    answeredBy,
    answeredAt: FieldValue.serverTimestamp(),
  });
}

// ---- generations（代） ----

export async function getGeneration(year: number): Promise<Generation | null> {
  const snap = await col.generations().doc(String(year)).get();
  return snap.exists ? { ...toPlain<Generation>(snap), year } : null;
}

// その代の本番の日は、最初に入れた人のものだけを残す（2人目からは上書きしない）
export async function registerGeneration(year: number, festivalDate: string, registeredBy: string): Promise<Generation> {
  const ref = col.generations().doc(String(year));
  await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return;
    tx.set(ref, {
      festivalDate,
      registeredBy,
      planStatus: "none",
      planGeneratedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  return (await getGeneration(year))!;
}

// 計画づくりを始めてよければ true（同時に2回動かさない。10分以上 running のままなら、止まったとみなしてやり直す）
export async function startPlanGeneration(year: number): Promise<boolean> {
  const ref = col.generations().doc(String(year));
  return firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error(`${year}年度の本番の日がまだ入っていません`);
    const data = snap.data()!;
    const startedAt = data.planStartedAt instanceof Timestamp ? data.planStartedAt.toMillis() : 0;
    if (data.planStatus === "running" && Date.now() - startedAt < 10 * 60 * 1000) return false;
    tx.update(ref, { planStatus: "running", planStartedAt: FieldValue.serverTimestamp() });
    return true;
  });
}

export async function finishPlanGeneration(year: number, ok: boolean) {
  await col.generations().doc(String(year)).update({
    planStatus: ok ? "done" : "error",
    ...(ok ? { planGeneratedAt: FieldValue.serverTimestamp() } : {}),
  });
}

// ---- planItems（計画の項目）と advice（アドバイス） ----

export async function listPlanItems(generation: number): Promise<PlanItem[]> {
  const snap = await col.planItems().where("generation", "==", generation).get();
  return snap.docs.map((d) => toPlain<PlanItem>(d)).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export async function getPlanItem(id: string): Promise<PlanItem | null> {
  const snap = await col.planItems().doc(id).get();
  return snap.exists ? toPlain<PlanItem>(snap) : null;
}

export type PlanItemInput = Omit<PlanItem, "id" | "createdAt" | "updatedAt">;

export async function createPlanItem(input: PlanItemInput): Promise<string> {
  const ref = await col.planItems().add({
    ...input,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updatePlanItem(id: string, patch: Partial<PlanItemInput>) {
  await col.planItems().doc(id).update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
}

export async function deletePlanItem(id: string) {
  const advice = await col.advice().where("planItemId", "==", id).get();
  const batch = firestore().batch();
  for (const d of advice.docs) batch.delete(d.ref);
  batch.delete(col.planItems().doc(id));
  await batch.commit();
}

// 作り直すときに、その代の計画とアドバイスを全部消す
export async function clearPlan(generation: number) {
  for (const c of [col.planItems(), col.advice()]) {
    const snap = await c.where("generation", "==", generation).get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = firestore().batch();
      for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
      await batch.commit();
    }
  }
}

export async function listAdvice(filter: { generation?: number; status?: Advice["status"] }): Promise<Advice[]> {
  let q: FirebaseFirestore.Query = col.advice();
  if (filter.generation !== undefined) q = q.where("generation", "==", filter.generation);
  if (filter.status) q = q.where("status", "==", filter.status);
  const snap = await q.get();
  return snap.docs.map((d) => toPlain<Advice>(d)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getAdvice(id: string): Promise<Advice | null> {
  const snap = await col.advice().doc(id).get();
  return snap.exists ? toPlain<Advice>(snap) : null;
}

export async function createAdvice(input: Omit<Advice, "id" | "createdAt">): Promise<string> {
  const ref = await col.advice().add({ ...input, createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}

export async function confirmAdvice(id: string, confirmedBy: string) {
  await col.advice().doc(id).update({ status: "confirmed", confirmedBy });
}

export async function deleteAdvice(id: string) {
  await col.advice().doc(id).delete();
}

// 今年の代が計画に残した記録（日付を変えた理由・ふりかえり）を、取り込み元にする。
// 同じ項目は上書きし、次の取り込みで読み直されるよう ingestedAt を null に戻す
export async function upsertPlanSource(item: PlanItem, author: string) {
  const lines = [`${item.title}（${item.department}）`];
  if (item.originalDate && item.originalDate !== item.date) {
    lines.push(`予定の日付を ${item.originalDate} から ${item.date} に変えた。`);
    if (item.dateChangeReason) lines.push(`変えた理由: ${item.dateChangeReason}`);
  } else {
    lines.push(`予定の日付: ${item.date}`);
  }
  if (item.memo) lines.push(`ふりかえり: ${item.memo}`);
  if (item.done) lines.push("この項目は完了した。");
  await col.sources().doc(`plan-${item.id}`).set({
    kind: "plan",
    title: `今年の計画: ${item.title}`,
    author,
    postedAt: FieldValue.serverTimestamp(),
    url: `https://wakaba-fes.example/plan/${item.id}`,
    body: lines.join("\n"),
    ingestedAt: null,
    generation: item.generation,
  });
}
