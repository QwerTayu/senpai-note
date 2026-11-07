"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ROLES = [
  { href: "/senpai", label: "先輩（前の代）" },
  { href: "/kouhai", label: "後輩（新しい代）" },
];

export function RoleSwitch() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <nav className="flex rounded-full bg-stone-100 p-1 text-sm">
      {ROLES.map((r) => {
        const active = pathname.startsWith(r.href);
        return (
          <Link
            key={r.href}
            href={r.href}
            className={`rounded-full px-4 py-1.5 font-medium transition ${active ? "bg-stone-900 text-white" : "text-stone-600 hover:text-stone-900"}`}
          >
            {r.label}
          </Link>
        );
      })}
    </nav>
  );
}
