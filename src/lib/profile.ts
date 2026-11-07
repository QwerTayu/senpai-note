import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PROFILE_COOKIE, parseProfile } from "./profileCookie";
import type { Profile, Role } from "./types";

export async function getProfile(): Promise<Profile | null> {
  return parseProfile((await cookies()).get(PROFILE_COOKIE)?.value);
}

// Route Handler で使う。登録がないか、役が違えばエラーのレスポンスを返す
export async function requireProfile(role?: Role): Promise<{ profile: Profile } | { error: NextResponse }> {
  const profile = await getProfile();
  if (!profile) return { error: NextResponse.json({ error: "登録がありません" }, { status: 401 }) };
  if (role && profile.role !== role) {
    const label = role === "current" ? "現役の代" : "前の代";
    return { error: NextResponse.json({ error: `${label}だけができる操作です` }, { status: 403 }) };
  }
  return { profile };
}
