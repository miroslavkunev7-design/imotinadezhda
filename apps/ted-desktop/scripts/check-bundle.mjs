// Build gate (docs/CONTRACT.md §5): what goes into the installer must hold no secret-like string,
// no demo/sample data and no hard-coded personal name. Prints every finding and exits with 1.
//
//   node scripts/check-bundle.mjs            checks dist/ (must exist) and electron/ - both are packed into app.asar
//   node scripts/check-bundle.mjs <dir>...   checks only the given folders
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const B = "(?<![A-Za-z0-9_-])"; // left boundary: the token is not the tail of a longer word

// A real key has a long unbroken run or mixes capitals with digits; a CSS class like "sk-fade-in-200ms" has neither.
const looksLikeKey = (s) => /[A-Za-z0-9]{16,}/.test(s) || (/[A-Z]/.test(s) && /\d/.test(s));

// kind "secret": the matched text is masked in the output (CI logs of a public repository are public).
const RULES = [
  { kind: "secret", name: "service_role / SUPABASE_SERVICE_ROLE", re: /service_role/gi },
  { kind: "secret", name: "име на сървърна тайна", re: /SUPABASE_SECRET_KEY|GEMINI_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY|OPENAI_API_KEY|RESEND_API_KEY|TELEGRAM_BOT_TOKEN/g },
  { kind: "secret", name: "Supabase secret key (sb_secret_)", re: /sb_secret_/g },
  { kind: "secret", name: "ключ от вида sk-…", re: new RegExp(B + "sk-[A-Za-z0-9_-]{20,}", "g"), accept: looksLikeKey },
  { kind: "secret", name: "Google API ключ (AIza…)", re: new RegExp(B + "AIza[A-Za-z0-9_-]{35}", "g") },
  { kind: "secret", name: "JWT (eyJ….….…)", re: new RegExp(B + "eyJ[A-Za-z0-9_-]{8,}\\.ey[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}", "g") },
  // Header followed by key material; the bare header also appears in harmless parser code.
  { kind: "secret", name: "частен ключ (PEM)", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----(?:\\[nr]|\s)*[A-Za-z0-9+/]{40,}/g },
  { kind: "demo", name: "демо данни (SAMPLE_)", re: /SAMPLE_/g },
  { kind: "demo", name: "демо данни (Пример клиент)", re: /Пример клиент/giu },
  { kind: "demo", name: "демо данни (P-1042)", re: /P-1042/g },
  { kind: "demo", name: "мок мост (bridge.mock)", re: /bridge\.mock/g },
  { kind: "name", name: "лично име", re: /Мирослав|Кънев/giu },
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

const mask = (s) => `${s.slice(0, 6)}…(${s.length} знака)`;

// Returns [{rule, where, shown}] for one text; `label` is the file path shown to the user.
function scan(text, label) {
  const found = [];
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.re)) {
      if (rule.accept && !rule.accept(m[0])) continue;
      const before = text.slice(0, m.index);
      const line = before.split("\n").length;
      const col = m.index - before.lastIndexOf("\n");
      // No surrounding context: in a minified bundle it could quote a neighbouring secret.
      found.push({ rule: rule.name, where: `${label}:${line}:${col}`, shown: rule.kind === "secret" ? mask(m[0]) : m[0] });
    }
  }
  return found;
}

const explicit = process.argv.slice(2);
const dirs = (explicit.length ? explicit : ["dist", "electron"]).map((d) => path.resolve(root, d));

const problems = [];
let files = 0;
for (const dir of dirs) {
  const rel = path.relative(root, dir) || ".";
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    problems.push({ rule: "липсваща папка", where: rel, shown: "няма какво да се провери - първо изпълнете `vite build`" });
    continue;
  }
  const list = walk(dir);
  if (dir === path.join(root, "dist") && !fs.existsSync(path.join(dir, "index.html"))) {
    problems.push({ rule: "непълен билд", where: rel, shown: "липсва index.html" });
  }
  for (const file of list) {
    files += 1;
    const label = path.relative(root, file).split(path.sep).join("/");
    // The name counts too: a chunk called bridge.mock-<hash>.js means the mock bridge was bundled.
    problems.push(...scan(label, label + " (име на файл)"));
    // Binary assets are scanned as text as well (image metadata can carry a name).
    problems.push(...scan(fs.readFileSync(file, "utf8"), label));
  }
}

const scope = dirs.map((d) => path.relative(root, d) || ".").join(", ");
if (problems.length) {
  console.error(`check-bundle: НЕУСПЕХ - ${problems.length} находки в ${scope}:`);
  for (const p of problems.slice(0, 200)) console.error(`  [${p.rule}] ${p.where}  ${p.shown}`);
  if (problems.length > 200) console.error(`  … и още ${problems.length - 200}`);
  console.error("Инсталаторът не бива да съдържа тайни, демо данни или лични имена. Поправете източника и изградете отново.");
  process.exit(1);
}
console.log(`check-bundle: OK - ${files} файла в ${scope}, без тайни, демо данни и лични имена.`);
