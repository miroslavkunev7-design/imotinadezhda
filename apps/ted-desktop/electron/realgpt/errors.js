// SPDX-License-Identifier: MIT
// Error codes and Bulgarian user-facing messages of the Real GPT module.
// Every failure leaves the module as {ok:false, error, code}; nothing falls back to another model or billing path.

export const USAGE_URL = 'https://chatgpt.com/settings/usage';

const MESSAGES = {
  // Arguments and state.
  invalid: 'Невалидна заявка към Real GPT',
  not_connected: 'Няма връзка с ChatGPT. Влезте с ChatGPT от настройките',
  plan_disabled:
    'Входът е запазен, но използването на ChatGPT плана не е разрешено. Влезте отново и разрешете използването на плана',
  reauth: 'Връзката с ChatGPT е изтекла или е прекъсната. Влезте отново с ChatGPT',
  storage: 'Защитеното хранилище на Windows не е достъпно и входът не може да бъде запазен',
  internal: 'Неочаквана грешка в Real GPT',
  // Sign-in.
  access_denied: 'Входът беше отказан в ChatGPT',
  cancelled: 'Входът е отменен',
  signin_timeout: 'Входът не беше завършен в рамките на 5 минути',
  browser: 'Браузърът не можа да бъде отворен за вход с ChatGPT',
  oauth: 'Входът с ChatGPT не успя',
  registration: 'ChatGPT не върна регистрация за програмата. Започнете входа отново',
  id_token: 'Самоличността от ChatGPT не можа да бъде потвърдена',
  account_mismatch:
    'Влязохте с друг ChatGPT акаунт, а не със запазения. Изберете същия акаунт или започнете нова регистрация',
  // Documented plan-usage errors.
  auth: 'ChatGPT не прие входа за тази заявка. Опитайте отново; ако се повтаря, прекъснете връзката и влезте пак',
  not_eligible:
    'Използването на ChatGPT плана не е достъпно за този акаунт, работно пространство или политика',
  usage_limit:
    'Достигнат е лимит за използване на ChatGPT плана. Прегледайте го в ChatGPT → Settings → Usage (chatgpt.com/settings/usage)',
  unavailable: 'ChatGPT временно не може да обслужи заявката. Опитайте отново след малко',
  unsupported: 'ChatGPT планът не поддържа част от тази заявка',
  config: 'ChatGPT отказа заявката заради настройките на връзката. Прекъснете връзката и влезте отново',
  forbidden: 'ChatGPT отказа заявката заради ограничение на достъпа',
  rate_limit: 'Твърде много заявки към ChatGPT. Изчакайте малко и опитайте отново',
  http: 'ChatGPT върна грешка',
  // Stream outcomes.
  failed: 'ChatGPT не успя да завърши отговора',
  incomplete: 'Отговорът беше прекъснат, преди да започне',
  empty: 'ChatGPT завърши, без да върне текст',
  stream_interrupted: 'Връзката прекъсна, преди отговорът да е завършен',
  // Transport (codes thrown by the injected http).
  network: 'Няма връзка с ChatGPT. Проверете интернета и опитайте отново',
  timeout: 'ChatGPT не отговори навреме. Опитайте отново',
  aborted: 'Заявката е спряна',
  host: 'Заявката е блокирана: адресът не е в списъка с разрешени',
};

// Documented server codes -> module codes.
const SERVER_CODES = {
  subscription_sharing_user_not_eligible: 'not_eligible',
  subscription_sharing_usage_limit_exceeded: 'usage_limit',
  subscription_sharing_usage_unavailable: 'unavailable',
  subscription_sharing_user_unavailable: 'unavailable',
  subscription_sharing_unsupported_capability: 'unsupported',
  subscription_sharing_route_not_supported: 'config',
  subscription_sharing_invalid_user: 'auth',
  chatpass_v2_scope_not_authorized: 'config',
  chatpass_v2_invalid_authorization_context: 'config',
};

const TRANSPORT_CODES = new Set(['network', 'timeout', 'aborted', 'host']);

// Server-provided identifiers are shown only when they are short plain tokens.
function safeDetail(value) {
  return typeof value === 'string' && /^[\w .,:[\]-]{1,80}$/.test(value) ? value : '';
}

export function messageFor(code, detail) {
  const base = MESSAGES[code] || MESSAGES.internal;
  const extra = safeDetail(detail);
  return `${base}${extra ? ` (${extra})` : ''}.`;
}

export class RgError extends Error {
  constructor(code, detail) {
    super(messageFor(code, detail));
    this.name = 'RgError';
    this.code = MESSAGES[code] ? code : 'internal';
  }
}

export function fail(code, detail, extra) {
  const err = new RgError(code, detail);
  return { ok: false, error: err.message, code: err.code, ...extra };
}

// Any thrown value -> failure result. Unknown errors never leak their raw text.
export function toFailure(err, extra) {
  if (err instanceof RgError) return { ok: false, error: err.message, code: err.code, ...extra };
  if (err && TRANSPORT_CODES.has(err.code)) return fail(err.code, null, extra);
  if (err?.name === 'AbortError') return fail('aborted', null, extra);
  if (err?.name === 'TimeoutError') return fail('timeout', null, extra);
  return fail('internal', null, extra);
}

// Reads {error:{code,param}} (Responses), {error:"code"} (OAuth) and {code}; a bare {detail} has no stable code.
export function serverError(body) {
  const e = body && typeof body === 'object' ? body.error : null;
  if (typeof e === 'string') return { code: e, param: null };
  const src = e && typeof e === 'object' ? e : body && typeof body === 'object' ? body : {};
  return {
    code: typeof src.code === 'string' ? src.code : null,
    param: typeof src.param === 'string' ? src.param : null,
  };
}

// HTTP status + parsed body -> {code, detail, serverCode, param}. `fallback` is used when nothing else matches.
export function mapApiError(status, body, fallback = 'http') {
  const { code: serverCode, param } = serverError(body);
  const known = SERVER_CODES[serverCode];
  if (known) {
    const detail = known === 'unsupported' ? param : known === 'config' ? serverCode : null;
    return { code: known, detail, serverCode, param };
  }
  let code = fallback;
  if (status === 401) code = 'auth';
  else if (status === 403) code = 'forbidden';
  else if (status === 429) code = 'rate_limit';
  else if (status >= 500) code = 'unavailable';
  const detail = [status ? `HTTP ${status}` : '', safeDetail(serverCode)].filter(Boolean).join(', ');
  return { code, detail, serverCode, param };
}

export function apiFailure(status, body, extra, fallback) {
  const { code, detail } = mapApiError(status, body, fallback);
  return fail(code, detail, extra);
}
