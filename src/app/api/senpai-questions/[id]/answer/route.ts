import { NextResponse } from "next/server";
import { answerAsSenpai } from "@/lib/agents";
import { getSenpaiQuestion } from "@/lib/db";

export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { answer } = (await req.json()) as { answer: string };
  if (!answer?.trim()) return NextResponse.json({ error: "回答が空です" }, { status: 400 });
  const sq = await getSenpaiQuestion(id);
  if (!sq) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (sq.status === "answered") return NextResponse.json({ error: "回答済みです" }, { status: 409 });
  try {
    return NextResponse.json(await answerAsSenpai(sq, answer.trim()));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
