// SPDX-License-Identifier: MIT
// Model catalogue of the signed-in ChatGPT account.

export const MODELS_URL = 'https://api.openai.com/v1/models';

// Keeps the models meant for display, in the server's order: show displayName, send slug.
// Returns null when the body is not the documented {models:[...]} shape.
export function pickModels(body) {
  if (!Array.isArray(body?.models)) return null;
  return body.models
    .filter((m) => m && m.visibility === 'list' && typeof m.slug === 'string' && m.slug)
    .map((m) => ({ slug: m.slug, displayName: typeof m.display_name === 'string' && m.display_name ? m.display_name : m.slug }));
}
