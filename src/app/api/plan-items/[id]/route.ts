import { NextResponse } from "next/server";
import { z } from "zod";
import { deletePlanItem, getPlanItem, updatePlanItem, upsertPlanSource } from "@/lib/db";
import { requireProfile } from "@/lib/profile";
import { profileLabel, type PlanItem } from "@/lib/types";

const patchInput = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateChangeReason: z.string().trim().max(500).optional(),
  done: z.boolean().optional(),
  memo: z.string().trim().max(1000).nullable().optional(),
});

async function loadOwnItem(id: string, generation: number) {
  const item = await getPlanItem(id);
  if (!item) return { error: NextResponse.json({ error: "not found" }, { status: 404 }) };
  if (item.generation !== generation) return { error: NextResponse.json({ error: "自分の代の計画だけを直せます" }, { status: 403 }) };
  return { item };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProfile("current");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const loaded = await loadOwnItem(id, auth.profile.generation);
  if ("error" in loaded) return loaded.error;
  const parsed = patchInput.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "内容が正しくありません" }, { status: 400 });
  const input = parsed.data;
  const item = loaded.item;

  const patch: Partial<PlanItem> = { updatedBy: profileLabel(auth.profile) };
  if (input.title !== undefined) patch.title = input.title;
  if (input.done !== undefined) patch.done = input.done;
  if (input.memo !== undefined) patch.memo = input.memo || null;
  if (input.date !== undefined && input.date !== item.date) {
    // 日付を変えるときは理由が要る（次の代の知識になる）
    if (!input.dateChangeReason) return NextResponse.json({ error: "日付を変えた理由を書いてください" }, { status: 400 });
    patch.date = input.date;
    patch.dateChangeReason = input.dateChangeReason;
    patch.originalDate = item.originalDate ?? item.date;
  }
  await updatePlanItem(id, patch);

  // 日付を変えた理由とふりかえりは、次の代の取り込み元にする
  const updated = { ...item, ...patch };
  const changed = patch.date !== undefined || patch.memo !== undefined || patch.done !== undefined;
  if (changed && (updated.memo || updated.dateChangeReason)) await upsertPlanSource(updated, profileLabel(auth.profile));
  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProfile("current");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const loaded = await loadOwnItem(id, auth.profile.generation);
  if ("error" in loaded) return loaded.error;
  await deletePlanItem(id);
  return NextResponse.json({ ok: true });
}
