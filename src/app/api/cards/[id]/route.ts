import { NextResponse } from "next/server";
import { getCard, getSenpaiQuestion, getSourcesByIds, listCardMessages } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await getCard(id);
  if (!card) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [sources, messages, answers] = await Promise.all([
    getSourcesByIds(card.sourceIds),
    listCardMessages(id),
    Promise.all(card.answerIds.map((a) => getSenpaiQuestion(a))),
  ]);
  return NextResponse.json({ card, sources, messages, answers: answers.filter(Boolean) });
}
