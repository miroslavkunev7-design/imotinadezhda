import fs from "fs";

const p = "src/lib/crm.functions.ts";
let s = fs.readFileSync(p, "utf8");

const headerInsert = `import { resolveServerDb, type ServerDb } from "@/lib/supabase-server-db";
import { resolveSupabaseServiceKey } from "@/lib/supabase-env";

function authEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

type CrmCtx = { userId: string; supabase: ServerDb; claims: unknown };

function crmDb(ctx: CrmCtx) {
  return resolveServerDb(ctx.supabase);
}

function serviceAdmin() {
  if (!resolveSupabaseServiceKey()) {
    throw new Error("Липсва SUPABASE_SERVICE_ROLE_KEY — service role key е нужен за тази операция.");
  }
  return supabaseAdmin;
}

`;

if (!s.includes("function crmDb")) {
  s = s.replace(
    'import { assertAdmin, assertAdminOrOwnBroker, assertCrmAccess } from "@/lib/auth/crm-access";\n',
    'import { assertAdmin, assertAdminOrOwnBroker, assertCrmAccess } from "@/lib/auth/crm-access";\n\n' +
      headerInsert,
  );
}

s = s.replace(
  /await assertAdmin\(context\.userId\)/g,
  "await assertAdmin(context.userId, context.supabase, authEmail(context.claims))",
);
s = s.replace(
  /await assertCrmAccess\(context\.userId\)/g,
  "await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims))",
);
s = s.replace(/await supabaseAdmin\.auth\.admin\./g, "await serviceAdmin().auth.admin.");

s = s.replace(
  "async function runMatchForClient(clientId: string) {",
  "async function runMatchForClient(clientId: string, db: ServerDb) {",
);
s = s.replace(
  "async function runMatchForProperty(propertyId: string) {",
  "async function runMatchForProperty(propertyId: string, db: ServerDb) {",
);
s = s.replace("await runMatchForClient(row.id)", "await runMatchForClient(row.id, db)");
s = s.replace(
  "await runMatchForProperty(data.property_id)",
  "await runMatchForProperty(data.property_id, db)",
);

// Inject `const db = crmDb(context);` at the start of each .handler(async (...) => { block
s = s.replace(/\.handler\(async \(([^)]*)\) => \{\n/g, (match, args) => {
  if (!args.includes("context")) return match;
  return `${match}    const db = crmDb(context);\n`;
});

// Inside handler blocks, use authenticated db instead of anon admin fallback
const handlerRe = /\.handler\(async \([^)]*\) => \{[\s\S]*?\n  \}\);/g;
s = s.replace(handlerRe, (block) => block.replace(/supabaseAdmin/g, "db"));

fs.writeFileSync(p, s);
console.log("patched", p);
