import { NextResponse } from "next/server";
import { z } from "zod";
import { createPlanItem } from "@/lib/db";
import { requireProfile } from "@/lib/profile";
import { PLAN_DEPARTMENTS, profileLabel } from "@/lib/types";

const input = z.object({
  title: z.string().trim().min(1).max(100),
  detail: z.string().trim().max(500).default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  department: z.enum(PLAN_DEPARTMENTS),
});

// 現役の代が、計画に項目を足す
export async function POST(req: Request) {
  const auth = await requireProfile("current");
  if ("error" in auth) return auth.error;
  const parsed = input.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "項目の内容が正しくありません" }, { status: 400 });
  const id = await createPlanItem({
    ...parsed.data,
    generation: auth.profile.generation,
    cardIds: [],
    origin: "added",
    done: false,
    memo: null,
    dateChangeReason: null,
    originalDate: null,
    updatedBy: profileLabel(auth.profile),
  });
  return NextResponse.json({ id });
}
