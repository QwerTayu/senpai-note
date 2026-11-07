import { NextResponse } from "next/server";
import { chatOnCard } from "@/lib/agents";

export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { text } = (await req.json()) as { text: string | null };
  try {
    return NextResponse.json({ reply: await chatOnCard(id, text?.trim() || null) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
