import fs from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const out = {};
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv();
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("MISSING_SUPABASE");
  process.exit(1);
}

const { DEFAULT_CONTRACT_TEMPLATES } = await import("../src/lib/contracts.ts");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { count, error: cErr } = await db.from("contract_templates").select("id", { count: "exact", head: true });
if (cErr) {
  console.error("COUNT_FAIL");
  process.exit(1);
}
if ((count ?? 0) > 0) {
  console.log(`ALREADY_SEEDED count=${count}`);
  process.exit(0);
}

const { error } = await db.from("contract_templates").insert(
  DEFAULT_CONTRACT_TEMPLATES.map((t) => ({
    name: t.name,
    contract_type: t.contract_type,
    template_content: t.template_content,
    variables: t.variables,
    is_active: true,
  })),
);
if (error) {
  console.error("INSERT_FAIL");
  process.exit(1);
}
console.log(`SEEDED count=${DEFAULT_CONTRACT_TEMPLATES.length}`);
