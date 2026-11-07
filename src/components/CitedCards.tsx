"use client";
import type { Card, Source } from "@/lib/types";
import { Icon } from "./Icon";
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
    <details className="group">
      <summary className="btn-text cursor-pointer list-none">
        <Icon name="source" size={16} />
        <span className="group-open:hidden">{label ?? `根拠の知識カード（${cards.length}枚）と元の投稿を見る`}</span>
        <span className="hidden group-open:inline">根拠を閉じる</span>
      </summary>
      <div className="mt-3 space-y-3">
        {cards.map((c) => (
          <div key={c.id} className="space-y-3 rounded-[8px] bg-paper p-4">
            <CardView card={c} />
            {c.sourceIds.length > 0 && (
              <div className="space-y-3 border-t border-rule pt-3">
                {c.sourceIds.map((sid) => {
                  const s = sourceById.get(sid);
                  return s ? <SourceView key={sid} source={s} /> : null;
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
