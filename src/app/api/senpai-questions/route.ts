import { NextResponse } from "next/server";
import { listSenpaiQuestions } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ senpaiQuestions: await listSenpaiQuestions() });
}
