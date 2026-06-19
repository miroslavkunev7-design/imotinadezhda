#!/usr/bin/env node
/** Force-set Vercel production env from .env */
import fs from "fs";
import { execSync } from "child_process";

const dotenv = {};
for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*)"?\s*$/);
  if (m) dotenv[m[1]] = m[2].trim();
}

const vars = {
  VITE_SITE_URL: "https://imotinadezhda.bg",
  SUPABASE_URL: dotenv.SUPABASE_URL,
  SUPABASE_PROJECT_ID: dotenv.SUPABASE_PROJECT_ID,
  SUPABASE_PUBLISHABLE_KEY: dotenv.SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: dotenv.SUPABASE_SERVICE_ROLE_KEY,
  VITE_SUPABASE_URL: dotenv.VITE_SUPABASE_URL,
  VITE_SUPABASE_PROJECT_ID: dotenv.VITE_SUPABASE_PROJECT_ID,
  VITE_SUPABASE_PUBLISHABLE_KEY: dotenv.VITE_SUPABASE_PUBLISHABLE_KEY,
  AI_GATEWAY_KEY: "key_rXtXgAkt0pJYquVL",
  VERCEL_AI_GATEWAY_KEY: "key_rXtXgAkt0pJYquVL",
  AI_GATEWAY_URL: "https://ai-gateway.vercel.sh/v1/chat/completions",
  AI_GATEWAY_MODEL: "openai/gpt-4o-mini",
  MARKETING_FROM_EMAIL: "no-reply@imotinadezhda.bg",
  EMAIL_FROM: "no-reply@imotinadezhda.bg",
  VAPID_SUBJECT: "mailto:agenciq_nadejdi@abv.bg",
};

for (const [name, value] of Object.entries(vars)) {
  if (!value) {
    console.log("[skip]", name);
    continue;
  }
  console.log("[set]", name);
  execSync(
    `npx vercel env add ${name} production --value "${value.replace(/"/g, '\\"')}" --yes --force --sensitive`,
    { stdio: "inherit", shell: true },
  );
}

console.log("Deploying...");
execSync("npx vercel deploy --prod --yes", { stdio: "inherit", shell: true });
console.log("Smoke test...");
execSync("node scripts/diagnose-production.mjs", { stdio: "inherit", shell: true });
