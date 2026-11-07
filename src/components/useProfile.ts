"use client";
import { useEffect, useState } from "react";
import type { Profile } from "@/lib/types";

// 登録の内容（cookie）をサーバーから読む。読み込み中は undefined
export function useProfile(): Profile | null | undefined {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : { profile: null }))
      .then((d: { profile: Profile | null }) => setProfile(d.profile))
      .catch(() => setProfile(null));
  }, []);
  return profile;
}
