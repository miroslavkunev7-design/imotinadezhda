// Production backend constants (docs/CONTRACT.md §1). Public values only - no secrets live here.
export const SITE = "https://imotinadezhda.bg";
export const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
// Supabase publishable key: public by design, already shipped in the site's own pages.
export const SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
export const PAGE = "Тед за Windows";
// The only hosts MAIN may talk to (exact hostname match, no subdomains).
export const ALLOWED_HOSTS = ["imotinadezhda.bg", "hyvwfsmjbaynozceookv.supabase.co", "auth.openai.com", "api.openai.com"];
