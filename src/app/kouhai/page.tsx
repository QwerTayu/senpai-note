"use client";
import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { AskTab } from "@/components/kouhai/AskTab";
import { PlanTab } from "@/components/kouhai/PlanTab";
import { api, Spinner } from "@/components/ui";
import { useProfile } from "@/components/useProfile";
import type { Card, Source } from "@/lib/types";

type Tab = "plan" | "ask";

export default function KouhaiPage() {
  const profile = useProfile();
  const [tab, setTab] = useState<Tab>("plan");
  const [cards, setCards] = useState<Card[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [autoGenerate, setAutoGenerate] = useState(false);

  useEffect(() => {
    // 登録の直後は ?makePlan=1 で来る。URL からは消しておく
    const params = new URLSearchParams(window.location.search);
    if (params.get("makePlan") === "1") {
      setAutoGenerate(true);
      window.history.replaceState(null, "", "/kouhai");
    }
    Promise.all([api<{ cards: Card[] }>("/api/cards"), api<{ sources: Source[] }>("/api/sources")]).then(([c, s]) => {
      setCards(c.cards.filter((x) => x.status === "confirmed"));
      setSources(s.sources);
    });
  }, []);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  if (!profile) return <Spinner label="読み込み中" />;

  return (
    <div className="space-y-8">
      <div data-tour="tabs" role="tablist" className="flex gap-6 border-b border-rule">
        <TabButton active={tab === "plan"} onClick={() => setTab("plan")} label="今年の計画" icon="calendar" />
        <span data-tour="ask-tab">
          <TabButton active={tab === "ask"} onClick={() => setTab("ask")} label="質問する" icon="agent" />
        </span>
      </div>
      {tab === "plan" ? (
        <PlanTab profile={profile} cardById={cardById} sourceById={sourceById} autoGenerate={autoGenerate} />
      ) : (
        <AskTab cards={cards} sourceById={sourceById} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: IconName }) {
  return (
    <button role="tab" aria-selected={active} onClick={onClick} className="tab -mb-px">
      <Icon name={icon} size={20} />
      {label}
    </button>
  );
}
