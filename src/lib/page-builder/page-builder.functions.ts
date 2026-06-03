import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAGE_SLUGS = ["home", "about", "cities", "properties", "brokers", "contact"] as const;
export type PageSlug = (typeof PAGE_SLUGS)[number];

const blockSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.string().min(1).max(64).regex(/^[a-z0-9._-]+$/),
  props: z.record(z.string(), z.any()),
});

const layoutSchema = z.object({
  blocks: z.array(blockSchema).max(200),
  theme: z.record(z.string(), z.string()).optional().default({}),
});

const pageSlugSchema = z.enum(PAGE_SLUGS);

// PUBLIC — read published design for a page
export const getPublicPageDesign = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ page_slug: pageSlugSchema }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("page_designs")
      .select("id,layout_json,updated_at")
      .eq("page_slug", data.page_slug)
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const parsed = layoutSchema.safeParse(row.layout_json);
    return parsed.success ? { id: row.id, layout: parsed.data } : null;
  });

// ADMIN — get the draft (latest) design for a page
export const getDesign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ page_slug: pageSlugSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("page_designs")
      .select("id,page_slug,name,layout_json,is_published,updated_at")
      .eq("page_slug", data.page_slug)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const parsed = layoutSchema.safeParse(row.layout_json);
    return {
      id: row.id,
      page_slug: row.page_slug as PageSlug,
      name: row.name,
      is_published: row.is_published,
      updated_at: row.updated_at,
      layout: parsed.success ? parsed.data : { blocks: [], theme: {} },
    };
  });

// ADMIN — save (create or update) the design
export const saveDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        page_slug: pageSlugSchema,
        name: z.string().min(1).max(120).optional(),
        layout: layoutSchema,
        publish: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.id) {
      // save revision snapshot of previous
      const { data: prev } = await supabase
        .from("page_designs")
        .select("layout_json")
        .eq("id", data.id)
        .maybeSingle();
      if (prev?.layout_json) {
        await supabase.from("design_revisions").insert({
          page_design_id: data.id,
          layout_json: prev.layout_json,
          created_by: userId,
        });
      }
      const { data: row, error } = await supabase
        .from("page_designs")
        .update({
          layout_json: data.layout,
          name: data.name ?? undefined,
          is_published: data.publish ?? undefined,
        })
        .eq("id", data.id)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id };
    } else {
      const { data: row, error } = await supabase
        .from("page_designs")
        .insert({
          page_slug: data.page_slug,
          name: data.name ?? "Дизайн",
          layout_json: data.layout,
          is_published: data.publish ?? false,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id };
    }
  });

// ADMIN — publish / unpublish
export const publishDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), publish: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.publish) {
      // unpublish other designs for the same page
      const { data: target } = await supabase
        .from("page_designs")
        .select("page_slug")
        .eq("id", data.id)
        .single();
      if (target) {
        await supabase
          .from("page_designs")
          .update({ is_published: false })
          .eq("page_slug", target.page_slug)
          .neq("id", data.id);
      }
    }
    const { error } = await supabase
      .from("page_designs")
      .update({ is_published: data.publish })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ADMIN — reset (delete the design — public falls back to default)
export const deleteDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("page_designs")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ADMIN — scrape a reference URL with Firecrawl
export const scrapeReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        url: z.string().url().max(500),
        mode: z.enum(["similar", "clone"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY е липсва. Свържи Firecrawl в Connectors.");
    const { default: Firecrawl } = await import("@mendable/firecrawl-js");
    const fc = new Firecrawl({ apiKey });

    const formats =
      data.mode === "clone"
        ? (["html", "markdown", "branding", "screenshot"] as const)
        : (["branding", "screenshot", "markdown"] as const);

    const result: any = await fc.scrape(data.url, {
      formats: formats as any,
      onlyMainContent: false,
    });

    return {
      url: data.url,
      mode: data.mode,
      branding: result.branding ?? null,
      screenshot: result.screenshot ?? null,
      markdown: typeof result.markdown === "string" ? result.markdown.slice(0, 20000) : null,
      html: typeof result.html === "string" ? result.html.slice(0, 60000) : null,
      title: result.metadata?.title ?? null,
    };
  });

// ADMIN — call Lovable AI to convert scraped reference into a layout_json
export const generateFromReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        mode: z.enum(["similar", "clone"]),
        page_slug: pageSlugSchema,
        scraped: z.object({
          url: z.string(),
          branding: z.any().optional().nullable(),
          markdown: z.string().nullable().optional(),
          html: z.string().nullable().optional(),
          title: z.string().nullable().optional(),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY не е конфигуриран.");

    // import block registry definitions for the prompt
    const { BLOCK_REGISTRY } = await import("./blocks");
    const blockCatalog = BLOCK_REGISTRY.map((b) => ({
      type: b.type,
      label: b.label,
      category: b.category,
      props: Object.keys(b.defaults),
    }));

    const branding = data.scraped.branding ?? {};
    const colors = branding.colors ?? {};
    const fonts = branding.fonts ?? [];

    const userPrompt = `
Ти си експерт по уеб дизайн. Имам референтна страница и каталог от готови блокове.
Трябва да върнеш JSON layout, който възпроизвежда визията използвайки САМО блокове от каталога.

Режим: ${data.mode === "clone" ? "1:1 КОПИЕ (опитай максимално близко)" : "ПОДОБЕН ДИЗАЙН (вдъхновение, не точно копие)"}
Страница: ${data.page_slug}
URL: ${data.scraped.url}
Заглавие на референцията: ${data.scraped.title ?? ""}

Брандиране от референцията:
- Цветове: ${JSON.stringify(colors)}
- Шрифтове: ${JSON.stringify(fonts)}
- Лого / favicon: ${JSON.stringify(branding.images ?? {})}

Markdown съдържание (съкратено):
${(data.scraped.markdown ?? "").slice(0, 4000)}

Каталог блокове (използвай САМО тези типове):
${JSON.stringify(blockCatalog, null, 2)}

Върни JSON със следната структура (никакъв друг текст):
{
  "blocks": [
    { "type": "navbar.simple", "props": { ...полета от каталога... } },
    ...
  ]
}

Правила:
- Подреди блокове в логичен ред: navbar отгоре, после hero, секции, CTA, footer най-долу.
- За цветове използвай палитрата от branding (primary, secondary, background, text).
- За texts използвай реалното съдържание от markdown ако е смислено, иначе генерирай подходящи на български.
- Минимум 4 блока, максимум 12.
`.trim();

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content:
              "Връщаш САМО валиден JSON. Никакъв друг текст. Никакви markdown code fences.",
          },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) throw new Error("AI rate limit. Опитай след минута.");
      if (aiRes.status === 402)
        throw new Error("Изчерпани AI кредити. Добави кредити в Workspace settings.");
      throw new Error(`AI грешка ${aiRes.status}: ${txt.slice(0, 200)}`);
    }

    const json = await aiRes.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI върна невалиден JSON.");
    }

    // sanity check
    const blocks: any[] = Array.isArray(parsed.blocks) ? parsed.blocks : [];
    const valid = blocks
      .filter((b) => b && typeof b === "object" && typeof b.type === "string")
      .slice(0, 20)
      .map((b: any) => ({
        id: Math.random().toString(36).slice(2, 10),
        type: b.type,
        props: typeof b.props === "object" && b.props ? b.props : {},
      }));

    return {
      layout: {
        blocks: valid,
        theme: {
          primary: colors.primary ?? "#8B1A2B",
          accent: colors.accent ?? colors.secondary ?? "#C9A84C",
          bg: colors.background ?? "#ffffff",
          fg: colors.textPrimary ?? "#2b1418",
        },
      },
    };
  });
