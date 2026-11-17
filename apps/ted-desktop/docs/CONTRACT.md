# Ted for Windows – internal contract (v0.2)

This file is the single source of truth between the three code areas. Do not change a
signature here without updating every side.

- `electron/**` (except `electron/realgpt/**`) – MAIN process, backend adapters, IPC, preload.
- `electron/realgpt/**` – "Real GPT" module (MIT, local only, Sign in with ChatGPT).
- `src/**` – renderer (React 18 + Vite). No network, no Node. Talks only to `window.ted`.

Runtime: Electron 45, ESM in main (`"type":"module"`), sandboxed CommonJS preload (`electron/preload.cjs`).
The renderer is served from the custom scheme `app://ted/` (never `file://`). Every response carries the CSP
`protocol.js CSP`; `index.html` carries `META_CSP` (the same policy without `frame-ancestors`, which a `<meta>`
cannot deliver); `vite.config.mjs` fails the build if they differ.

## 1. Production backend (must NOT be changed; called only from MAIN)

Constants (`electron/backend/config.js`):

- `SITE = "https://imotinadezhda.bg"`
- `SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co"`
- `SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni"` (public publishable key, already in the public site code)
- `PAGE = "Тед за Windows"`
- `ALLOWED_HOSTS = ["imotinadezhda.bg", "hyvwfsmjbaynozceookv.supabase.co", "auth.openai.com", "api.openai.com"]`

Rules:

- Transport: Electron `net` (Chromium network stack: Windows proxy settings and certificate store) through
  `session.fromPartition("ted-backend").fetch` (in-memory partition, spell-checker off), wrapped by
  `wrapNetFetch` (`credentials:"omit"`, `cache:"no-store"`, `redirect:"manual"`) and injected into `createHttp` as
  `fetchImpl`. Never set an `Origin` or `Referer` header (login rejects foreign origins). Electron net sends
  neither, also on POST (checked against a local echo server by `--smoke-test`, §6); `http.js` strips both if a
  caller passes them. Redirects are never followed (net rejects them; reported as `network`, possibly sent).
- Login: `POST {SITE}/api/register` JSON `{action:"auth-login", identifier, password}` → `{ok, access_token, refresh_token}`.
  401 = wrong credentials, 429 = rate limit (15 per IP per 15 min). Then `POST {SB_URL}/rest/v1/rpc/nd_is_staff`
  (headers `apikey`, `Authorization: Bearer`) must return `true`. Profile: `GET {SB_URL}/auth/v1/user`.
- Refresh: `POST {SB_URL}/auth/v1/token?grant_type=refresh_token`, header `apikey`, JSON `{refresh_token}`.
  Refresh tokens rotate: single-flight only. Expiry comes from the JWT `exp` claim (decode only).
- Logout: `POST {SB_URL}/auth/v1/logout?scope=local` with `apikey` + Bearer.
- Chat: `POST {SITE}/api/assistant` (Bearer, JSON) `{messages, page, model?, mode?, case_id?}`.
  `messages[i] = {role:"user"|"assistant", text, files?:[{name,mime,data(base64)}]}`. Server keeps the last 16 messages,
  ≤ 8000 chars each, ≤ 3 files on a message (image/jpeg|png|webp, application/pdf), files only on the last message.
  Inside a case send ONLY the current message (the server rebuilds history). Non-streaming, up to ~108 s.
  Reply `{ok:true, text, transcript, actions[], staff, listings, video, ui:{panel}, email, mode, model, model_name, fallback}`
  or `{ok:false, error, quota?}`.
- Models: `POST {SITE}/api/assistant {action:"models"}` → `{ok, models:[{id,name,note,provider,vision,pdf}], modes:[{id,name}], n8n}`.
- Tools: `POST {SITE}/api/tools {tool, input}` → `{ok:true, result}` | `{ok:false, error}` (HTTP 400/404/409/412/500).
- Voice: `POST {SITE}/api/voice?fn=tts {text(≤1200), voice, style}` → `audio/wav`;
  `POST {SITE}/api/voice?fn=transcribe {mime, data}` → `{ok, text}`.
- NEVER retry a POST automatically, except: on HTTP 401 refresh the session once and retry the same request once
  (auth is checked before anything executes).
- From this development container: never call `auth-login`, never call a write tool, never send real data.

## 2. `window.ted` (preload → renderer)

All functions return Promises (via `ipcRenderer.invoke`). Subscriptions return an `unsubscribe()` function.
Tokens and passwords never cross IPC back to the renderer.

```
ted.app.info()                    -> {version, platform, packaged}
ted.app.setCompact(on:boolean)    -> {ok}          // resize to ~420x860 (phone layout) or restore
ted.app.getLaunchAtLogin()        -> {enabled}
ted.app.setLaunchAtLogin(on)      -> {ok, enabled}
ted.app.openLogs()                -> {ok}
ted.app.openExternal(url)         -> {ok} | {ok:false,error}     // https: and mailto: only
ted.app.copy(text)                -> {ok}
ted.app.saveFile({suggestedName, text?, base64?}) -> {ok:true, path} | {ok:false, canceled:true} | {ok:false, error}

ted.auth.state()                  -> AuthState
ted.auth.login({identifier, password}) -> {ok:true, user} | {ok:false, error, code}
ted.auth.logout()                 -> {ok}
ted.auth.onChange(cb(AuthState))  -> unsubscribe

ted.api.models()                  -> {ok:true, models:[{id,name,note,provider,vision,pdf}], modes:[{id,name}]} | {ok:false, error, code}
ted.api.chat({requestId, messages, model?, mode?, caseId?}) -> ChatResult
ted.api.cancel(requestId)         -> {ok}

ted.crm.read(tool, input)         -> {ok:true, result} | {ok:false, error, status?, code?}   // READ_ONLY tools only
ted.cases.create({title, clientName?}) -> {ok:true, result:{id,title}} | {ok:false, error}
ted.memory.remember({text, caseId?})   -> {ok:true, result} | {ok:false, error}
ted.memory.forget({id, preview})       -> {ok:true} | {ok:false, canceled:true} | {ok:false, error}   // native confirm in MAIN
ted.email.confirmSend({to, subject, attachments}) -> {ok:true, result} | {ok:false, canceled:true} | {ok:false, error, result?}
                                                     // native confirm in MAIN, then tools `email.send {confirm:true}`

ted.voice.tts({text, voice, style})    -> {ok:true, wav:ArrayBuffer} | {ok:false, error, code}
ted.voice.transcribe({mime, data})     -> {ok:true, text} | {ok:false, error, code}

ted.store.getSettings()           -> object
ted.store.setSettings(patch)      -> object (merged)
ted.store.loadChats()             -> {chats: Chat[]}
ted.store.saveChats(chats)        -> {ok}
ted.store.clearLocal()            -> {ok:true} | {ok:false, canceled:true}   // native confirm; deletes local chats only

ted.realgpt.status()              -> RgStatus
ted.realgpt.signIn({newAccount?}) -> {ok:true, status:RgStatus} | {ok:false, error, code}   // opens system browser, waits ≤ 5 min
                                                     // newAccount:true = fresh registration (other account / deleted one)
ted.realgpt.cancelSignIn()        -> {ok}
ted.realgpt.signOut()             -> {ok:true, revoked:boolean} | {ok:false, error, code:"storage", revoked}  // tokens could not be removed
ted.realgpt.models()              -> {ok:true, models:[{slug, displayName}]} | {ok:false, error, code}
ted.realgpt.send({requestId, messages, model, effort?, instructions?}) -> RgResult
ted.realgpt.cancel(requestId)     -> {ok}
ted.realgpt.onDelta(cb({requestId, delta, text})) -> unsubscribe
```

Types:

```
AuthState  = {status:"signedOut"} | {status:"signedIn", user:{id, name, email, phoneMasked}, remembered:boolean}
             // remembered:false = Windows encryption unavailable: memory-only session, chats not saved
ChatResult = {ok:true, text, transcript, actions:Action[], mode, model, modelName, fallback,
              email|null, listings|null, video|null, uiPanel|null, durationMs}
           | {ok:false, error, code:"quota"|"http"|"timeout"|"network"|"aborted"|"auth"|"invalid",
              status?, maybeExecuted:boolean}
Action     = {raw, kind:"tool"|"info", tool?, label, ok:boolean, mutating:boolean}
RgStatus   = {connected:boolean, email?:string, planEnabled?:boolean}
RgResult   = {ok:true, text, model, incomplete?:boolean, effortIgnored?:boolean}   // effort dropped by the route
           | {ok:false, error, code, text?}      // text = partial answer already streamed, if any
// The ChatGPT connection belongs to the signed-in CRM user (secure store "realgpt-<CRM user id>"); every CRM
//   sign-in/sign-out detaches it (running answers stop, decrypted tokens leave memory). Without a CRM user
//   signIn/models/send answer code "signed_out" and status is {connected:false}.
// The CRM bearer goes only to imotinadezhda.bg / the Supabase host, the ChatGPT bearer only to api.openai.com
//   (checked on every call before sending; violation -> code "host").
// RgResult/sign-in codes: signed_out, invalid, not_connected, plan_disabled, reauth, storage, internal, access_denied, cancelled,
//   signin_timeout, browser, oauth, registration, id_token, account_mismatch, auth, not_eligible, usage_limit,
//   unavailable, unsupported, config, forbidden, rate_limit, http, failed, incomplete, empty, stream_interrupted,
//   network, timeout, aborted, host. UI: usage_limit -> "Управление на лимита" (no retry); plan_disabled, reauth,
//   not_connected -> sign in again; registration, account_mismatch, oauth, id_token -> signIn({newAccount:true}).
// realgpt.onDelta: `text` is the full answer so far (authoritative); `delta` may join several server deltas.
// Write/tool results may add code and maybeExecuted; crm.read of a non-allowlisted tool returns code:"forbidden".
// realgpt.send messages: [{role:"user"|"assistant", text, images?:[{mime, data(base64)}]}]
```

`ted.api.chat` validation in MAIN: ≤ 16 messages, first message role `user`, text ≤ 8000 chars each,
files only on the last message, ≤ 3 files, mime in jpeg/png/webp/pdf (+ one `audio/*` voice note on the last message),
total base64 ≤ 3.8 MB. Invalid → `{ok:false, code:"invalid", error, maybeExecuted:false}` without any network call.

`maybeExecuted` is `true` when the request left the machine and the outcome is unknown (timeout, network error after
send, 5xx, abort). The UI must warn that an action may have run and must not retry automatically.

`Action` parsing (from the server strings in `actions[]`): a trailing `" ✗"` means failed (`ok:false`);
a name containing a dot that exists in the tools manifest is `kind:"tool"`; anything else is `kind:"info"`.
`mutating` uses the server's rule: tool is NOT a `search|list|get|calc|find|inspect|match|live|summary|recent|preview` read.

READ_ONLY tools accepted by `ted.crm.read` (anything else is rejected in MAIN without a network call):
`clients.search, clients.get, properties.search, properties.match, calendar.list, deals.list, companies.search,
brokers.list, documents.list, documents.find, documents.download_link, calc.mortgage, calc.commission, calc.yield,
rates.live, reports.summary, memory.search, cases.list, cases.get, inquiries.list, rentals.list, collected.list`.

## 3. MAIN-side module API (dependency injection; all factories are pure and unit-testable)

```
electron/log.js            createLog({dir}) -> {info(event, fields), warn(event, fields), error(event, fields), dir}
                           redact(string) -> string
electron/store/secure-file.js  createSecureStore({dir, safeStorage}) -> {available(), read(name)->object|null, write(name,obj), remove(name)}
electron/store/settings.js     createSettings({file}) -> {get(), set(patch)}
electron/backend/http.js   wrapNetFetch(sessionFetch) -> fetchImpl     // main.js: the production transport (§1)
                           createHttp({fetchImpl = globalThis.fetch, log, allowedHosts?, userAgent?}) ->
                             {request({url, method="GET", headers, json, form, body, timeoutMs, signal, as="json"|"arrayBuffer"|"stream"|"text"})
                                -> {status, ok, headers, json?, text?, buffer?, body?}}
                           // throws HttpError {code:"timeout"|"network"|"aborted"|"host", message, sent:boolean};
                           // refuses hosts outside ALLOWED_HOSTS; never sets Origin; net::ERR_* before sending -> sent:false
electron/backend/session.js   createSession({http, secureStore, log, onChange}) ->
                             {init(), state()->AuthState, login({identifier,password}), logout(),
                              getAccessToken()->string|null, authed(opts)->response}   // authed = request with Bearer + 401→refresh→retry once
electron/backend/assistant.js createAssistant({session, log}) -> {models(), chat(args)->ChatResult, cancel(requestId)}
                           buildBody({messages, model, mode, caseId}) -> body | throws {code:"invalid"}
                           normalize(json, durationMs, manifestNames?) -> ChatResult
electron/backend/tools.js  createTools({session, log}) -> {read(tool,input), call(tool,input)}   // call() is MAIN-internal only
electron/backend/email.js  createEmail({tools, confirm}) -> {confirmSend({to, subject, attachments})}  // confirm(message, detail)->Promise<boolean>
electron/backend/voice.js  createVoice({session}) -> {tts(args), transcribe(args)}
electron/realgpt/index.js  createRealGpt({http, secureStore, dataDir, openExternal, owner, log, emit}) ->
                             {status(), signIn({newAccount}), cancelSignIn(), signOut(), detach(), models(), send(args)->RgResult, cancel(requestId)}
                           // owner() = signed-in CRM user id or null; detach() on every CRM session change
                           // emit("realgpt:delta", {requestId, delta, text}) while streaming
```

electron/protocol.js       CSP, META_CSP, SCHEME, APP_URL, createAppHandler({root}), registerAppProtocol({protocol, root})
electron/security.js       installSecurity({app, session, shell, log, devOrigin}) -> {openExternal(url), isApp(url)}
                           disableSpellChecker(session)   // languages [] first, then off: no dictionary downloads
electron/smoke.js          parseSmokeArgs(argv), prepareSmoke(app, smoke), recordingShell(), guardRendererRequests(webRequest),
                           runSmoke({...}) -> report, writeSmokeReport(smoke, report) -> exit code, TED_SURFACE (§2 keys)

`electron/ipc.js` registers one `ipcMain.handle` per `window.ted` function. Channel names are
`"ted:<group>.<fn>"` (for example `ted:api.chat`); push events are `ted:auth.changed` and `ted:realgpt.delta`.
Every handler checks `event.senderFrame.url` starts with `app://ted/` and validates argument types and sizes.

## 4. Real GPT (Sign in with ChatGPT, open-source local flow)

- Authorization: `https://auth.openai.com/api/accounts/authorize`; token: `https://auth.openai.com/api/accounts/oauth/token`;
  JWKS: `https://auth.openai.com/.well-known/jwks.json`; revoke: `https://auth.openai.com/api/accounts/oauth/revoke`.
- PKCE S256; loopback redirect `http://127.0.0.1:<ephemeral port>/auth/callback` (never `localhost`).
- First sign-in `client_id=dynamic_agent_client` + `agent_name_hint=Ted for Windows`; the callback returns an issued
  `client_id` (`oaiapp_…`) that is saved and reused. Persistent `ext_agent_host_id` (`urn:uuid:…`).
- Scope `openid profile email offline_access resource.invoke chatgpt.tokens.use.direct`; `resource=https://api.openai.com/v1`.
- ID token verified with `jose` (issuer, audience = issued client id, nonce). Plan usage needs the
  `chatgpt.tokens.use.direct` scope to be granted (`planEnabled`).
- Models: `GET https://api.openai.com/v1/models` → keep `visibility == "list"`, show `display_name`, send `slug`.
- Inference: `POST https://api.openai.com/v1/responses` `{model, instructions, input, store:false, stream:true}` (SSE).
  Never send a `system` role item or any of: `temperature, top_p, max_output_tokens, max_tool_calls, metadata, background,
  conversation, moderation, prompt, prompt_cache_retention, safety_identifier, top_logprobs, truncation, user,
  service_tier, previous_response_id`. `reasoning.effort` only when the caller passes `effort`; on HTTP 400
  `subscription_sharing_unsupported_capability` naming it, drop it and retry once.
- No OpenAI DevKit code. Credentials are stored encrypted (safeStorage) and never sent to the renderer.

## 5. Honesty rules (apply to every area)

- No demo data, no sample clients/properties, no simulated progress in the production bundle.
- A status shown as done must come from a real server/tool result. Unknown outcome → say so.
- Bulgarian UI text. No personal names hard-coded (the profile comes from login).

## 6. Smoke test of the real program

`<exe or electron .> --smoke-test --smoke-report=<file.json> [--smoke-shot=<file.png>]` (`npm run smoke`; CI on
Windows against `win-unpacked/TedImotiNadezhda.exe`, on Linux under xvfb). A temporary userData is set before
`requestSingleInstanceLock`; links go to a recording shell (nothing opens); renderer requests other than
`app:`/`data:`/`blob:` are recorded and cancelled. Checks: app:// loaded and the login screen rendered, CSP header
and `<meta>`, eval blocked, `window.ted` has exactly the §2 keys (all functions), no `require`/`process`/`module`/
`Buffer` in the page, sandbox + contextIsolation, renderer `fetch` blocked by CSP, `window.open` denied and routed to
the system browser, navigation to https://example.com blocked, no external renderer requests, and through the
production transport against a local 127.0.0.1 echo server: no Origin/Referer, body/Content-Type/User-Agent as sent,
no cookies, timeout -> `timeout`, refused -> `network` with `sent:false`, foreign host -> `host`; no renderer console
errors. Exit 0 when every check passes, else 1 (also after 90 s). It never contacts production, Supabase or OpenAI.
Linux: Chromium refuses to start sandboxed children as root (`app.enableSandbox()` ignores `--no-sandbox` for them),
so run it as a normal user.
