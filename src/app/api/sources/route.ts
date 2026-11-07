import { NextResponse } from "next/server";
import { listSources } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ sources: await listSources() });
}
