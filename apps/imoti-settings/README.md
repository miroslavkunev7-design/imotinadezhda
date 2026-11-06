# Imoti Nadezhda Settings (Electron)

Windows x64 companion app: live BrowserView preview of the site + CMS component editors + **Settings-only Agent** chat.

## Install

- NSIS default directory: `D:\ImotiNadezhda-Settings`
- Portable + installer artifacts: `dist-installer/` and store `media/settings-app/`

## Agent / Video (locked)

- Skill `property_cinematic_video` UI lives **only** in this app’s Agent tab.
- Calls a **separate** Settings n8n/TED + video workflow via:
  - `VITE_SETTINGS_TED_API` / `VITE_SETTINGS_N8N_WEBHOOK`
  - `VITE_SETTINGS_VIDEO_API`
- Does **not** call official `imotinadezhda.bg/api/assistant` or the public-site n8n agent.

## Dev

```bash
cd apps/imoti-settings
npm install
cp .env.example .env   # fill Settings endpoints when Video worker publishes them
npm run dev
```

### Walkthrough mode (no staff credentials)

Browser-only Vite UI with iframe preview + mock staff:

```bash
npm run build:renderer
npx vite --host 127.0.0.1 --port 5179
# open http://127.0.0.1:5179/?walkthrough=1
```

Selecting a component highlights it in the preview; color/shape/melt/size edits paint live. Save still needs a real staff JWT to persist to `cms_*` (walkthrough Save will error until signed in).

## Build (Windows x64)

```bash
npm run build
npm run pack:artifacts
```
