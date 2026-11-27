// 0.1.9 „Чатове“ (docs/CONTRACT.md §24): the pure helpers and the controller of electron/social-panel.js with fakes.
import { describe, it, expect } from "vitest";
import {
  SOCIAL_KEYS, SOCIAL_SITES, sitePageUrl, unreadFromTitle, socialPartition, socialPermission, socialDownloadSource,
  socialDownloadAllowed, createSocialPanel,
} from "../../electron/social-panel.js";

describe("social panel helpers", () => {
  it("knows exactly the three sites, each with an https home on its own domains", () => {
    expect(SOCIAL_KEYS).toEqual(["messenger", "instagram", "whatsapp"]);
    for (const k of SOCIAL_KEYS) expect(sitePageUrl(k, SOCIAL_SITES[k].home), k).not.toBeNull();
  });

  it("top-level pages only on the site's domains (https, no user, no port, no look-alikes)", () => {
    expect(sitePageUrl("whatsapp", "https://web.whatsapp.com/")).not.toBeNull();
    expect(sitePageUrl("whatsapp", "https://www.facebook.com/")).toBeNull();
    expect(sitePageUrl("messenger", "https://business.facebook.com/latest/inbox/all")).not.toBeNull();
    expect(sitePageUrl("messenger", "https://www.messenger.com/t/1")).not.toBeNull();
    expect(sitePageUrl("messenger", "https://facebook.com.evil.test/")).toBeNull();
    expect(sitePageUrl("messenger", "http://www.facebook.com/")).toBeNull();
    expect(sitePageUrl("messenger", "https://u:p@www.facebook.com/")).toBeNull();
    expect(sitePageUrl("messenger", "https://www.facebook.com:8443/")).toBeNull();
    expect(sitePageUrl("instagram", "https://www.instagram.com/direct/inbox/")).not.toBeNull();
    expect(sitePageUrl("nope", "https://www.instagram.com/")).toBeNull();
  });

  it("reads the unread number from the site's own tab title", () => {
    expect(unreadFromTitle("(3) WhatsApp")).toBe(3);
    expect(unreadFromTitle(" (12) Instagram • Chats")).toBe(12);
    expect(unreadFromTitle("(99+) Messenger")).toBe(99);
    expect(unreadFromTitle("WhatsApp")).toBe(0);
    expect(unreadFromTitle("Meta Business Suite (4)")).toBe(0);
    expect(unreadFromTitle(null)).toBe(0);
  });

  it("one partition per site and CRM user", () => {
    const a = socialPartition("whatsapp", "u1");
    expect(a).toMatch(/^persist:social-whatsapp-[0-9a-f]{16}$/);
    expect(socialPartition("whatsapp", "u2")).not.toBe(a);
    expect(socialPartition("messenger", "u1")).not.toBe(a);
  });

  it("permissions: notifications, copy and the microphone (audio only) – only for the site's own pages", () => {
    expect(socialPermission("whatsapp", "notifications", "https://web.whatsapp.com/")).toBe(true);
    expect(socialPermission("whatsapp", "notifications", "https://evil.test/")).toBe(false);
    expect(socialPermission("whatsapp", "media", "https://web.whatsapp.com/", { mediaTypes: ["audio"] })).toBe(true);
    expect(socialPermission("whatsapp", "media", "https://web.whatsapp.com/", { mediaTypes: ["audio", "video"] })).toBe(false);
    expect(socialPermission("whatsapp", "geolocation", "https://web.whatsapp.com/")).toBe(false);
    expect(socialPermission("messenger", "notifications", "https://web.whatsapp.com/")).toBe(false);
  });

  it("downloads only from the sites' CDNs and only harmless types", () => {
    expect(socialDownloadSource("https://scontent.xx.fbcdn.net/v/a.jpg")).toBe("scontent.xx.fbcdn.net");
    expect(socialDownloadSource("blob:https://web.whatsapp.com/1234")).toBe("web.whatsapp.com");
    expect(socialDownloadSource("https://evil.test/a.jpg")).toBeNull();
    expect(socialDownloadSource("data:image/png;base64,AAAA")).toBeNull();
    expect(socialDownloadAllowed("снимка.jpg")).toBe(true);
    expect(socialDownloadAllowed("voice.ogg")).toBe(true);
    expect(socialDownloadAllowed("setup.exe")).toBe(false);
    expect(socialDownloadAllowed("a.jpg.lnk")).toBe(false);
  });
});

// ---- the controller with fakes ----
function fakes({ user = "u1" } = {}) {
  const pushed = [];
  const badges = [];
  const made = [];
  const listeners = () => { const m = new Map(); return { on: (e, f) => { m.set(e, f); }, once: (e, f) => { m.set(e, f); }, fire: (e, ...a) => { const f = m.get(e); if (f) f(...a); } }; };
  class WebContentsView {
    constructor(opts) {
      this.opts = opts; this.visible = null; this.bounds = null; this.radius = 0;
      const l = listeners();
      this.webContents = { ...l, session: opts.webPreferences.session, loaded: [], destroyed: false, isDestroyed() { return this.destroyed; }, loadURL(u) { this.loaded.push(u); return Promise.resolve(); }, setUserAgent() {}, setWindowOpenHandler(f) { this.openHandler = f; }, reload() {}, close() { this.destroyed = true; } };
      made.push(this);
    }
    setVisible(v) { this.visible = v; }
    setBounds(b) { this.bounds = b; }
    setBackgroundColor() {}
    setBorderRadius(r) { this.radius = r; }
  }
  const children = new Set();
  const win = { isDestroyed: () => false, once() {}, webContents: { getZoomFactor: () => 1 }, contentView: { addChildView: (v) => children.add(v), removeChildView: (v) => children.delete(v) } };
  const sessions = new Map();
  const fromPartition = (name) => { if (!sessions.has(name)) sessions.set(name, { name, setUserAgent() {}, setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, setDevicePermissionHandler() {}, on() {}, webRequest: { onBeforeSendHeaders() {} } }); return sessions.get(name); };
  let owner = user;
  const panel = createSocialPanel({
    WebContentsView, fromPartition, getWindow: () => win, openExternal: async () => ({ ok: true }), owner: () => owner,
    userAgent: "Mozilla/5.0 Chrome/140.0.0.0", emit: (s) => pushed.push(s), onUnread: (n) => badges.push(n),
  });
  return { panel, pushed, badges, made, children, setOwner: (o) => { owner = o; } };
}

describe("social panel controller", () => {
  it("opens nothing before a click and nothing for an unknown site or a signed-out employee", () => {
    const f = fakes();
    expect(f.panel.created()).toBe(0);
    expect(f.panel.open({ site: "telegram" }).ok).toBe(false);
    f.setOwner(null);
    expect(f.panel.open({ site: "whatsapp" }).code).toBe("signed_out");
    expect(f.made).toHaveLength(0);
  });

  it("loads the site's own home once, with rounded corners, shown only over a visible placeholder", () => {
    const f = fakes();
    expect(f.panel.open({ site: "whatsapp" }).ok).toBe(true);
    const v = f.made[0];
    expect(v.webContents.loaded).toEqual([SOCIAL_SITES.whatsapp.home]);
    expect(v.radius).toBe(18);
    expect(v.opts.webPreferences).not.toHaveProperty("preload");
    expect(v.opts.webPreferences.sandbox).toBe(true);
    expect(v.visible).toBe(false);
    f.panel.setBounds({ x: 500, y: 80, width: 400, height: 600, visible: true });
    expect(v.visible).toBe(true);
    expect(v.bounds).toEqual({ x: 500, y: 80, width: 400, height: 600 });
    f.panel.open({ site: "whatsapp" });
    expect(v.webContents.loaded).toHaveLength(1); // not loaded again
  });

  it("switching sites keeps the first page loaded in the background; × hides the card, the badge keeps coming", () => {
    const f = fakes();
    f.panel.open({ site: "whatsapp" });
    f.panel.setBounds({ x: 500, y: 80, width: 400, height: 600, visible: true });
    f.panel.open({ site: "messenger" });
    const [wa, ms] = f.made;
    expect(wa.visible).toBe(false);
    expect(f.children.has(wa)).toBe(false);
    expect(ms.webContents.loaded).toEqual([SOCIAL_SITES.messenger.home]);
    f.panel.close();
    expect(f.panel.state().open).toBe(false);
    wa.webContents.fire("page-title-updated", {}, "(4) WhatsApp");
    expect(f.panel.state().unread.whatsapp).toBe(4);
    expect(f.badges.at(-1)).toBe(4);
    expect(wa.webContents.destroyed).toBe(false);
  });

  it("a CRM sign-out destroys every page and clears the badges", () => {
    const f = fakes();
    f.panel.open({ site: "instagram" });
    f.made[0].webContents.fire("page-title-updated", {}, "(2) Instagram");
    f.panel.detach();
    expect(f.made[0].webContents.destroyed).toBe(true);
    expect(f.panel.state().unread.instagram).toBe(0);
    expect(f.badges.at(-1)).toBe(0);
  });
});
