import { NextResponse } from "next/server";
import { updateCard } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await updateCard(id, { status: "confirmed" });
  return NextResponse.json({ ok: true });
}
