import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CmsComponent,
  CmsPage,
  ensureStaff,
  fetchComponents,
  fetchPages,
  previewUrlForSlug,
  signOut
} from "./api";
import { mergeCatalog } from "./componentCatalog";
import { postToIframe, type PreviewComponentPayload } from "./previewBridge";
import { Login } from "./components/Login";
import { ComponentEditor } from "./components/ComponentEditor";
import { ArchivePanel } from "./components/ArchivePanel";
import { CitiesPanel } from "./components/CitiesPanel";
import { BankPanel } from "./components/BankPanel";
import { AgentPanel } from "./components/AgentPanel";

type Tab = "pages" | "archive" | "cities" | "bank" | "agent" | "display";

const FALLBACK_PAGES: CmsPage[] = [
  { id: "local-home", slug: "/", label: "Desktop home", schema_version: 1 },
  { id: "local-burgas", slug: "#/city/burgas", label: "City – Burgas", schema_version: 1 },
  { id: "local-varna", slug: "#/city/varna", label: "City – Varna", schema_version: 1 },
  { id: "local-shumen", slug: "#/city/shumen", label: "City – Shumen", schema_version: 1 },
  { id: "local-bank", slug: "/bank/", label: "Bank luxury storefront", schema_version: 1 },
  { id: "local-mobile", slug: "/mobile/", label: "Mobile home", schema_version: 1 }
];

const WALKTHROUGH =
  typeof window !== "undefined" &&
  (new URLSearchParams(window.location.search).has("walkthrough") ||
    localStorage.getItem("imoti-settings-walkthrough") === "1" ||
    !window.imotiSettings);

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [walkthrough, setWalkthrough] = useState(WALKTHROUGH);
  const [tab, setTab] = useState<Tab>("pages");
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [slug, setSlug] = useState("/");
  const [components, setComponents] = useState<CmsComponent[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [toast, setToastMsg] = useState("");
  const [creating, setCreating] = useState(false);
  const [scale, setScale] = useState(0.48);
  const [device, setDevice] = useState("desktop");
  const [liveMap, setLiveMap] = useState<Record<string, PreviewComponentPayload>>({});
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasElectron = !!window.imotiSettings;

  const toastMsg = useCallback((m: string) => {
    setToastMsg(m);
    window.setTimeout(() => setToastMsg(""), 3200);
  }, []);

  const boot = useCallback(async () => {
    if (walkthrough) {
      setAuthed(true);
      setPages(FALLBACK_PAGES);
      setReady(true);
      return;
    }
    const s = await ensureStaff();
    setAuthed(!!s);
    setReady(true);
    if (s) {
      try {
        const list = await fetchPages();
        setPages(list.length ? list : FALLBACK_PAGES);
      } catch {
        setPages(FALLBACK_PAGES);
      }
    }
  }, [walkthrough]);

  useEffect(() => { void boot(); }, [boot]);

  const pushPreview = useCallback(async (list: PreviewComponentPayload[], highlightKey: string | null) => {
    if (hasElectron) {
      try {
        await window.imotiSettings?.previewApply?.(list, highlightKey);
      } catch {
        /* ignore */
      }
      return;
    }
    postToIframe(iframeRef.current, list, highlightKey);
  }, [hasElectron]);

  const loadComponents = useCallback(async (pageSlug: string) => {
    try {
      let fromDb: CmsComponent[] = [];
      if (!walkthrough) {
        const { components: comps } = await fetchComponents(pageSlug);
        fromDb = comps;
      }
      const merged = mergeCatalog(pageSlug, fromDb);
      setComponents(merged);
      setSelectedKey((prev) => {
        if (prev && merged.some((c) => c.component_key === prev)) return prev;
        return merged[0]?.component_key || null;
      });
      const seed: Record<string, PreviewComponentPayload> = {};
      for (const c of merged) {
        seed[c.component_key] = { component_key: c.component_key, type: c.type, props: c.props || {} };
      }
      setLiveMap(seed);
      await pushPreview(Object.values(seed), merged[0]?.component_key || null);
    } catch (e) {
      toastMsg(e instanceof Error ? e.message : String(e));
      const merged = mergeCatalog(pageSlug, []);
      setComponents(merged);
      setSelectedKey(merged[0]?.component_key || null);
    }
  }, [walkthrough, toastMsg, pushPreview]);

  useEffect(() => {
    if (!authed || tab !== "pages") return;
    void loadComponents(slug);
    const url = walkthrough || !hasElectron
      ? `./walkthrough-preview.html?slug=${encodeURIComponent(slug)}`
      : previewUrlForSlug(slug);
    if (hasElectron && !walkthrough) {
      void window.imotiSettings?.previewNavigate(previewUrlForSlug(slug));
    } else if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  }, [authed, slug, tab, loadComponents, walkthrough, hasElectron]);

  useEffect(() => {
    void window.imotiSettings?.setPreviewRatio(tab === "agent" ? 0.28 : scale);
  }, [scale, tab]);

  const selected = useMemo(
    () => components.find((c) => c.component_key === selectedKey) || null,
    [components, selectedKey]
  );

  const onSelectComponent = useCallback((key: string) => {
    setSelectedKey(key);
    setCreating(false);
    const list = Object.values(liveMap);
    void pushPreview(list.length ? list : components.map((c) => ({
      component_key: c.component_key,
      type: c.type,
      props: c.props || {}
    })), key);
  }, [liveMap, components, pushPreview]);

  const onLiveChange = useCallback((draft: PreviewComponentPayload) => {
    setLiveMap((prev) => {
      const next = { ...prev, [draft.component_key]: draft };
      void pushPreview(Object.values(next), draft.component_key);
      return next;
    });
  }, [pushPreview]);

  useEffect(() => {
    const onLoad = () => {
      const list = Object.values(liveMap);
      if (list.length) void pushPreview(list, selectedKey);
    };
    const iframe = iframeRef.current;
    iframe?.addEventListener("load", onLoad);
    return () => iframe?.removeEventListener("load", onLoad);
  }, [liveMap, selectedKey, pushPreview]);

  if (!ready) return <div className="login"><p>Loading…</p></div>;
  if (!authed) {
    return (
      <Login
        onOk={() => void boot()}
        onWalkthrough={() => {
          localStorage.setItem("imoti-settings-walkthrough", "1");
          setWalkthrough(true);
          setAuthed(true);
          setPages(FALLBACK_PAGES);
        }}
      />
    );
  }

  const showIframePreview = walkthrough || !hasElectron;

  return (
    <div className={"app" + (showIframePreview ? " walkthrough" : "")}>
      <header className="topbar">
        <img src="./assets/logo.png" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <h1>Imoti Nadezhda Settings</h1>
        <span className="meta">
          {walkthrough ? "Walkthrough · mock staff · live editors" : "Windows companion · CMS → live site"}
        </span>
        <span className="spacer" />
        <button
          type="button"
          className="ghost"
          onClick={() => {
            if (hasElectron && !walkthrough) void window.imotiSettings?.previewReload();
            else if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
          }}
        >
          Reload preview
        </button>
        <button
          type="button"
          className="ghost"
          onClick={async () => {
            if (!walkthrough) await signOut();
            localStorage.removeItem("imoti-settings-walkthrough");
            setWalkthrough(false);
            setAuthed(false);
          }}
        >
          Sign out
        </button>
      </header>

      <aside className="sidebar">
        <div className="nav-tabs">
          {([
            ["pages", "Pages"],
            ["agent", "Agent"],
            ["archive", "Archive"],
            ["cities", "Cities"],
            ["bank", "Bank"],
            ["display", "Display"]
          ] as [Tab, string][]).map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === "pages" && (
          <>
            <h2>Site pages</h2>
            {(pages.length ? pages : FALLBACK_PAGES).map((p) => (
              <button
                key={p.id || p.slug}
                type="button"
                className={"page-btn" + (p.slug === slug ? " active" : "")}
                onClick={() => { setSlug(p.slug); setCreating(false); }}
              >
                {p.label}
                <small>{p.slug}</small>
              </button>
            ))}
            <h2>Components ({components.length})</h2>
            {components.length === 0 && <div className="empty">No components — catalog failed to load.</div>}
            {components.map((c) => (
              <button
                key={c.id || c.component_key}
                type="button"
                className={"comp-btn" + (c.component_key === selectedKey && !creating ? " active" : "")}
                onClick={() => onSelectComponent(c.component_key)}
              >
                {typeof c.props?._label === "string" ? String(c.props._label) : c.component_key}
                <small>{c.type} · {c.component_key}</small>
              </button>
            ))}
            <div className="actions">
              <button type="button" className="primary" onClick={() => { setCreating(true); setSelectedKey(null); }}>
                + New component
              </button>
            </div>
          </>
        )}

        {tab === "agent" && (
          <>
            <h2>TED Agent</h2>
            <p className="muted" style={{ padding: "0 6px" }}>
              Dedicated chat inside Settings only. Skill „Видео за имот“ / <code>property_cinematic_video</code> lives here — not on the public site.
            </p>
          </>
        )}
      </aside>

      <main className="main">
        {showIframePreview ? (
          <div className={"preview-frame device-" + device}>
            <iframe
              ref={iframeRef}
              title="Settings live preview"
              className="preview-iframe"
              src={`./walkthrough-preview.html?slug=${encodeURIComponent(slug)}`}
            />
          </div>
        ) : (
          <div className="preview-slot" aria-hidden />
        )}
        <div className="workspace">
          {tab === "pages" && (
            <ComponentEditor
              pageSlug={slug}
              component={creating ? null : selected}
              creating={creating}
              onSaved={() => void loadComponents(slug)}
              onLiveChange={onLiveChange}
              toast={toastMsg}
            />
          )}
          {tab === "archive" && <ArchivePanel toast={toastMsg} />}
          {tab === "cities" && <CitiesPanel toast={toastMsg} />}
          {tab === "bank" && <BankPanel toast={toastMsg} />}
          {tab === "agent" && <AgentPanel toast={toastMsg} />}
          {tab === "display" && (
            <div className="card">
              <h3>Resolution / display</h3>
              <label className="field">
                <span>Preview height ratio</span>
                <input type="range" min={0.28} max={0.7} step={0.02} value={scale} onChange={(e) => setScale(Number(e.target.value))} />
              </label>
              <label className="field" style={{ marginTop: 12 }}>
                <span>Device frame preset</span>
                <select value={device} onChange={(e) => setDevice(e.target.value)}>
                  <option value="desktop">Desktop 1440×900</option>
                  <option value="laptop">Laptop 1280×800</option>
                  <option value="mobile">Mobile 390×844</option>
                </select>
              </label>
              <p className="muted">Install default path: D:\ImotiNadezhda-Settings</p>
            </div>
          )}
        </div>
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
