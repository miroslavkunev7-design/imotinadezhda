// „Отвори в ChatGPT“ (docs/CONTRACT.md §9.6): images, video (Sora) and other work that OpenAI does not give to external
// programs on the plan route are done in the employee's own ChatGPT app. The agent only SHOWS a card with the prompt
// (open_in_chatgpt); the link is opened by MAIN when – and only when – the employee clicks the card's button
// (ted.realgpt.openInChatGpt). Exact host, https only, the prompt as the only query parameter.
export const CHATGPT_HOST = "chatgpt.com";
export const CHATGPT_PROMPT_MAX = 4000;
// The LINK is what Windows and the browser receive: every Cyrillic letter becomes 6 characters (%D0%B0), so the cap is
// on the encoded address (0.1.5 review F5: a 1 500-letter Bulgarian prompt made an 8 300-character URL that
// security.js externalUrl refused). 8000 < externalUrl's 8192. A longer prompt is copied and pasted in ChatGPT.
export const CHATGPT_URL_MAX = 8000;
export const CHATGPT_HOME = `https://${CHATGPT_HOST}/`;
const PREFIX = `https://${CHATGPT_HOST}/?q=`;
// -> the length of the link a prompt makes (Infinity for a prompt that cannot be encoded).
export function chatgptUrlLength(prompt) {
  try { return PREFIX.length + encodeURIComponent(cleanPrompt(prompt)).length; } catch { return Infinity; }
}
// Does the prompt fit into a direct link?
export const fitsLink = (prompt) => chatgptUrlLength(prompt) <= CHATGPT_URL_MAX;
export const HANDOFF_KINDS = ["image", "video", "research", "other"];

// Control characters except tab/newline are dropped; Windows newlines become \n.
export function cleanPrompt(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
}

// -> "https://chatgpt.com/?q=<encoded prompt>" or null when the prompt is empty, longer than CHATGPT_PROMPT_MAX or
// its link longer than CHATGPT_URL_MAX.
export function chatgptUrl(prompt) {
  const p = cleanPrompt(prompt);
  if (!p || p.length > CHATGPT_PROMPT_MAX) return null;
  let href;
  try { href = `${PREFIX}${encodeURIComponent(p)}`; } catch { return null; } // lone surrogate
  if (href.length > CHATGPT_URL_MAX) return null;
  // Belt and braces: whatever the prompt holds, the result must still be https://chatgpt.com/ with only ?q=<prompt>.
  let url;
  try { url = new URL(href); } catch { return null; }
  if (url.protocol !== "https:" || url.hostname !== CHATGPT_HOST || url.port !== "" || url.username || url.password ||
      url.pathname !== "/" || url.hash || [...url.searchParams.keys()].join() !== "q" || url.searchParams.get("q") !== p) return null;
  return href;
}
