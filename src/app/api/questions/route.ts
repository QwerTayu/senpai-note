import { NextResponse } from "next/server";
import { askQuestion } from "@/lib/agents";
import { listQuestions } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  return NextResponse.json({ questions: await listQuestions() });
}

export async function POST(req: Request) {
  const { text } = (await req.json()) as { text: string };
  if (!text?.trim()) return NextResponse.json({ error: "質問が空です" }, { status: 400 });
  try {
    return NextResponse.json(await askQuestion(text.trim()));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
