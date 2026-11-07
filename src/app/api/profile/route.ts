import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/profile";
import { encodeProfile, homeOf, PROFILE_COOKIE } from "@/lib/profileCookie";
import { PROFILE_DEPARTMENTS } from "@/lib/types";

export const dynamic = "force-dynamic";

const profileInput = z.object({
  role: z.enum(["current", "previous"]),
  generation: z.number().int().min(2000).max(2100),
  department: z.enum(PROFILE_DEPARTMENTS),
  name: z.string().trim().min(1).max(40),
});

export async function GET() {
  return NextResponse.json({ profile: await getProfile() });
}

export async function POST(req: Request) {
  const parsed = profileInput.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "登録の内容が正しくありません" }, { status: 400 });
  const res = NextResponse.json({ profile: parsed.data, home: homeOf(parsed.data) });
  res.cookies.set(PROFILE_COOKIE, encodeProfile(parsed.data), { sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 365, path: "/" });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(PROFILE_COOKIE);
  return res;
}
