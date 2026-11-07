import { NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest";

export const maxDuration = 300;

export async function POST() {
  try {
    return NextResponse.json(await runIngest());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
