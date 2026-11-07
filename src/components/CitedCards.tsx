"use client";
import type { Card, Source } from "@/lib/types";
import { CardView, SourceView } from "./ui";

// 根拠の知識カードと、その元の投稿・資料を開いて見せる
export function CitedCards({
  cards,
  sourceById,
  label,
}: {
  cards: Card[];
  sourceById: Map<string, Source>;
  label?: string;
}) {
  if (cards.length === 0) return null;
  return (
    <details className="space-y-2">
      <summary className="cursor-pointer text-sm font-medium text-stone-600">{label ?? `根拠の知識カード（${cards.length}枚）と元の投稿`}</summary>
      <div className="mt-2 space-y-3">
        {cards.map((c) => (
          <div key={c.id} className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
            <CardView card={c} />
            {c.sourceIds.map((sid) => {
              const s = sourceById.get(sid);
              return s ? <SourceView key={sid} source={s} /> : null;
            })}
          </div>
        ))}
      </div>
    </details>
  );
}
