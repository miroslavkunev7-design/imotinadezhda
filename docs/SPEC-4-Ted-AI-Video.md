# SPEC-4 · Тед – умение „AI Видео на имот“

Умение в чата на Тед (CRM), което възпроизвежда 1:1 двата похвата от обучителните видеа. Промптовете са запаметени в самото умение, виждат се и се редактират преди пускане. Дизайнът е същият стъклен стил като другите умения; нищо друго по сайта не е пипано.

## Източници
- „How to Turn Real Estate Photos Into a Cinematic Walkthrough With AI (Higgsfield + Kling 3.0)“ – Market U, 4.06.2026, https://www.youtube.com/watch?v=ReASV_e1mwc (описанието дава Google Docs с промптовете – ще се въведат дословно, щом бъде отворен).
- Второ видео (Google Flow + ChatGPT): ускорен строеж от празен парцел до готовата вила – промптовете са взети от кадрите.

## Режим А – „Разходка“ (по видеото на Market U)
1. Имот от CRM (снимките са там) или снимки от телефона.
2. Подредба като маршрут: отвън → вход → хол → кухня → тераса → краен външен кадър (стрелки ▲▼, премахване). За всяка снимка се избира какво показва (Отвън/Вход/Хол/Трапезария/Кухня/Стълбище/Спалня/Баня/Тераса/Басейн/Двор/Краен външен кадър/Друго).
3. Клипове **по двойки с припокриване**: 1+2, 2+3, 3+4 … (снимка N = първи кадър, N+1 = последен кадър).
4. Промпт на клип (дословно от автора + посока на камерата за стъпката):
   - База: `Smoothly blend from the first image into the second image and keep the camera stable and make the transitions seamless. Then, follow the camera path through the property.`
   - Маршрутът на автора: `Start outside, move towards the entrance, then go into the living room, kitchen, patio, and finish with a final outdoor view.`
   - Посоки: отвън→вход `Start outside and move towards the entrance.`; вход→X `Go through the entrance and move inside with a slight turn to the right into …`; хол→кухня `Pull back through the living room, then push forward into the kitchen.`; →тераса `Move out … onto the covered patio.`; →басейн `Continue outside … towards the pool.`; →краен кадър `… finish with a final outdoor view of the property.`; общо `Move forward from … into …`.
5. Сглобяване в едно видео (в браузъра) с надпис „AI визуализация“; запис към имота (раздел „Видеа“) и сваляне.

## Режим Б – „Строеж“ (по второто видео)
1. Снимка на готовия имот (корицата).
2. **Празен парцел** (master environment) – Gemini image edit: същият парцел без сграда/басейн/градина, същата камера, стени, фон, светлина.
3. **Сценарий по клипове** (5–7 клипа × 5–7 сек) във формата на автора: `CLIP N — ИМЕ`, Duration target, Start state, Transformation, End state, Continuity + промпт:
   ```
   [MASTER ENVIRONMENT LOCK]. [CAMERA LOCK].
   STARTING STATE: …
   TRANSFORMATION: …
   ENDING STATE: …
   Preserve the exact same architecture, background, environment layout, camera perspective, weather, time of day, and lighting established in the master environment. Do not redesign unrelated parts of the scene.
   Ultra-realistic authentic time-lapse footage, realistic human movement, physically believable activity, detailed ground textures, consistent scale, seamless visual continuity, 9:16 vertical.
   ```
   Пише се от избрания в настройките на Тед модел (Claude/ChatGPT, ако виждат снимки) или Gemini.
4. Верига: клип 1 тръгва от празния парцел; **последният кадър на всеки клип** (изважда се в браузъра и се качва) е първи кадър на следващия; последният клип завършва точно на реалната снимка (последен кадър = оригиналът).

## От чата (без панела)
- „Направи видео разходка на обява #P-1001“ / „видео на строежа за IM-12“ → инструмент `video.create` (намира обявата по код/№/#) → Тед превключва на умението, зарежда реалните снимки, **подрежда ги автоматично като маршрут** (Gemini: надписва стаите и реди отвън → вход → хол → … → краен кадър), подготвя клиповете, генерира ги един по един, сглобява, записва към имота и **връща видеото в чата** (плейър + „Свали видеото“).
- Прикачени снимки + „направи видео“ → същото от снимките (без имот → само сваляне).
- Логото на агенцията е **по средата** на сглобеното видео (бледо, с мек ореол), надписът „AI визуализация“ – долу вдясно.

## Двигатели (ключовете само във Vercel)
- **Google Gemini Omni Flash** `gemini-omni-1.1-flash` – Interactions API (`POST /v1beta/interactions`, `background:true`, `GET /v1beta/interactions/{id}`), първи + последен кадър, 9:16/16:9, 720p/1080p, звук, SynthID. Veo 3.1 Preview е спрян на 22.10.2026 – Omni е наследникът (същият двигател като в Google Flow). Цена по токени ≈ 0,10 $/сек при 720p (≈ 0,03 $/сек при 360p); **само платен лимит**, безплатен няма.
- **OpenAI Sora 2** (`OPENAI_API_KEY`) – само първи кадър, 4/8/12 сек, ≈ 0,10 $/сек. Появява се в „Двигател“, когато има ключ.
- Claude не генерира видео; с `ANTHROPIC_API_KEY` се появява в модела на Тед и може да пише сценария.
- Google Flow няма публичен API – затова Тед не „натиска бутоните“ във Flow, а ползва същия модел директно.

## Файлове
- `api/video.js` – actions `engines`, `script`, `lot`, `start`, `status` (сваля готовото видео и го качва в `nd-files` под `ted/video/<код>/…`, връща подписан линк). `vercel.json`: maxDuration 60.
- `api/_llm.js` – извикване без инструменти (за сценария).
- `mobile/crm/crm-video.js` – умението (панел `.ndv`, промптове, верига, сглобяване с `canvas.captureStream` + `MediaRecorder`, надпис, запис към `videos` на имота). Включен във всички CRM страници; SW `nd-crm-v37`.
- Тестове: `test/t-video.js`, `t-video2.js`, `t-video3.js` (mock `/api/video`, истински webm клип за кадри и сглобяване).

## Бележки
- ЕС (AI Act, чл. 50): AI-генерирано видео се обозначава → надпис „AI визуализация“ върху сглобеното видео.
- Генерирането на видео с Omni в ЕИП работи; редакция на качени чужди видеа не е налична в ЕИП (не се ползва).
- Непроверено на живо: точното име на полето за дължина в Omni (`response_format.duration`); при отказ сървърът повтаря без него, а дължината остава в текста на промпта.
