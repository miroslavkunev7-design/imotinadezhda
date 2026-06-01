# Imoti Nadezhda — Cross-post Worker

Standalone Playwright worker, който обработва опашката `cross_post_queue` от Lovable Cloud базата и публикува обяви автоматично към избраните портали.

## Защо отделен worker?

Lovable хоства сайта на Cloudflare Workers, където **Playwright/браузър автоматизация не работи** (няма достъп до native бинарни файлове). Затова този компонент трябва да работи отделно — на ваш VPS, домашен компютър или контейнер (Railway, Render, Fly.io, Hetzner и т.н.).

## Setup

```bash
cd worker
npm install
npx playwright install chromium --with-deps
cp .env.example .env
# редактирай .env и попълни SUPABASE_SERVICE_ROLE_KEY + credentials за порталите
npm start
```

## Как работи

1. Polling на `cross_post_queue` всеки N секунди (по default 15s).
2. Взима до 5 задачи със статус `queued`, маркира ги като `processing`.
3. За всяка задача избира публикатор според полето `site` и пуска браузър сесия.
4. При успех записва `external_url` и статус `published`. При грешка — `failed` + `error`.
5. Запазва login сесии в `sessions/` (cookies) за да не влиза наново всеки път.

## Поддържани сайтове

| site (key)        | Файл                          | Статус   |
|-------------------|-------------------------------|----------|
| imot.bg           | `publishers/imot-bg.js`       | Скелет ⚠️ |
| imoti.net         | `publishers/imoti-net.js`     | Скелет ⚠️ |
| olx.bg            | `publishers/olx-bg.js`        | Скелет ⚠️ |
| bazar.bg          | `publishers/bazar-bg.js`      | Скелет ⚠️ |
| alo.bg            | `publishers/alo-bg.js`        | Скелет ⚠️ |
| home.bg           | `publishers/home-bg.js`       | Скелет ⚠️ |
| fb-marketplace    | `publishers/fb-marketplace.js`| Скелет ⚠️ |

> ⚠️ **Важно:** селекторите за формите за добавяне на обяви са placeholder-и. Трябва да ги настроите при първо стартиране с `HEADLESS=false`, като влезете с реален акаунт и инспектирате формата. Селекторите се менят често от порталите и нямат публично API.

## Деплой като systemd сервиз (Linux VPS)

```ini
# /etc/systemd/system/imoti-worker.service
[Unit]
Description=Imoti Nadezhda Crosspost Worker
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/imoti-worker
ExecStart=/usr/bin/node src/index.js
Restart=always
User=worker

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now imoti-worker
sudo journalctl -fu imoti-worker
```

## Правни бележки

Автоматизираното публикуване може да противоречи на ToS на някои портали. Използвайте на собствена отговорност и предпочитайте официални партньорства/XML feeds където е възможно (imot.bg например предлага XML feed за агенции).
