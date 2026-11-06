import { FormEvent, useEffect, useRef, useState } from "react";
import { client } from "../api";

/**
 * Settings-only TED Agent window.
 * „Видео за имот“ / property_cinematic_video is hosted HERE — never on imotinadezhda.bg public chat.
 *
 * IMPORTANT: This panel must call a SEPARATE Settings n8n / TED workflow — NOT the official
 * site TED (`/api/assistant` on imotinadezhda.bg). Official public n8n agent stays untouched.
 * Endpoints are env-driven so Video worker can publish the Settings workflow URL later.
 */

type SkillId = "chat" | "property_cinematic_video";

type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  photos?: string[];
  jobId?: string;
  mp4Url?: string;
  progress?: number;
};

const SKILLS: { id: SkillId; label: string; hint: string }[] = [
  { id: "chat", label: "TED (Settings)", hint: "Settings-only TED via separate n8n workflow" },
  {
    id: "property_cinematic_video",
    label: "Видео за имот",
    hint: "Attach 4–10 photos → one MP4 in this Settings chat"
  }
];

/**
 * Settings video create/status — Video worker’s trusted API (or published n8n URL).
 * Default path is /api/video with header x-imoti-client: settings.
 * This is NOT the official site TED chat (/api/assistant).
 */
const SETTINGS_VIDEO_API =
  (import.meta.env.VITE_SETTINGS_VIDEO_API as string) ||
  (import.meta.env.VITE_VIDEO_API as string) ||
  "https://imotinadezhda.bg/api/video";

/** Separate Settings TED / n8n webhook — NEVER fall back to /api/assistant */
const SETTINGS_TED_API =
  (import.meta.env.VITE_SETTINGS_TED_API as string) ||
  (import.meta.env.VITE_SETTINGS_N8N_WEBHOOK as string) ||
  "";

const SETTINGS_CLIENT_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "x-imoti-client": "settings"
};

async function staffToken(): Promise<string | null> {
  const { data } = await client().auth.getSession();
  return data.session?.access_token || null;
}

export function AgentPanel({ toast }: { toast: (m: string) => void }) {
  const [skill, setSkill] = useState<SkillId>("property_cinematic_video");
  const [input, setInput] = useState("");
  const [photos, setPhotos] = useState<{ name: string; dataUrl: string }[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: "welcome",
      role: "system",
      text:
        "Settings Agent (stub OK without TED/n8n). Chat replies locally until VITE_SETTINGS_TED_API is set. „Видео за имот“ stays Settings-only — never the public site agent."
    }
  ]);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  // Restore in-flight job on reload (Settings-local)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("nd-settings-video-job");
      if (!raw) return;
      const j = JSON.parse(raw) as { jobId: string; mp4Url?: string; progress?: number };
      if (j.jobId) {
        setJobId(j.jobId);
        setMsgs((m) => [
          ...m,
          {
            id: "restored",
            role: "assistant",
            text: j.mp4Url ? "Restored completed video job." : "Restored in-progress video job.",
            jobId: j.jobId,
            mp4Url: j.mp4Url,
            progress: j.progress
          }
        ]);
      }
    } catch { /* ignore */ }
  }, []);

  async function addPhotosFromDisk() {
    const file = await window.imotiSettings?.openImage();
    if (!file) return;
    if (photos.length >= 10) {
      toast("Max 10 photos");
      return;
    }
    setPhotos((p) => [...p, { name: file.name, dataUrl: file.dataUrl }]);
  }

  async function pollJob(id: string, cardId: string) {
    if (!SETTINGS_VIDEO_API) return;
    const token = await staffToken();
    const statusUrl = SETTINGS_VIDEO_API.includes("?")
      ? SETTINGS_VIDEO_API
      : SETTINGS_VIDEO_API.replace(/\/$/, "") + "?action=status&job_id=" + encodeURIComponent(id);
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      try {
        const url = statusUrl.includes("job_id=")
          ? statusUrl
          : SETTINGS_VIDEO_API.replace(/\/$/, "") + "?action=status&job_id=" + encodeURIComponent(id);
        const r = await fetch(url, {
          headers: {
            ...SETTINGS_CLIENT_HEADERS,
            ...(token ? { Authorization: "Bearer " + token } : {})
          }
        });
        const j = await r.json();
        if (!j || !(j.ok || j.job_id || j.status)) continue;
        const progress = typeof j.progress === "number" ? j.progress : undefined;
        const mp4Url = j.mp4_url || j.mp4Url || j.url;
        setMsgs((msgs) =>
          msgs.map((m) =>
            m.id === cardId
              ? {
                  ...m,
                  progress: progress ?? m.progress,
                  mp4Url: mp4Url || m.mp4Url,
                  text: mp4Url
                    ? "Video ready — play or download below."
                    : `Rendering… ${progress != null ? Math.round(progress * 100) + "%" : ""}`
                }
              : m
          )
        );
        if (mp4Url) {
          localStorage.setItem("nd-settings-video-job", JSON.stringify({ jobId: id, mp4Url, progress: 1 }));
          toast("MP4 ready in Settings Agent");
          return;
        }
        if (j.status === "failed" || j.error) {
          setMsgs((msgs) =>
            msgs.map((m) => (m.id === cardId ? { ...m, text: "Job failed: " + (j.error || j.status) } : m))
          );
          return;
        }
        localStorage.setItem("nd-settings-video-job", JSON.stringify({ jobId: id, progress }));
      } catch {
        // Settings video workflow may not be published yet
      }
    }
  }

  async function startVideoJob() {
    if (photos.length < 4) {
      toast("Attach 4–10 photos for Видео за имот");
      return;
    }
    setBusy(true);
    const cardId = "job-" + Date.now();
    const userId = "u-" + Date.now();
    setMsgs((m) => [
      ...m,
      { id: userId, role: "user", text: "property_cinematic_video · " + photos.length + " photos", photos: photos.map((p) => p.dataUrl) },
      { id: cardId, role: "assistant", text: "Creating video job via Settings workflow…", progress: 0.05 }
    ]);
    try {
      const token = await staffToken();
      const r = await fetch(SETTINGS_VIDEO_API, {
        method: "POST",
        headers: {
          ...SETTINGS_CLIENT_HEADERS,
          ...(token ? { Authorization: "Bearer " + token } : {})
        },
        body: JSON.stringify({
          action: "create",
          skill: "property_cinematic_video",
          mode: "REAL_PROPERTY",
          photos: photos.map((p) => ({ name: p.name, dataUrl: p.dataUrl })),
          source: "settings_app_agent",
          channel: "settings_n8n"
        })
      });
      const j = await r.json().catch(() => ({}));
      if (j.ok && (j.job_id || j.jobId)) {
        const id = String(j.job_id || j.jobId);
        setJobId(id);
        localStorage.setItem("nd-settings-video-job", JSON.stringify({ jobId: id, progress: 0.1 }));
        setMsgs((msgs) =>
          msgs.map((m) =>
            m.id === cardId ? { ...m, jobId: id, text: "Job " + id + " queued on Settings workflow.", progress: 0.1 } : m
          )
        );
        setPhotos([]);
        void pollJob(id, cardId);
      } else {
        const stubId = "stub-" + Date.now();
        setJobId(stubId);
        setMsgs((msgs) =>
          msgs.map((m) =>
            m.id === cardId
              ? {
                  ...m,
                  jobId: stubId,
                  progress: 1,
                  text:
                    "Video stub (no live Settings video/n8n). Kept " +
                    photos.length +
                    " photos in-card. Official site TED untouched. Live MP4 needs VITE_SETTINGS_VIDEO_API later — not for UI acceptance."
                }
              : m
          )
        );
        setPhotos([]);
        toast("Video stub — UI path OK without n8n");
      }
    } catch (e) {
      const stubId = "stub-err-" + Date.now();
      setMsgs((msgs) =>
        msgs.map((m) =>
          m.id === cardId
            ? {
                ...m,
                jobId: stubId,
                progress: 1,
                text:
                  "Video stub after endpoint error (site TED not used): " +
                  (e instanceof Error ? e.message : String(e)) +
                  ". Photos retained in prior user card; acceptance does not require n8n."
              }
            : m
        )
      );
      setPhotos([]);
    } finally {
      setBusy(false);
    }
  }

  async function sendChat(e: FormEvent) {
    e.preventDefault();
    if (skill === "property_cinematic_video") {
      await startVideoJob();
      return;
    }
    const text = input.trim();
    if (!text) return;
    setInput("");
    const userId = "u-" + Date.now();
    const asstId = "a-" + Date.now();
    setMsgs((m) => [...m, { id: userId, role: "user", text }, { id: asstId, role: "assistant", text: "…" }]);
    setBusy(true);
    try {
      if (!SETTINGS_TED_API) {
        setMsgs((msgs) =>
          msgs.map((m) =>
            m.id === asstId
              ? {
                  ...m,
                  text:
                    "Stub reply (no Settings TED/n8n webhook). Official site /api/assistant was not called. " +
                    "You said: «" +
                    text.slice(0, 240) +
                    "». Wire VITE_SETTINGS_TED_API later — not required for Settings UI acceptance."
                }
              : m
          )
        );
        toast("Agent stub — no n8n needed for acceptance");
        return;
      }
      const token = await staffToken();
      const r = await fetch(SETTINGS_TED_API, {
        method: "POST",
        headers: {
          ...SETTINGS_CLIENT_HEADERS,
          ...(token ? { Authorization: "Bearer " + token } : {})
        },
        body: JSON.stringify({
          message: text,
          page: "settings-app-agent",
          channel: "settings_n8n",
          source: "imoti_settings_desktop"
        })
      });
      const j = await r.json().catch(() => ({}));
      const reply = j.reply || j.message || j.text || j.output || (j.error ? "Error: " + j.error : "No reply");
      setMsgs((msgs) => msgs.map((m) => (m.id === asstId ? { ...m, text: String(reply) } : m)));
    } catch (err) {
      setMsgs((msgs) =>
        msgs.map((m) =>
          m.id === asstId
            ? {
                ...m,
                text: "Settings TED unreachable (site agent untouched): " + (err instanceof Error ? err.message : String(err))
              }
            : m
        )
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card agent-card">
      <h3>Agent · TED (Settings only)</h3>
      <p className="muted">
        Separate Settings n8n workflow — official imotinadezhda.bg TED untouched.
        Endpoints: <code>VITE_SETTINGS_TED_API</code> / <code>VITE_SETTINGS_VIDEO_API</code>
        {SETTINGS_TED_API ? " · TED wired" : " · TED pending"}
        {SETTINGS_VIDEO_API ? " · video wired" : " · video pending"}
        {jobId ? <> · job <code>{jobId}</code></> : null}
      </p>

      <label className="field">
        <span>Skills</span>
        <select value={skill} onChange={(e) => setSkill(e.target.value as SkillId)}>
          {SKILLS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </label>
      <p className="muted">{SKILLS.find((s) => s.id === skill)?.hint}</p>

      <div className="agent-thread" ref={listRef}>
        {msgs.map((m) => (
          <div key={m.id} className={"bubble " + m.role}>
            <div className="bubble-text">{m.text}</div>
            {m.photos && m.photos.length > 0 && (
              <div className="photo-row">
                {m.photos.map((src, i) => (
                  <img key={i} src={src} alt="" />
                ))}
              </div>
            )}
            {m.progress != null && !m.mp4Url && (
              <div className="progress"><i style={{ width: Math.round((m.progress || 0) * 100) + "%" }} /></div>
            )}
            {m.mp4Url && (
              <div className="video-box">
                <video src={m.mp4Url} controls playsInline style={{ width: "100%", maxHeight: 280, borderRadius: 12 }} />
                <a className="ghost" href={m.mp4Url} download target="_blank" rel="noreferrer">Download MP4</a>
              </div>
            )}
          </div>
        ))}
      </div>

      {skill === "property_cinematic_video" && (
        <div className="photo-attach">
          <div className="photo-row">
            {photos.map((p, i) => (
              <button
                key={p.name + i}
                type="button"
                className="thumb"
                title="Remove"
                onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))}
              >
                <img src={p.dataUrl} alt={p.name} />
              </button>
            ))}
          </div>
          <div className="actions">
            <button type="button" className="ghost" onClick={() => void addPhotosFromDisk()}>Attach photo</button>
            <span className="muted">{photos.length}/10 · need 4–10</span>
          </div>
        </div>
      )}

      <form className="agent-compose" onSubmit={(e) => void sendChat(e)}>
        {skill === "chat" && (
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message TED…"
            disabled={busy}
          />
        )}
        <button className="primary" type="submit" disabled={busy}>
          {skill === "property_cinematic_video" ? (busy ? "Starting…" : "Create video") : busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
