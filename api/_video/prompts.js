// Versioned prompt registry for cinematic property video (server-side only).
"use strict";

const REGISTRY = {
  "R-PLAN": {
    version: 1,
    role: "plan",
    text: "Plan a short cinematic REAL_PROPERTY tour from the attached photos. Output JSON scenes with shot intent, duration_sec (3-5), and camera move. Keep rooms recognizable; no invented architecture."
  },
  "R-REF": {
    version: 1,
    role: "reference_prep",
    text: "Nano Banana Pro Edit: prepare a clean reference still from this property photo. Preserve layout, materials, and lighting. Remove clutter only if it blocks a clean camera path. Output still suitable for Kling O1 I2V."
  },
  "C-V01": {
    version: 1,
    role: "clip",
    text: "Kling O1 I2V: gentle push-in establishing shot of the space. Photoreal, stable, no morphing walls or furniture."
  },
  "C-V02": {
    version: 1,
    role: "clip",
    text: "Kling O1 I2V: slow lateral glide across the main living area. Keep geometry consistent with the reference frame."
  },
  "C-V03": {
    version: 1,
    role: "clip",
    text: "Kling O1 I2V: soft pan toward windows / natural light. No text overlays."
  },
  "C-V04": {
    version: 1,
    role: "clip",
    text: "Kling O1 I2V: detail pass (floor, counter, or facade detail) with micro push."
  },
  "C-V05": {
    version: 1,
    role: "clip",
    text: "Kling O1 I2V: kitchen / wet area orbit lite — keep fixtures fixed."
  },
  "C-V06": {
    version: 1,
    role: "clip",
    text: "Kling O1 I2V: bedroom calm drift; soft motion only."
  },
  "C-V07": {
    version: 1,
    role: "clip",
    text: "Kling O1 I2V: bathroom restrained pan; avoid reflective warping."
  },
  "C-V08": {
    version: 1,
    role: "clip",
    text: "Kling O1 I2V: balcony / outdoor transition if present; else skip."
  },
  "C-V09": {
    version: 1,
    role: "clip",
    text: "Kling O1 I2V: hallway connecting shot for editorial flow."
  },
  "C-V10": {
    version: 1,
    role: "clip",
    text: "Kling O1 I2V: wide closing hero of the best room."
  },
  "C-V11": {
    version: 1,
    role: "clip",
    text: "Kling O1 I2V: optional exterior curb appeal when facade photo exists."
  },
  "C-V12": {
    version: 1,
    role: "clip",
    text: "Kling O1 I2V: final pull-back / settle for end card (no logo burn-in)."
  },
  "A-FFMPEG": {
    version: 1,
    role: "assemble",
    text: "Assemble clips with light crossfades, 1080p H.264 yuv420p, AAC silence or bed if provided, target 20–45s."
  }
};

function get(key) {
  const e = REGISTRY[key];
  if (!e) return null;
  return { key, version: e.version, role: e.role, text: e.text };
}

function list() {
  return Object.keys(REGISTRY).map(get);
}

module.exports = { REGISTRY, get, list };
