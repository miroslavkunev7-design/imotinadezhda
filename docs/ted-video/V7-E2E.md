# V7 — REAL_PROPERTY E2E

## Status

`FAL_KEY` was **not** present in the build agent environment → **paid E2E not run**.

## Blocker

Add secret name `FAL_KEY` (value in Vercel / media host only). Then:

1. Enable `SETTINGS_VIDEO_ENABLED=true`.
2. From Settings agent-chat, attach 4–10 real property photos.
3. Confirm progress stages V0–ready and MP4 plays/downloads.
4. Log §15 checks: duration, H.264 yuv420p, own-storage path under `nd-files/video/<job_id>/`.

## What was verified without FAL_KEY

- `node test/t-video-contract.js` — Settings gate, prompt registry, fal model keys, site TED untouched, agent-chat skill id.
