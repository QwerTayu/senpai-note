import { NextResponse } from "next/server";
import { listAdvice, listPlanItems } from "@/lib/db";
import { requireProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

// 先輩の画面で使う。先輩の確認を待っている提案（直後の代の計画のもの）
export async function GET() {
  const auth = await requireProfile();
  if ("error" in auth) return auth.error;
  const generation = auth.profile.role === "previous" ? auth.profile.generation + 1 : auth.profile.generation;
  const [advice, items] = await Promise.all([listAdvice({ generation, status: "draft" }), listPlanItems(generation)]);
  const itemById = new Map(items.map((i) => [i.id, i]));
  return NextResponse.json({
    generation,
    suggestions: advice
      .filter((a) => a.kind === "suggestion" && itemById.has(a.planItemId))
      .map((a) => ({ ...a, planItem: itemById.get(a.planItemId) })),
  });
}
