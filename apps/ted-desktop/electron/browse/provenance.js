// Which web pictures may load WITHOUT a click (0.1.5 review F13, docs/CONTRACT.md §8.4 / §16): only addresses that MAIN
// itself handed to the window as a tool result – the `images` of a page read_page read, the source of a picture
// fetch_image downloaded – in this run or in a saved chat. The renderer applies the same rule (Md.jsx); this is the
// second layer, so a renderer bug can never turn a model-written image address into an automatic request (a data leak
// through the URL). Any other address loads only after the employee's click on its chip ({clicked:true}).
const MAX = 20_000;
const URL_MAX = 2048;

const okUrl = (u) => typeof u === "string" && u.length <= URL_MAX && /^https:\/\//i.test(u);

export function createImageProvenance({ max = MAX } = {}) {
  const seen = new Set();
  function add(u) {
    if (!okUrl(u)) return;
    if (seen.has(u)) seen.delete(u); // newest last
    seen.add(u);
    while (seen.size > max) seen.delete(seen.values().next().value);
  }
  // An agent event on its way to the window (main.js emit): pictures of read pages, sources of downloaded pictures.
  function observe(ev) {
    if (!ev || typeof ev !== "object") return;
    if (ev.type === "images" && Array.isArray(ev.urls)) ev.urls.slice(0, 200).forEach(add);
    else if (ev.type === "file" && ev.file && typeof ev.file === "object") add(ev.file.sourceUrl);
  }
  // Saved chats (store.loadChats): the same provenance recorded with each answer (message.agent.images / files).
  function fromChats(list) {
    if (!Array.isArray(list)) return;
    for (const c of list.slice(0, 2000)) {
      const msgs = c && Array.isArray(c.messages) ? c.messages : [];
      for (const m of msgs) {
        const a = m && m.agent;
        if (!a || typeof a !== "object") continue;
        if (Array.isArray(a.images)) a.images.slice(0, 200).forEach(add);
        if (Array.isArray(a.files)) a.files.slice(0, 100).forEach((f) => f && add(f.sourceUrl));
      }
    }
  }
  return { add, observe, fromChats, has: (u) => seen.has(u), clear: () => seen.clear(), get size() { return seen.size; } };
}
