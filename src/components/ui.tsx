"use client";
import { CARD_KIND_LABEL, SOURCE_KIND_LABEL, type Card, type Source } from "@/lib/types";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

const KIND_COLOR: Record<Card["kind"], string> = {
  procedure: "bg-sky-100 text-sky-800",
  decision: "bg-violet-100 text-violet-800",
  exception: "bg-amber-100 text-amber-800",
  lesson: "bg-rose-100 text-rose-800",
  contact: "bg-emerald-100 text-emerald-800",
};

export function KindBadge({ kind }: { kind: Card["kind"] }) {
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${KIND_COLOR[kind]}`}>{CARD_KIND_LABEL[kind]}</span>;
}

export function StatusBadge({ status }: { status: Card["status"] }) {
  return status === "confirmed" ? (
    <span className="rounded bg-green-600 px-1.5 py-0.5 text-xs font-medium text-white">✅ 確認済み</span>
  ) : (
    <span className="rounded bg-stone-200 px-1.5 py-0.5 text-xs font-medium text-stone-700">確認待ち</span>
  );
}

export function CardView({ card }: { card: Card }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <KindBadge kind={card.kind} />
        <StatusBadge status={card.status} />
        {card.when && <span className="text-xs text-stone-500">🗓 {card.when}</span>}
      </div>
      <h3 className="text-lg font-bold leading-snug">{card.title}</h3>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{card.body}</p>
      <div className="rounded-lg bg-stone-50 px-3 py-2 text-sm">
        <span className="font-medium text-stone-500">なぜ: </span>
        {card.why ? card.why : <span className="text-amber-700">理由がまだわかりません</span>}
      </div>
    </div>
  );
}

export function SourceView({ source }: { source: Source }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
      <div className="mb-1 flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
        <span className="rounded bg-stone-100 px-1.5 py-0.5 font-medium text-stone-700">{SOURCE_KIND_LABEL[source.kind]}</span>
        <span className="font-medium text-stone-700">{source.title}</span>
        <span>{source.author}</span>
        <span>{formatDate(source.postedAt)}</span>
      </div>
      <p className="line-clamp-6 whitespace-pre-wrap leading-relaxed">{source.body}</p>
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-stone-500">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700" />
      {label}
    </div>
  );
}
