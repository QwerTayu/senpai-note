import { anthropic } from "./claude";
import { formatCard, formatSource, handleCreateCard, handleUpdateCard } from "./cardTools";
import { listCards, listSources, markSourcesIngested } from "./db";

export interface IngestResult {
  sessionId: string | null;
  sourceCount: number;
  created: number;
  updated: number;
  report: string;
}

// 未処理の取り込み元を、Managed Agents のセッションでカードにする。
// エージェントはカスタムツール create_card / update_card を呼び、ここで Firestore に書く。
export async function runIngest(): Promise<IngestResult> {
  const agentId = process.env.INGEST_AGENT_ID;
  const environmentId = process.env.INGEST_ENVIRONMENT_ID;
  if (!agentId || !environmentId) throw new Error("INGEST_AGENT_ID / INGEST_ENVIRONMENT_ID が設定されていません（scripts/setup-agent.ts を実行）");

  const allSources = await listSources();
  const pending = allSources.filter((s) => s.ingestedAt === null);
  if (pending.length === 0) return { sessionId: null, sourceCount: 0, created: 0, updated: 0, report: "新しい取り込み元はありません" };

  const cards = await listCards();
  const knownSourceIds = new Set(allSources.map((s) => s.id));
  const client = anthropic();

  const session = await client.beta.sessions.create({
    agent: agentId,
    environment_id: environmentId,
    title: `取り込み ${new Date().toISOString()} (${pending.length}件)`,
  });

  const prompt = [
    "## 既存のカード",
    cards.length ? cards.map(formatCard).join("\n\n") : "（まだありません）",
    "",
    `## 新しい取り込み元（${pending.length}件、古い順）`,
    pending.map(formatSource).join("\n\n"),
    "",
    "新しい取り込み元から知識カードを作ってください。既存のカードと重なるものは update_card で統合してください。",
  ].join("\n");

  let created = 0;
  let updated = 0;
  const report: string[] = [];

  // stream を先に開いてからメッセージを送る
  const stream = await client.beta.sessions.events.stream(session.id);
  await client.beta.sessions.events.send(session.id, {
    events: [{ type: "user.message", content: [{ type: "text", text: prompt }] }],
  });

  const deadline = Date.now() + 280_000;
  loop: for await (const event of stream) {
    if (Date.now() > deadline) break;
    switch (event.type) {
      case "agent.message":
        for (const block of event.content) if (block.type === "text") report.push(block.text);
        break;
      case "agent.custom_tool_use": {
        let text: string;
        let isError = false;
        try {
          if (event.name === "create_card") {
            text = await handleCreateCard(event.input, knownSourceIds);
            created++;
          } else if (event.name === "update_card") {
            text = await handleUpdateCard(event.input, knownSourceIds, { backToDraft: true });
            updated++;
          } else {
            throw new Error(`未知のツール: ${event.name}`);
          }
        } catch (e) {
          text = String(e);
          isError = true;
        }
        await client.beta.sessions.events.send(session.id, {
          events: [
            {
              type: "user.custom_tool_result",
              custom_tool_use_id: event.id,
              content: [{ type: "text", text }],
              is_error: isError,
            },
          ],
        });
        break;
      }
      case "session.status_idle":
        if (event.stop_reason.type !== "requires_action") break loop;
        break;
      case "session.status_terminated":
        break loop;
      case "session.error":
        report.push(`エラー: ${JSON.stringify(event.error)}`);
        break;
    }
  }

  await markSourcesIngested(pending.map((s) => s.id));
  return { sessionId: session.id, sourceCount: pending.length, created, updated, report: report.join("\n").trim() };
}
