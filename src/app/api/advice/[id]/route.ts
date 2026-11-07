import { NextResponse } from "next/server";
import { confirmAdvice, deleteAdvice, getAdvice } from "@/lib/db";
import { requireProfile } from "@/lib/profile";
import { profileLabel } from "@/lib/types";

// 先輩がエージェントの提案を確かめる（✅）
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProfile("previous");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const advice = await getAdvice(id);
  if (!advice || advice.kind !== "suggestion") return NextResponse.json({ error: "not found" }, { status: 404 });
  await confirmAdvice(id, profileLabel(auth.profile));
  return NextResponse.json({ ok: true });
}

// 先輩が提案を却下する
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProfile("previous");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const advice = await getAdvice(id);
  if (!advice || advice.kind !== "suggestion" || advice.status !== "draft") return NextResponse.json({ error: "not found" }, { status: 404 });
  await deleteAdvice(id);
  return NextResponse.json({ ok: true });
}
