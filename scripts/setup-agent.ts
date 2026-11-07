// 取り込みエージェント（Managed Agents）の環境とエージェントを作る。一度だけ実行する。
// すでに INGEST_AGENT_ID があれば、エージェントの設定を更新する（新しいバージョンになる）。
// 使い方: npx tsx --env-file=.env.local scripts/setup-agent.ts
import Anthropic from "@anthropic-ai/sdk";
import { MODEL } from "../src/lib/claude";
import { INGEST_AGENT_NAME, INGEST_SYSTEM, INGEST_TOOLS } from "../src/lib/ingestAgent";

const client = new Anthropic();

async function main() {
  let environmentId = process.env.INGEST_ENVIRONMENT_ID;
  if (!environmentId) {
    const env = await client.beta.environments.create({
      name: "senpai-note-ingest-env",
      // カスタムツールしか使わないので、外には出さない
      config: { type: "cloud", networking: { type: "limited", allow_package_managers: false, allow_mcp_servers: false } },
    });
    environmentId = env.id;
  }

  const agentParams = {
    name: INGEST_AGENT_NAME,
    model: MODEL,
    system: INGEST_SYSTEM,
    tools: INGEST_TOOLS,
  };

  const existingId = process.env.INGEST_AGENT_ID;
  let agent;
  if (existingId) {
    const current = await client.beta.agents.retrieve(existingId);
    agent = await client.beta.agents.update(existingId, { ...agentParams, version: current.version });
  } else {
    agent = await client.beta.agents.create(agentParams);
  }

  console.log("次の2行を .env.local（と Vercel の環境変数）に書いてください:");
  console.log(`INGEST_ENVIRONMENT_ID=${environmentId}`);
  console.log(`INGEST_AGENT_ID=${agent.id}`);
  console.log(`(agent version ${agent.version})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
