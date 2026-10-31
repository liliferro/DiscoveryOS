import Anthropic from "@anthropic-ai/sdk";
export function claudeSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(claudeSchema);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  const notes: string[] = [];
  for (const [key, item] of Object.entries(value)) {
    if (
      [
        "minimum",
        "maximum",
        "minLength",
        "maxLength",
        "minItems",
        "maxItems",
        "pattern",
        "format",
      ].includes(key)
    ) {
      notes.push(`${key}: ${String(item)}`);
    } else result[key] = claudeSchema(item);
  }
  if (notes.length)
    result.description = [result.description, ...notes]
      .filter(Boolean)
      .join("; ");
  return result;
}
export async function requestClaude(
  key: string,
  model: string,
  instructions: string,
  context: string,
  schema: Record<string, unknown>,
  fetcher: typeof fetch,
) {
  const client = new Anthropic({
    apiKey: key,
    fetch: fetcher,
    maxRetries: 0,
    timeout: 25000,
  });
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 4500,
      system: instructions,
      messages: [{ role: "user", content: context }],
      output_config: {
        format: {
          type: "json_schema",
          schema: claudeSchema(schema) as Record<string, unknown>,
        },
      },
    });
    return Response.json({
      id: response.id,
      model: response.model,
      status: response.stop_reason === "end_turn" ? "completed" : "incomplete",
      usage: response.usage,
      output: [
        {
          content:
            response.stop_reason === "refusal"
              ? [{ type: "refusal" }]
              : response.content
                  .filter((block) => block.type === "text")
                  .map((block) => ({ type: "output_text", text: block.text })),
        },
      ],
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.warn("Claude request rejected", {
        status: e.status,
        requestId: e.request_id,
        message: e.message.slice(0, 1500),
      });
      const lowCredit = /credit balance|insufficient.*credit/i.test(e.message);
      return Response.json(
        {
          error: { code: lowCredit ? "insufficient_quota" : "provider_error" },
        },
        { status: lowCredit ? 402 : e.status || 502 },
      );
    }
    throw e;
  }
}
export async function verifyClaude(key: string, model: string) {
  const client = new Anthropic({ apiKey: key, maxRetries: 0, timeout: 12000 });
  await client.models.retrieve(model);
}
