import { NextResponse } from "next/server";
import { updateCard } from "@/lib/db";
import { requireProfile } from "@/lib/profile";
import { profileLabel } from "@/lib/types";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProfile("previous");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  await updateCard(id, { status: "confirmed", confirmedBy: profileLabel(auth.profile) });
  return NextResponse.json({ ok: true });
}
