export type AiChatRequest = {
  model?: string;
  messages: unknown[];
  tools?: unknown[];
  temperature?: number;
};

export type AiProviderConfig = {
  url: string;
  key: string;
  model: string;
};

export function resolveAiProvider(): AiProviderConfig | null {
  const openai = process.env.OPENAI_API_KEY;
  if (openai) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      key: openai,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    };
  }

  const gemini = process.env.GEMINI_API_KEY;
  if (gemini) {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
      key: gemini,
      model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    };
  }

  const gateway = process.env.AI_GATEWAY_URL;
  const gatewayKey = process.env.AI_GATEWAY_KEY;
  if (gateway && gatewayKey) {
    return {
      url: gateway,
      key: gatewayKey,
      model: process.env.AI_GATEWAY_MODEL ?? "gpt-4o-mini",
    };
  }

  return null;
}

export async function aiChatCompletions(body: AiChatRequest): Promise<Response> {
  const provider = resolveAiProvider();
  if (!provider) {
    throw new Error("AI не е конфигуриран — задайте OPENAI_API_KEY, GEMINI_API_KEY или AI_GATEWAY_KEY в Vercel.");
  }

  return fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: body.model ?? provider.model,
      messages: body.messages,
      tools: body.tools,
      temperature: body.temperature ?? 0.4,
    }),
  });
}
