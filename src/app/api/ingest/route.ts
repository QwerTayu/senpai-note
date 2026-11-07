import { NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest";
import { requireProfile } from "@/lib/profile";

export const maxDuration = 300;

export async function POST() {
  const auth = await requireProfile("previous");
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await runIngest());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
