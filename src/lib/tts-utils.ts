// Helpers for browser SpeechSynthesis — strip markdown noise so the
// reader doesn't say "звезда звезда" for ** or read backticks/hashes.
export function sanitizeForSpeech(input: string): string {
  if (!input) return "";
  let s = input;
  // Code fences and inline code
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`([^`]*)`/g, "$1");
  // Images ![alt](url) -> alt
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  // Links [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  // Bare URLs
  s = s.replace(/https?:\/\/\S+/g, " ");
  // Headings, blockquotes, list markers at line start
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  s = s.replace(/^\s{0,3}>\s?/gm, "");
  s = s.replace(/^\s*[-*+]\s+/gm, "");
  s = s.replace(/^\s*\d+\.\s+/gm, "");
  // Bold/italic/strike markers
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  s = s.replace(/~~([^~]+)~~/g, "$1");
  // Stray symbols
  s = s.replace(/[*_`~#>|]/g, " ");
  // Horizontal rules / table pipes leftovers
  s = s.replace(/-{3,}/g, " ");
  // Collapse whitespace
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\s*\n\s*\n\s*/g, ". ");
  s = s.replace(/\s*\n\s*/g, " ");
  return s.trim();
}

export function speakBG(
  text: string,
  opts: { onEnd?: () => void; onError?: () => void } = {},
): SpeechSynthesisUtterance | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const clean = sanitizeForSpeech(text);
  if (!clean) return null;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = "bg-BG";
  u.rate = 1.05;   // нормална скорост, леко живо
  u.pitch = 1;
  u.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const bgVoices = voices.filter(
    (v) => v.lang?.toLowerCase().startsWith("bg") || /bulgarian/i.test(v.name),
  );
  // Prefer a male Bulgarian voice; common names: Daniel, Ivan, Georgi, "Microsoft Ivan"
  const maleHint = /(daniel|ivan|georgi|nikolay|male|мъж|мъжки)/i;
  const femaleHint = /(female|жена|дамски|elena|maria|ralitsa|kalina)/i;
  const pick =
    bgVoices.find((v) => maleHint.test(v.name)) ||
    bgVoices.find((v) => !femaleHint.test(v.name)) ||
    bgVoices[0] ||
    voices.find((v) => maleHint.test(v.name));
  if (pick) u.voice = pick;
  u.onend = () => opts.onEnd?.();
  u.onerror = () => opts.onError?.();
  window.speechSynthesis.speak(u);
  return u;
}
