import { NextResponse } from "next/server";
import { listCards } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ cards: await listCards() });
}
