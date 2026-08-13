export type AiChatRequest = {
  model?: string;
  messages: unknown[];
  tools?: unknown[];
  temperature?: number;
};

export type AiProviderConfig = {
  id: string;
  url: string;
  key: string;
  model: string;
};

const FALLBACK_STATUSES = new Set([401, 402, 403, 429, 500, 502, 503, 504]);

/** All configured providers in priority order (gateway first — avoids Gemini free-tier 429). */
export function listAiProviders(): AiProviderConfig[] {
  const providers: AiProviderConfig[] = [];

  const gatewayKey =
    process.env.AI_GATEWAY_KEY ??
    process.env.VERCEL_AI_GATEWAY_KEY ??
    process.env.AI_GATEWAY_API_KEY;
  if (gatewayKey) {
    providers.push({
      id: "vercel-gateway",
      url: process.env.AI_GATEWAY_URL ?? "https://ai-gateway.vercel.sh/v1/chat/completions",
      key: gatewayKey,
      model: process.env.AI_GATEWAY_MODEL ?? "openai/gpt-4o-mini",
    });
  }

  const openai = process.env.OPENAI_API_KEY;
  if (openai) {
    providers.push({
      id: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      key: openai,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    });
  }

  const gemini = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (gemini) {
    providers.push({
      id: "gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: gemini,
      model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    });
  }

  // Dev-only fallback: if LOVABLE_API_KEY is set (Lovable preview sandbox),
  // use its OpenAI-compatible gateway. Zero code coupling — plain fetch over
  // an env var. On Vercel production this branch is inert unless the key is set.
  const lovable = process.env.LOVABLE_API_KEY;
  if (lovable) {
    providers.push({
      id: "lovable-gateway",
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: lovable,
      model: process.env.LOVABLE_MODEL ?? "google/gemini-2.5-flash",
    });
  }

  return providers;
}

export function resolveAiProvider(): AiProviderConfig | null {
  return listAiProviders()[0] ?? null;
}

async function callProvider(provider: AiProviderConfig, body: AiChatRequest): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider.id === "lovable-gateway") {
    headers["Lovable-API-Key"] = provider.key;
  } else {
    headers["Authorization"] = `Bearer ${provider.key}`;
  }
  return fetch(provider.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: body.model ?? provider.model,
      messages: body.messages,
      tools: body.tools,
      temperature: body.temperature ?? 0.4,
    }),
  });
}

export async function aiChatCompletions(body: AiChatRequest): Promise<Response> {
  const providers = listAiProviders();
  if (providers.length === 0) {
    throw new Error("AI не е конфигуриран — задайте OPENAI_API_KEY, GEMINI_API_KEY или AI_GATEWAY_KEY в Vercel.");
  }

  let last: Response | null = null;
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const res = await callProvider(provider, body);
    if (res.ok) return res;

    const text = await res.text();
    last = new Response(text, { status: res.status, statusText: res.statusText });

    const hasFallback = i < providers.length - 1;
    if (hasFallback && FALLBACK_STATUSES.has(res.status)) {
      console.warn(`[ai-provider] ${provider.id} HTTP ${res.status}, trying fallback`);
      continue;
    }
    return last;
  }
  return last!;
}
