import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/auth/assert-admin";

const EXPECTED_A = "185.158.133.1";
const DOMAINS = ["imotinadezhda.bg", "www.imotinadezhda.bg"];
const TXT_NAME = "_vercel.imotinadezhda.bg";

type DoHAnswer = { name: string; type: number; TTL: number; data: string };
type DoHResponse = { Status: number; Answer?: DoHAnswer[] };

async function query(provider: "cloudflare" | "google", name: string, type: "A" | "TXT"): Promise<DoHAnswer[]> {
  const url =
    provider === "cloudflare"
      ? `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`
      : `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`;
  const res = await fetch(url, { headers: { accept: "application/dns-json" } });
  if (!res.ok) return [];
  const json = (await res.json()) as DoHResponse;
  return json.Answer ?? [];
}

export type DnsCheckResult = {
  checkedAt: string;
  expectedA: string;
  records: Array<{
    name: string;
    type: "A" | "TXT";
    expected: string;
    cloudflare: string[];
    google: string[];
    ok: boolean;
  }>;
  allOk: boolean;
};

export const checkDns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DnsCheckResult> => {
  await assertAdmin(context.userId);
  const records: DnsCheckResult["records"] = [];

  for (const domain of DOMAINS) {
    const [cf, gg] = await Promise.all([query("cloudflare", domain, "A"), query("google", domain, "A")]);
    const cfVals = cf.filter((r) => r.type === 1).map((r) => r.data);
    const ggVals = gg.filter((r) => r.type === 1).map((r) => r.data);
    records.push({
      name: domain,
      type: "A",
      expected: EXPECTED_A,
      cloudflare: cfVals,
      google: ggVals,
      ok: cfVals.includes(EXPECTED_A) && ggVals.includes(EXPECTED_A),
    });
  }

  const [cfTxt, ggTxt] = await Promise.all([query("cloudflare", TXT_NAME, "TXT"), query("google", TXT_NAME, "TXT")]);
  const cfTxtVals = cfTxt.map((r) => r.data.replace(/^"|"$/g, ""));
  const ggTxtVals = ggTxt.map((r) => r.data.replace(/^"|"$/g, ""));
  records.push({
    name: TXT_NAME,
    type: "TXT",
    expected: "vercel-dns-...",
    cloudflare: cfTxtVals,
    google: ggTxtVals,
    ok: cfTxtVals.some((v) => v.startsWith("vercel-dns-")) && ggTxtVals.some((v) => v.startsWith("vercel-dns-")),
  });

  return {
    checkedAt: new Date().toISOString(),
    expectedA: EXPECTED_A,
    records,
    allOk: records.every((r) => r.ok),
  };
});
