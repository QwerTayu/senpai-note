import { PROFILE_DEPARTMENTS, type Profile } from "./types";

// 登録の内容は cookie に持つ（ログインは作らない）。middleware とサーバーの両方から読むので、
// サーバー専用の import をしない
export const PROFILE_COOKIE = "senpai_note_profile";

export function encodeProfile(p: Profile): string {
  return encodeURIComponent(JSON.stringify(p));
}

export function parseProfile(value: string | undefined): Profile | null {
  if (!value) return null;
  try {
    const p = JSON.parse(decodeURIComponent(value)) as Partial<Profile>;
    if (p.role !== "current" && p.role !== "previous") return null;
    if (typeof p.generation !== "number" || p.generation < 2000 || p.generation > 2100) return null;
    if (!PROFILE_DEPARTMENTS.includes(p.department as Profile["department"])) return null;
    if (typeof p.name !== "string" || !p.name.trim() || p.name.length > 40) return null;
    return { role: p.role, generation: p.generation, department: p.department as Profile["department"], name: p.name.trim() };
  } catch {
    return null;
  }
}

export function homeOf(p: Profile): string {
  return p.role === "current" ? "/kouhai" : "/senpai";
}
