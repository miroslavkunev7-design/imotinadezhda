// /api/voice – глас: говорене (tts) и разпознаване (transcribe) в една функция (лимитът на Hobby плана е 12 функции).
// Старите адреси /api/tts и /api/transcribe се пренасочват тук от vercel.json (?fn=tts | ?fn=transcribe).
"use strict";
const tts = require("./_tts.js"), transcribe = require("./_transcribe.js");
module.exports = async (req, res) => {
  const u = new URL(req.url, "https://imotinadezhda.bg"), fn = u.searchParams.get("fn") || (/transcribe/.test(u.pathname) ? "transcribe" : "tts");
  return fn === "transcribe" ? transcribe(req, res) : tts(req, res);
};
