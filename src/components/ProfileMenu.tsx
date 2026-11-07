"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ROLE_LABEL } from "@/lib/types";
import { startTour } from "./Tour";
import { useProfile } from "./useProfile";

export function ProfileMenu() {
  const pathname = usePathname();
  const profile = useProfile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [open]);

  if (pathname === "/login" || pathname === "/register" || !profile) return null;

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      <button onClick={startTour} className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100">
        ？ 使い方
      </button>
      <button
        data-tour="profile-menu"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 text-sm hover:bg-stone-200"
      >
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${profile.role === "current" ? "bg-sky-600" : "bg-amber-600"}`}>
          {ROLE_LABEL[profile.role]}
        </span>
        <span className="font-medium">{profile.name}</span>
        <span className="hidden text-stone-500 sm:inline">
          {profile.generation}年度・{profile.department}
        </span>
        <span className="text-stone-400">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-stone-200 bg-white text-sm shadow-lg">
          <div className="border-b border-stone-100 px-4 py-3 text-xs text-stone-500">
            {ROLE_LABEL[profile.role]}・{profile.generation}年度の代・{profile.department}
          </div>
          <a href="/register" className="block px-4 py-2.5 hover:bg-stone-50">
            登録し直す（役・代・部門を変える）
          </a>
        </div>
      )}
    </div>
  );
}
