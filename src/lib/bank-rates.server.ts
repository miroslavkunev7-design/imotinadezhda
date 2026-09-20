// Автоматично дневно обновяване на лихвите по банки (доход от България / от чужбина).
// Без зависимост от Lovable: Supabase + Firecrawl за четене на банковите страници +
// конфигуриран AI провайдър за извличане на числата от текста.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatCompletions, listAiProviders } from "@/lib/ai-provider";

const db = () =>
  supabaseAdmin as unknown as {
    from: (t: string) => any;
    rpc: (fn: string, args?: unknown) => any;
  };

const JOB_KEY = "bank_rates_sweep";
const LEASE_SECONDS = 600;
/** Ръчно въведена оферта от клон не се презаписва от автоматиката. */
const MANUAL_SOURCES = new Set(["branch_offer", "manual"]);
const CITY_SLUGS = ["shumen", "varna", "burgas"];

export type BankRateSource = { bank: string; url: string; enabled: boolean; note: string | null };

export type SweepBankResult = {
  bank: string;
  ok: boolean;
  rate_bg: number | null;
  rate_foreign: number | null;
  cities_updated: number;
  skipped_manual: number;
  error: string | null;
};

export type SweepResult = {
  claimed: boolean;
  day: string;
  banks: SweepBankResult[];
};

function today(): string {
  // Ден по българско време — за да не се записва „вчерашна“ дата при нощен cron.
  return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function num(v: unknown): number | null {
  const n = Number(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  if (n <= 0 || n > 30) return null;
  return Math.round(n * 100) / 100;
}

function safeJson(text: string): any | null {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Извлича markdown от страницата на банката. */
async function readBankPage(url: string): Promise<string> {
  const { createFirecrawlClient } = await import("@/server/scraper-firecrawl");
  const fc = createFirecrawlClient();
  const result: any = await fc.scrape(url, { formats: ["markdown"] as any, onlyMainContent: true });
  const md = typeof result?.markdown === "string" ? result.markdown : "";
  if (!md.trim()) throw new Error("Страницата не върна текст");
  return md.slice(0, 30000);
}

/** Пита AI за двете лихви; връща null когато страницата не съдържа ясна стойност. */
async function extractRates(
  bank: string,
  url: string,
  markdown: string,
): Promise<{ rate_bg: number | null; rate_foreign: number | null }> {
  if (listAiProviders().length === 0) throw new Error("AI провайдър не е конфигуриран");

  const res = await aiChatCompletions({
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "Ти извличаш годишни лихвени проценти за ипотечен/жилищен кредит от текст на банков сайт. " +
          "Отговаряш само с валиден JSON. Никога не измисляш числа — ако стойността не се вижда в текста, връщаш null.",
      },
      {
        role: "user",
        content: [
          `Банка: ${bank}`,
          `Източник: ${url}`,
          "",
          "Върни JSON: {\"rate_bg\": число или null, \"rate_foreign\": число или null}",
          "rate_bg = минималният обявен годишен лихвен процент по жилищен/ипотечен кредит в евро при доход от България.",
          "Приемай и формулировки като „лихва от X%“, „индикативен лихвен процент X%“, „променлив лихвен процент X%“, „фиксиран лихвен процент X%“, както и най-ниската стойност в таблица или калкулатор на страницата.",
          "НЕ връщай отделните компоненти РЛП или фиксирана надбавка, ГПР, лихви по потребителски/кредитни карти, такси или проценти на самоучастие/финансиране (LTV).",
          "rate_foreign = обявеният годишен лихвен процент при доход от чужбина (ако банката обявява отделно условие; иначе null).",
          "Числата са в проценти, например 2.45.",
          "Ако в текста има няколко валидни лихвени процента за жилищен/ипотечен кредит, върни НАЙ-НИСКИЯ от тях (обикновено променливата лихва), а не фиксираната за първите години.",
          "",
          "ТЕКСТ:",
          markdown,
        ].join("\n"),
      },
    ],
  });

  if (!res.ok) throw new Error(`AI HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as any;
  const parsed = safeJson(String(json?.choices?.[0]?.message?.content ?? ""));
  if (!parsed) throw new Error("AI не върна валиден JSON");
  return { rate_bg: num(parsed.rate_bg), rate_foreign: num(parsed.rate_foreign) };
}

/** Последната валидна лихва за банка+град преди/на деня. */
async function lastRate(bank: string, city: string, day: string) {
  const { data } = await db()
    .from("bank_branch_rates")
    .select("rate_bg, rate_foreign, valid_from, source")
    .eq("bank", bank)
    .eq("city_slug", city)
    .lte("valid_from", day)
    .order("valid_from", { ascending: false })
    .limit(1);
  return (data ?? [])[0] ?? null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function updateBank(src: BankRateSource, day: string): Promise<SweepBankResult> {
  const base: SweepBankResult = {
    bank: src.bank,
    ok: false,
    rate_bg: null,
    rate_foreign: null,
    cities_updated: 0,
    skipped_manual: 0,
    error: null,
  };

  let excerpt = "";
  try {
    let markdown = "";
    // Четецът има лимит на минута — при лимит изчакваме и опитваме отново.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        markdown = await readBankPage(src.url);
        break;
      } catch (e) {
        const msg = (e as Error).message;
        if (attempt === 2 || !/rate limit/i.test(msg)) throw e;
        await sleep(20000);
      }
    }
    excerpt = markdown.slice(0, 500);
    const { rate_bg, rate_foreign } = await extractRates(src.bank, src.url, markdown);
    base.rate_bg = rate_bg;
    base.rate_foreign = rate_foreign;

    if (rate_bg === null) throw new Error("В страницата няма ясно обявена лихва");

    for (const city of CITY_SLUGS) {
      const existing = await lastRate(src.bank, city, day);
      // Ръчна оферта от клона за същия ден има приоритет.
      if (existing && existing.valid_from === day && MANUAL_SOURCES.has(existing.source ?? "")) {
        base.skipped_manual += 1;
        continue;
      }
      const foreign = rate_foreign ?? (existing ? Number(existing.rate_foreign) : null) ?? rate_bg;
      // Нищо не се пише, когато числата не се променят — пази историята чиста.
      if (
        existing &&
        Number(existing.rate_bg) === rate_bg &&
        Number(existing.rate_foreign) === foreign
      ) {
        continue;
      }
      const { error } = await db()
        .from("bank_branch_rates")
        .upsert(
          {
            bank: src.bank,
            city_slug: city,
            rate_bg,
            rate_foreign: foreign,
            valid_from: day,
            source: "auto_scrape",
            updated_by_name: "Автоматично от сайта на банката",
          },
          { onConflict: "bank,city_slug,valid_from" },
        );
      if (error) throw new Error(error.message);
      base.cities_updated += 1;
    }

    base.ok = true;
  } catch (e) {
    base.error = (e as Error).message.slice(0, 400);
  }

  await db()
    .from("bank_rate_fetch_log")
    .insert({
      bank: src.bank,
      url: src.url,
      ok: base.ok,
      rate_bg: base.rate_bg,
      rate_foreign: base.rate_foreign,
      cities_updated: base.cities_updated,
      skipped_manual: base.skipped_manual,
      error: base.error,
      excerpt: excerpt || null,
    });

  return base;
}

/**
 * Дневният пас: чете сайтовете на всички включени банки и записва днешната лихва.
 * `force` пропуска lease-а (използва се от бутона „Обнови сега“ в CRM).
 */
export async function runBankRateSweep(opts: { force?: boolean; bank?: string } = {}) {
  const day = today();

  if (!opts.force) {
    const { data: claimed } = await db().rpc("claim_automation_job", {
      _key: JOB_KEY,
      _lease_seconds: LEASE_SECONDS,
    });
    if (claimed !== true) return { claimed: false, day, banks: [] } satisfies SweepResult;
  }

  let q = db().from("bank_rate_sources").select("bank, url, enabled, note").eq("enabled", true);
  if (opts.bank) q = q.eq("bank", opts.bank);
  const { data: sources, error } = await q;
  if (error) throw new Error(error.message);

  const banks: SweepBankResult[] = [];
  for (const src of (sources ?? []) as BankRateSource[]) {
    if (banks.length > 0) await sleep(7000);
    banks.push(await updateBank(src, day));
  }

  return { claimed: true, day, banks } satisfies SweepResult;
}
