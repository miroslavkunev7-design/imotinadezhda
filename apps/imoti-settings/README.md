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

### Разглоби компонент

1. Press **Разглоби компонент** in the top toolbar (stays green when active).
2. Double-click a component in the ruled sidebar (or on the walkthrough preview).
3. Exploded editor opens: font family/size/weight/color, head panel color/effects, live apply.

### Brokers

Brokers tab creates Auth user + `nd_staff` + `nd_brokers` via `/api/brokers` (service role server-side only).

## Build (Windows x64)

```bash
npm run build
npm run pack:artifacts
```

Install on work PC: see store `docs/builds/settings-install-work-pc.md`. Default path `D:\ImotiNadezhda-Settings`.
