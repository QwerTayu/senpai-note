import { NextResponse } from "next/server";
import { z } from "zod";
import { getGeneration, registerGeneration } from "@/lib/db";
import { requireProfile } from "@/lib/profile";
import { profileLabel } from "@/lib/types";

export const dynamic = "force-dynamic";

// 登録の画面から呼ぶので、GET は登録がなくても読める
export async function GET(_req: Request, { params }: { params: Promise<{ year: string }> }) {
  const year = Number((await params).year);
  if (!Number.isInteger(year)) return NextResponse.json({ error: "年が正しくありません" }, { status: 400 });
  return NextResponse.json({ generation: await getGeneration(year) });
}

// 本番の日を入れる。その代で最初に入れた人のものだけが残る
export async function POST(req: Request, { params }: { params: Promise<{ year: string }> }) {
  const auth = await requireProfile("current");
  if ("error" in auth) return auth.error;
  const year = Number((await params).year);
  if (year !== auth.profile.generation) return NextResponse.json({ error: "自分の代の本番の日だけを入れられます" }, { status: 403 });
  const parsed = z
    .object({ festivalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
    .safeParse(await req.json());
  if (!parsed.success || !parsed.data.festivalDate.startsWith(String(year))) {
    return NextResponse.json({ error: `本番の日は ${year} 年の日付にしてください` }, { status: 400 });
  }
  return NextResponse.json({ generation: await registerGeneration(year, parsed.data.festivalDate, profileLabel(auth.profile)) });
}
