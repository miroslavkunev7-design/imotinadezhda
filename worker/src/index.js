import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { publishers } from './publishers/index.js';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  POLL_INTERVAL_MS = '15000',
  HEADLESS = 'true',
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Липсват SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY в .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SESSIONS_DIR = path.resolve('sessions');
const SCREENSHOTS_DIR = path.resolve('screenshots');
await fs.mkdir(SESSIONS_DIR, { recursive: true });
await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

const headless = HEADLESS !== 'false';
const pollMs = parseInt(POLL_INTERVAL_MS, 10);

let isRunning = false;

async function fetchProperty(propertyId) {
  const { data, error } = await supabase
    .from('properties')
    .select('*, property_images(url, is_cover, display_order), cities(name, slug), quarters(name, slug)')
    .eq('id', propertyId)
    .single();
  if (error) throw new Error(`Property fetch failed: ${error.message}`);
  return data;
}

async function processJob(job, browser) {
  const siteKey = job.site;
  const publisher = publishers[siteKey];

  if (!publisher) {
    return { ok: false, error: `Няма публикатор за сайт "${siteKey}"` };
  }

  const credentials = publisher.getCredentials();
  if (!credentials) {
    return { ok: false, error: `Липсват credentials за ${siteKey} в .env (скип)` };
  }

  const property = await fetchProperty(job.property_id);

  const sessionFile = path.join(SESSIONS_DIR, `${siteKey}.json`);
  let storageState;
  try {
    await fs.access(sessionFile);
    storageState = sessionFile;
  } catch {
    storageState = undefined;
  }

  const context = await browser.newContext({
    storageState,
    viewport: { width: 1366, height: 900 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    console.log(`▶️  [${siteKey}] публикуване на "${property.title}"`);
    const result = await publisher.publish({ page, property, credentials });
    await context.storageState({ path: sessionFile });
    return { ok: true, externalUrl: result?.url ?? null };
  } catch (err) {
    const shot = path.join(SCREENSHOTS_DIR, `${siteKey}-${Date.now()}.png`);
    try { await page.screenshot({ path: shot, fullPage: true }); } catch {}
    return { ok: false, error: `${err.message} (screenshot: ${shot})` };
  } finally {
    await context.close();
  }
}

async function tick() {
  if (isRunning) return;
  isRunning = true;

  let browser;
  try {
    const { data: jobs, error } = await supabase
      .from('cross_post_queue')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(5);

    if (error) throw error;
    if (!jobs || jobs.length === 0) return;

    console.log(`📦 ${jobs.length} нови задачи`);
    browser = await chromium.launch({ headless });

    for (const job of jobs) {
      // claim
      const { error: claimErr } = await supabase
        .from('cross_post_queue')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('status', 'queued');
      if (claimErr) { console.warn('claim err', claimErr.message); continue; }

      const res = await processJob(job, browser);

      await supabase
        .from('cross_post_queue')
        .update({
          status: res.ok ? 'published' : 'failed',
          external_url: res.externalUrl ?? null,
          error: res.ok ? null : res.error,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      console.log(res.ok ? `✅ [${job.site}] OK ${res.externalUrl ?? ''}` : `❌ [${job.site}] ${res.error}`);
    }
  } catch (e) {
    console.error('Tick error:', e.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
    isRunning = false;
  }
}

console.log(`🚀 Worker стартиран (poll ${pollMs}ms, headless=${headless})`);
await tick();
setInterval(tick, pollMs);
