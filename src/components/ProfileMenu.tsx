"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ROLE_LABEL } from "@/lib/types";
import { Icon } from "./Icon";
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
    <div ref={ref} className="relative flex items-center gap-4">
      <button onClick={startTour} className="btn-text">
        <Icon name="help" />
        使い方
      </button>
      <button
        data-tour="profile-menu"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-[4px] border border-rule px-3 py-1 text-sm hover:border-pencil"
      >
        <span className={`tag ${profile.role === "current" ? "tag-ink" : "tag-pen"}`}>{ROLE_LABEL[profile.role]}</span>
        <span className="font-bold">{profile.name}</span>
        <span className="hidden text-pencil sm:inline">
          {profile.generation}年度・{profile.department}
        </span>
        <Icon name="expand" className="text-pencil" />
      </button>
      {open && (
        <div className="page absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden text-sm shadow-[0_8px_24px_rgba(29,43,68,0.12)]">
          <div className="border-b border-rule px-4 py-3 text-xs text-pencil">
            {ROLE_LABEL[profile.role]}、{profile.generation}年度の代、{profile.department}
          </div>
          <a href="/register" className="block px-4 py-3 hover:bg-paper">
            登録し直す（役・代・部門を変える）
          </a>
        </div>
      )}
    </div>
  );
}
