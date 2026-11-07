import { NextResponse } from "next/server";
import { getGeneration, listAdvice, listPlanItems } from "@/lib/db";
import { generatePlan } from "@/lib/planAgent";
import { requireProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = await requireProfile();
  if ("error" in auth) return auth.error;
  const param = new URL(req.url).searchParams.get("generation");
  const generation = param ? Number(param) : auth.profile.generation;
  const [gen, items, advice] = await Promise.all([getGeneration(generation), listPlanItems(generation), listAdvice({ generation })]);
  return NextResponse.json({ generation: gen, items, advice });
}

// 計画を作る（作り直す）。その代の計画とアドバイスは消してから作る
export async function POST() {
  const auth = await requireProfile("current");
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await generatePlan(auth.profile.generation));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
