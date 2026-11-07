import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export type ToolHandler = (input: Record<string, unknown>) => Promise<string>;

// Messages API のツール使用の手動ループ。返事のテキストを返す。
// 拒否されたときはサーバー側のフォールバック（fallbacks: "default"）で別のモデルが続ける。
export async function runToolLoop(opts: {
  system: Anthropic.Beta.BetaTextBlockParam[] | string;
  messages: Anthropic.Beta.BetaMessageParam[];
  tools: Anthropic.Beta.BetaTool[];
  handlers: Record<string, ToolHandler>;
  maxTurns?: number;
}): Promise<string> {
  const messages = [...opts.messages];
  const texts: string[] = [];
  for (let turn = 0; turn < (opts.maxTurns ?? 8); turn++) {
    const response = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      cache_control: { type: "ephemeral" },
      system: opts.system,
      tools: opts.tools,
      messages,
    });

    for (const block of response.content) {
      if (block.type === "text") texts.push(block.text);
    }
    if (response.stop_reason === "refusal") throw new Error("Claude が回答を断りました");
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (response.stop_reason !== "tool_use") break;

    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const handler = opts.handlers[block.name];
      try {
        if (!handler) throw new Error(`未知のツール: ${block.name}`);
        results.push({ type: "tool_result", tool_use_id: block.id, content: await handler(block.input as Record<string, unknown>) });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: block.id, content: String(e), is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return texts.join("\n").trim();
}
