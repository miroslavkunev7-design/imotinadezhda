# Rollout — Settings „Видео за имот“ (V8)

## Feature flags

| Name | Default | Effect |
| --- | --- | --- |
| `VIDEO_FEATURE_ENABLED` | unset/false | Master pipeline; keep **off** for public site |
| `SETTINGS_VIDEO_ENABLED` | unset/false | Allows Settings `/api/video` create when registry row disabled |
| `ai_video_skill_registry.enabled` | **false** (migration seed) | DB gate for Settings UI |

Public site `NDAsh` / `api/assistant.js` **never** register this skill regardless of flags.

## Safe order

1. Apply migration `ai_video_tables` (done in V1).
2. Deploy API (`api/video.js`, `_video/*`) — create still 403 without `x-imoti-client: settings`.
3. Import **new** n8n workflows from `n8n/ted-settings-video-*.json` (do not touch official TED).
4. Deploy media-worker container; set `MEDIA_WORKER_*`.
5. Set `FAL_KEY` on Vercel.
6. Enable `SETTINGS_VIDEO_ENABLED=true` and/or registry `enabled=true`.
7. Open skill only from Settings Electron `agent-chat/`.

## Rollback

- Set flags false / registry.enabled=false.
- Leave official TED workflows unchanged (they were never modified).
