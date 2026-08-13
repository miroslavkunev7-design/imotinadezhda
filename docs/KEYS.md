# Ключове и env — регистър (без стойности)

Стойностите са само в `.env`. Агентът ги чете оттам и ги слага сам.
Не питай потребителя „това липсва“. Не пиши ключове в чата.

| Ключ | За какво | Къде се слага | В .env сега |
|---|---|---|---|
| SUPABASE_URL | Сървърна връзка към базата | `.env` + Vercel | Да |
| VITE_SUPABASE_URL | Същото за браузъра | `.env` + Vercel | Да |
| SUPABASE_PROJECT_ID | ID `bxtxygakafwusstpptkg` | `.env` + Vercel | Да |
| VITE_SUPABASE_PROJECT_ID | Същото за браузъра | `.env` + Vercel | Да |
| SUPABASE_PUBLISHABLE_KEY | Публичен anon ключ | `.env` + Vercel | Да |
| VITE_SUPABASE_PUBLISHABLE_KEY | Същото за браузъра | `.env` + Vercel | Да |
| VITE_SUPABASE_ANON_KEY | Алиас на publishable | `.env` (копие) | Да |
| SUPABASE_SERVICE_ROLE_KEY | Сървърен пълен достъп — без VITE_ | `.env` + Vercel | Да |
| VITE_SITE_URL | Каноничен адрес | `.env` + Vercel | Да |
| AI_GATEWAY_KEY | AI през Vercel Gateway | `.env` + Vercel | Ще се сложи от мен |
| GEMINI_API_KEY | AI fallback / изображения | `.env` + Vercel | Ще се сложи от мен |
| OPENAI_API_KEY | AI / generate image | `.env` + Vercel | Ще се сложи от мен |
| LOVABLE_API_KEY | Стар Lovable gateway | `.env` + Vercel | Ще се сложи от мен |
| VAPID_PUBLIC_KEY | Push (публичен) | `.env` + Vercel | Ще се генерира от мен |
| VAPID_PRIVATE_KEY | Push (таен) | `.env` + Vercel | Ще се генерира от мен |
| VAPID_SUBJECT | mailto за VAPID | `.env` | Да (default) |
| RESEND_API_KEY | Имейли | `.env` + Vercel | Ще се сложи от мен |
| EMAIL_FROM | Подател | `.env` | Да (default) |
| MARKETING_FROM_EMAIL | Маркетинг подател | `.env` | Да (default) |
| FIRECRAWL_API_KEY | Извличане на обяви | `.env` + Vercel | Ще се сложи от мен |
| WHATSAPP_TOKEN | WhatsApp Cloud API (бот-брокер) | `.env` + Vercel | Ще се сложи от мен |
| WHATSAPP_PHONE_NUMBER_ID | Номер на агенцията в Meta | `.env` + Vercel | Ще се сложи от мен |
| WHATSAPP_VERIFY_TOKEN | Webhook verify | `.env` + Vercel | Ще се сложи от мен |
| AGENCY_PORTAL_EMAIL | Имейл за профили в институции | `.env` само | Да |
| AGENCY_PORTAL_PASSWORD | Парола за същите профили | `.env` само | Да |
