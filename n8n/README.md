# n8n — TED Settings Video (NEW set)

Import these JSON files as **new** workflows in n8n Cloud.

| File | Workflow |
| --- | --- |
| `ted-settings-video-dispatcher.json` | TED_Settings_Video_Dispatcher |
| `ted-settings-video-worker.json` | TED_Settings_Video_Worker |
| `ted-settings-video-events.json` | TED_Settings_Video_Events |
| `ted-settings-video-reconciler.json` | TED_Settings_Video_Reconciler |

**Do not** edit or overwrite the official imotinadezhda.bg TED webhook (`94ba7a03-…` in `mobile/ilj.html`).

After import, set env/credentials (names only in `docs/builds/secrets-inventory.md`):

- `VIDEO_DISPATCH_WEBHOOK_URL` → Dispatcher production URL
- `SITE_API_BASE` → `https://imotinadezhda.bg`
- `MEDIA_WORKER_URL`, HMAC secrets, `FAL_KEY` on API
