"use client";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";
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

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// YYYY-MM-DD を「9/11（土）」にする
export function formatYmd(ymd: string, withYear = false) {
  const [y, m, d] = ymd.split("-").map(Number);
  const w = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${withYear ? `${y}年` : ""}${m}/${d}（${w}）`;
}

export function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(y, m - 1, d + days);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export function daysBetween(fromYmd: string, toYmd: string) {
  const [a, b] = [fromYmd, toYmd].map((v) => {
    const [y, m, d] = v.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86400000);
}

export function KindBadge({ kind }: { kind: Card["kind"] }) {
  return <span className="tag">{CARD_KIND_LABEL[kind]}</span>;
}

export function StatusBadge({ status }: { status: Card["status"] }) {
  return status === "confirmed" ? <span className="tag tag-pen">先輩が確認済み</span> : <span className="tag">確認待ち</span>;
}

export function GenerationBadge({ generation }: { generation: number }) {
  return <span className="tag">{generation}年度の代</span>;
}

export function CardView({ card }: { card: Card }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <KindBadge kind={card.kind} />
        <StatusBadge status={card.status} />
        <GenerationBadge generation={card.generation} />
      </div>
      <h3 className="text-lg font-bold leading-snug">{card.title}</h3>
      <dl className="grid grid-cols-[4em_1fr] gap-x-3 gap-y-2 text-sm">
        {card.when && (
          <>
            <dt className="text-pencil">いつ</dt>
            <dd>{card.when}</dd>
          </>
        )}
        <dt className="text-pencil">なにを</dt>
        <dd className="whitespace-pre-wrap">{card.body}</dd>
        <dt className="text-pencil">なぜ</dt>
        <dd>{card.why ? card.why : <span className="text-pen">理由がまだわかりません</span>}</dd>
      </dl>
      {card.confirmedBy && <p className="text-xs text-pencil">確かめた先輩: {card.confirmedBy}</p>}
    </div>
  );
}

export function SourceView({ source }: { source: Source }) {
  return (
    <div className="border-l-2 border-rule py-1 pl-4 text-sm">
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-pencil">
        <span className="tag">{SOURCE_KIND_LABEL[source.kind]}</span>
        <span className="font-bold text-ink-soft">{source.title}</span>
        <span>{source.author}</span>
        <span>{formatDate(source.postedAt)}</span>
      </div>
      <SourceBody source={source} />
    </div>
  );
}

// Drive・Notion の資料はマークダウンで書かれているので解釈して出す。長い本文は途中までにし、続きを開けるようにする
function SourceBody({ source }: { source: Source }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (el) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [source.body]);
  const isDoc = source.kind === "drive" || source.kind === "notion";
  return (
    <>
      <div
        ref={ref}
        className={open ? "" : `max-h-40 overflow-hidden ${overflows ? "[mask-image:linear-gradient(to_bottom,black_70%,transparent)]" : ""}`}
      >
        {isDoc ? <Markdown>{source.body}</Markdown> : <p className="whitespace-pre-wrap">{source.body}</p>}
      </div>
      {overflows && (
        <button type="button" onClick={() => setOpen(!open)} className="btn-text mt-1 text-xs">
          {open ? "たたむ" : "続きを読む"}
        </button>
      )}
    </>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-pencil">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-rule border-t-ink" />
      {label}
    </div>
  );
}
