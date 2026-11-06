# Settings agent chat — „Видео за имот“

Embed this folder in the Electron Settings shell (`BrowserWindow` / tab).

- **skill_id:** `property_cinematic_video`
- **API:** `POST/GET {apiBase}/api/video` with headers:
  - `Authorization: Bearer <staff JWT>`
  - `x-imoti-client: settings`
- **Not** part of `mobile/ash.js` or the public TED on imotinadezhda.bg.

Optional preload config:

```js
window.ImotiSettingsAgentConfig = {
  apiBase: "https://imotinadezhda.bg",
  getToken: () => Promise.resolve(sessionAccessToken)
};
```
