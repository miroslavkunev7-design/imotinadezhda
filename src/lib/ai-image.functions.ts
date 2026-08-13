import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

type ImageProvider = { id: string; url: string; key: string; model: string; header: "bearer" | "lovable" };

/** Всички конфигурирани доставчици за генериране на изображения (без зависимост от Lovable в продукция). */
function listImageProviders(): ImageProvider[] {
  const out: ImageProvider[] = [];

  const openai = process.env["OPENAI_API_KEY"];
  if (openai) {
    out.push({
      id: "openai",
      url: "https://api.openai.com/v1/images/generations",
      key: openai,
      model: process.env["OPENAI_IMAGE_MODEL"] ?? "gpt-image-1",
      header: "bearer",
    });
  }

  const gatewayKey =
    process.env["AI_GATEWAY_KEY"] ?? process.env["VERCEL_AI_GATEWAY_KEY"] ?? process.env["AI_GATEWAY_API_KEY"];
  if (gatewayKey) {
    out.push({
      id: "vercel-gateway",
      url: process.env["AI_GATEWAY_IMAGE_URL"] ?? "https://ai-gateway.vercel.sh/v1/images/generations",
      key: gatewayKey,
      model: process.env["AI_GATEWAY_IMAGE_MODEL"] ?? "openai/gpt-image-1",
      header: "bearer",
    });
  }

  const lovable = process.env["LOVABLE_API_KEY"];
  if (lovable) {
    out.push({
      id: "lovable-gateway",
      url: "https://ai.gateway.lovable.dev/v1/images/generations",
      key: lovable,
      model: process.env["LOVABLE_IMAGE_MODEL"] ?? "openai/gpt-image-2",
      header: "lovable",
    });
  }

  return out;
}

const inputSchema = z.object({
  prompt: z.string().min(3).max(2000),
  size: z.enum(["1024x1024", "1536x1024", "1024x1536"]).default("1024x1024"),
});

/** Генерира изображение по текстово указание и връща data URL (PNG). */
export const generateAiImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(
      context.userId,
      context.supabase,
      (context.claims as { email?: string } | undefined)?.email ?? null,
    );

    const providers = listImageProviders();
    if (providers.length === 0) {
      throw new Error(
        "Генерирането на изображения не е конфигурирано — задайте OPENAI_API_KEY или AI_GATEWAY_KEY.",
      );
    }

    let lastError = "";
    for (const p of providers) {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (p.header === "lovable") headers["Lovable-API-Key"] = p.key;
      else headers["Authorization"] = `Bearer ${p.key}`;

      const res = await fetch(p.url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: p.model,
          prompt: data.prompt,
          size: data.size,
          n: 1,
          quality: "low",
        }),
      });

      if (!res.ok) {
        lastError = `${p.id}: HTTP ${res.status} ${await res.text().catch(() => "")}`.slice(0, 500);
        console.warn("[ai-image]", lastError);
        continue;
      }

      const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
      const first = json.data?.[0];
      if (first?.b64_json) return { image: `data:image/png;base64,${first.b64_json}`, provider: p.id };
      if (first?.url) return { image: first.url, provider: p.id };
      lastError = `${p.id}: отговорът не съдържа изображение`;
    }

    throw new Error(`Генерирането се провали. ${lastError}`);
  });
