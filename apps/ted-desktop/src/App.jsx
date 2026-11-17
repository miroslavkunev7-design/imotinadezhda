import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ted } from "./bridge.js";
import Icon from "./components/Icon.jsx";
import { Avatar, It, Modal, Pop, usePhone, usePop } from "./components/ui.jsx";
import Md from "./components/Md.jsx";
import { ActionsCard, EmailCard, ListingCards, PanelCard, SkillPanel, openCrm } from "./components/Cards.jsx";
import Login from "./components/Login.jsx";
import Canvas from "./components/Canvas.jsx";
import VoiceMode from "./components/VoiceMode.jsx";
import RealGptConnect from "./components/RealGptConnect.jsx";
import { AttachProp, DocsModal, propFile } from "./components/Attach.jsx";
import Sidebar from "./components/layout/Sidebar.jsx";
import PhoneDrawer from "./components/layout/PhoneDrawer.jsx";
import TopBar, { ModeToggle } from "./components/layout/TopBar.jsx";
import Home, { HomeChips, HomePlugins } from "./components/layout/Home.jsx";
import Composer from "./components/layout/Composer.jsx";
import PlusMenu from "./components/layout/PlusMenu.jsx";
import { AdvancedPop, ModelItems } from "./components/layout/ModelEffortPill.jsx";
import SettingsView, { SHORTCUTS } from "./components/layout/SettingsView.jsx";
import ProjectsPage from "./components/layout/ProjectsPage.jsx";
import ScheduledPage from "./components/layout/ScheduledPage.jsx";
import LibraryPage from "./components/layout/LibraryPage.jsx";
import PluginsPage, { pluginRows } from "./components/layout/PluginsPage.jsx";
import AgentsPage from "./components/layout/AgentsPage.jsx";
import UpdateBanner from "./components/layout/UpdateBanner.jsx";
import VideoWizard from "./components/layout/VideoWizard.jsx";
import AgentSteps from "./components/agent/AgentSteps.jsx";
import ApprovalCard from "./components/agent/ApprovalCard.jsx";
import ConsentModal from "./components/agent/ConsentModal.jsx";
import FileCard from "./components/agent/FileCard.jsx";
import ToolsUnsupportedCard from "./components/agent/ToolsUnsupportedCard.jsx";
import VideoCard from "./components/agent/VideoCard.jsx";
import { agentSnapshot, useAgentEvents } from "./lib/agent.js";
import { DEF_SETTINGS, GROUPS, NOTIFY_DEF, RG_SIGNIN_CODES, RG_USAGE_URL, ROLES, SESSION_NOTE, WRITE_EX, effortName, hintOf, modeOf, roleOf } from "./lib/consts.js";
import { dayGroup, extOf, firstName, fmtClock, fmtDate, fmtSize, initials, now, uid } from "./lib/format.js";
import { LIMITS, addFiles, chipOf, composeText, engineProblem, libItem } from "./lib/files.js";
import { affirmGuard, answerChanged, chatMarkdown, cleanChats, unfinished, emailBlock, emailResult, histText, markFromReply, newestEmailId, newestInterrupted, raiseMark, readMark, rgHistory, safeFileName, serverHistory } from "./lib/chat.js";
import { createSpeaker, startRecorder } from "./lib/voice.js";
import avatar from "./assets/avatar.webp";

const STOP_NOTE = "Спряно изчакването. Ако Тед вече е започнал действие на сървъра, то може да бъде довършено – проверете в CRM.";
const MAYBE_NOTE = "Възможно е действието вече да е изпълнено на сървъра. Проверете в CRM, преди да опитате отново.";
const QUOTA_NOTE = "Ако Тед е започнал действие, преди да спре заради лимита, то може вече да е изпълнено – проверете в CRM, преди да опитате отново.";
const CONN_TEXT = { ok: "Свързан с imotinadezhda.bg", off: "Няма връзка", wait: "Проверка на връзката…", out: "Излезли сте" };
const CHATS_SHOWN = 20; // ChatGPT „Recents“: the newest chats, the rest through „Вижте всички…“
const drafts = new Map(); // unsent composer text per profile, kept if the session expires

/* ---------- Window frame: the title bar is the drag region; Windows draws its own caption buttons ---------- */
function Shell({ phone, conn, onQuick, children }) {
  return (
    <div className={"shell tedwin" + (phone ? " phone" : "")}>
      <div className="winbar" aria-label="Прозорец на програмата">
        <img src={avatar} alt="" /><b>Тед</b><span className="wb-sub">Имоти Надежда · Тед за Windows</span>
        <span className={"wb-st " + conn} data-testid="conn"><i />{CONN_TEXT[conn]}</span>
        {onQuick ? <button className="wbtn wq" aria-label="Бърз прозорец" title="Бърз прозорец (Ctrl + Shift + Space)" onClick={onQuick}>⚡</button> : null}
      </div>
      {children}
    </div>
  );
}

/* ---------- Sign-in gate ---------- */
export default function Root() {
  const [auth, setAuth] = useState(null);
  const [notice, setNotice] = useState("");
  const leaving = useRef(false);
  const phone = usePhone();

  useEffect(() => {
    let off = false;
    ted.auth.state().then((s) => { if (!off) setAuth(s && s.status === "signedIn" ? s : { status: "signedOut" }); }, () => { if (!off) setAuth({ status: "signedOut" }); });
    const un = ted.auth.onChange((s) => {
      if (!s) return;
      setAuth((prev) => {
        if (s.status !== "signedIn" && prev && prev.status === "signedIn" && !leaving.current) setNotice("Сесията е изтекла – влезте отново.");
        return s.status === "signedIn" ? s : { status: "signedOut" };
      });
    });
    return () => { off = true; if (typeof un === "function") un(); };
  }, []);

  async function logout() {
    leaving.current = true;
    try { await ted.auth.logout(); } catch { /* the session is dropped locally anyway */ }
    setNotice(""); setAuth({ status: "signedOut" });
    leaving.current = false;
  }

  if (!auth) return <Shell phone={phone} conn="wait"><div className="login"><span className="wait boot"><i className="spin" /> Зареждане…</span></div></Shell>;
  // After a login the full AuthState (with `remembered`) is read back; login itself returns only the user.
  async function loggedIn(user) {
    setNotice("");
    let s = null;
    try { s = await ted.auth.state(); } catch { s = null; }
    setAuth(s && s.status === "signedIn" && s.user ? s : { status: "signedIn", user });
  }

  if (auth.status !== "signedIn" || !auth.user) {
    return (
      <Shell phone={phone} conn="out">
        <Login notice={notice} onLogin={loggedIn} />
      </Shell>
    );
  }
  return <App key={auth.user.id} user={auth.user} remembered={auth.remembered !== false} onLogout={logout} />;
}

// The server answers in one piece (up to ~2 min). Only the elapsed time is real; the line under it is a
// hint chosen by time, never a claimed step.
const WAIT_LIMIT_MS = 120000;
const waitHint = (ms) => (ms < 4000 ? "Тед мисли…" : ms < 30000 ? "Тед работи – може да ползва CRM, интернет и документи."
  : ms < 90000 ? "Сложна задача – обикновено до 1–2 минути." : "Почти до лимита от 2 минути…");

function Waiting({ t0, onStop }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 500); return () => clearInterval(t); }, []);
  const ms = now() - t0;
  return (
    <div className="msg a"><span className="mav"><img src={avatar} alt="" /></span><div className="mbody"><div className="bub lw">
      <span className="wait" data-testid="waiting"><span className="dots"><i /><i /><i /></span> Тед работи… <b className="clock" data-testid="wait-clock">{fmtClock(ms)}</b></span>
      <div className="lw-bar" aria-hidden="true"><i style={{ width: Math.min(100, (ms / WAIT_LIMIT_MS) * 100) + "%" }} /></div>
      <small className="lw-n">{waitHint(ms)} <i>(подсказка според времето)</i></small>
      <button className="b stop-b" onClick={onStop}><Icon n="stopsq" />Спри</button>
    </div></div></div>
  );
}

/* ---------- Application ---------- */
function App({ user, remembered, onLogout }) {
  const [loaded, setLoaded] = useState(false);
  const [chats, setChats] = useState([]);
  const [S, setS] = useState(DEF_SETTINGS);
  const [cases, setCases] = useState({ status: "loading", items: [], error: "" });
  const [models, setModels] = useState([]);
  const [modelsErr, setModelsErr] = useState("");
  const [rg, setRg] = useState({ connected: false });
  const [rgModels, setRgModels] = useState([]);
  const [rgErr, setRgErr] = useState("");
  const [rgConsent, setRgConsent] = useState(null); // "all" | "text" | null (not chosen yet; MAIN keeps the real choice)
  const [consentAsk, setConsentAsk] = useState(null);
  const [conn, setConn] = useState("wait");
  const [view, setView] = useState("chat");
  const [active, setActive] = useState(null);
  const [caseView, setCaseView] = useState(null);
  const [draftCase, setDraftCase] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState(null);
  const [setTab, setSetTab] = useState("general");
  const [pop, openPop, closePop] = usePop();
  const [sub, setSub] = useState(null); // submenu of the „+“ menu / „Разширени“
  const [canvas, setCanvas] = useState(null);
  const [voice, setVoice] = useState(false);
  const [lb, setLb] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [input, setInput] = useState(() => drafts.get(user.id) || "");
  const [files, setFiles] = useState([]);
  const [hints, setHints] = useState([]);
  const [busy, setBusy] = useState(null);
  const [rec, setRec] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [editing, setEditing] = useState(null); // {id, text}: inline edit of the last question
  const [confirm, setConfirm] = useState(null);
  const [search, setSearch] = useState("");
  const [caseTab, setCaseTab] = useState("history");
  const [temp, setTemp] = useState(false);
  const [quick, setQuick] = useState(false);
  const [fold, setFold] = useState({});
  const [atBottom, setAtBottom] = useState(true);
  const [speaking, setSpeaking] = useState(null);
  const [emailBusy, setEmailBusy] = useState(null);
  const [caseBusy, setCaseBusy] = useState(false);
  const [approvals, setApprovals] = useState({});      // requestId -> pending Approval[]
  const [approvalBusy, setApprovalBusy] = useState(null);
  const [videoJobs, setVideoJobs] = useState({});      // jobId -> latest VideoJob
  const [upd, setUpd] = useState(null);                // UpdState, null in a build without the updater
  const [updHidden, setUpdHidden] = useState(false);
  const [updBusy, setUpdBusy] = useState(false);
  const [missed, setMissed] = useState([]);            // scheduled tasks missed while the program was closed
  const [cal, setCal] = useState({ status: "idle" });   // last calendar.list check (Плъгини)
  const [recent, setRecent] = useState({ status: "idle", items: [] });
  const phone = usePhone();
  const [agentState, resetAgent] = useAgentEvents();

  const threadRef = useRef(null);
  const taRef = useRef(null);
  const filesInRef = useRef(null);
  const toastTimer = useRef(null);
  const payloads = useRef(new Map()); // user message id -> {text, items} as typed and attached (this session only, for a manual retry)
  const stream = useRef(null);         // {requestId, cid, mid} of the Real GPT answer being streamed
  const speaker = useRef(null);
  const recorder = useRef(null);
  const live = useRef({});             // latest values for handlers registered once
  const chatsRef = useRef(chats); chatsRef.current = chats;
  const SRef = useRef(S); SRef.current = S;
  const filesRef = useRef(files); filesRef.current = files;
  const inputRef = useRef(input); inputRef.current = input;
  const busyRef = useRef(busy); busyRef.current = busy;
  const agentRef = useRef(agentState); agentRef.current = agentState;
  const canvasRef = useRef(canvas); canvasRef.current = canvas;
  const activeRef = useRef(active); activeRef.current = active;
  const canvasStash = useRef(new Map()); // chatId -> Canvas of that chat while another chat is shown
  const canvasDraft = useRef(null);      // unsaved typing in the open Canvas (kept as a version when it is put aside)
  const reqChat = useRef(new Map());     // Real GPT requestId -> chatId (agent canvas versions go to their own chat)
  const consentRef = useRef(rgConsent); consentRef.current = rgConsent;

  const toast = useCallback((m) => {
    setToastMsg(m); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), Math.min(12000, Math.max(4200, String(m || "").length * 55)));
  }, []);
  const manageUsage = () => { Promise.resolve(ted.app.openExternal(RG_USAGE_URL)).catch(() => {}); closePop(); };
  const patch = useCallback((obj) => { setS((s) => ({ ...s, ...obj })); Promise.resolve(ted.store.setSettings(obj)).catch(() => {}); }, []);
  const set = (k, v) => patch({ [k]: v });
  // E-mail watermark of this profile (see lib/chat.js readMark); stored in settings under the CRM user id.
  const markOf = (st) => readMark(st && st.emailMarks && typeof st.emailMarks === "object" ? st.emailMarks[user.id] : null);
  function bumpMark(fields) {
    const cur = markOf(SRef.current);
    const next = raiseMark(cur, fields);
    if (Object.keys(next).every((k) => next[k] === cur[k])) return;
    const all = SRef.current.emailMarks && typeof SRef.current.emailMarks === "object" ? SRef.current.emailMarks : {};
    const emailMarks = { ...all, [user.id]: next };
    SRef.current = { ...SRef.current, emailMarks }; // visible to the next event before React re-renders
    patch({ emailMarks });
  }
  const focusComposer = () => setTimeout(() => taRef.current && taRef.current.focus(), 30);
  const focusAfterSwitch = useRef(false); // set when the first message of a chat leaves the Home composer
  useEffect(() => {
    if (!focusAfterSwitch.current) return;
    focusAfterSwitch.current = false;
    if (taRef.current) taRef.current.focus(); else focusComposer();
  }, [active]);
  const closeAll = () => { closePop(); setSub(null); };

  // Connection status comes only from real request results.
  const track = useCallback((r) => {
    if (r && (r.ok || r.status)) setConn("ok");
    else if (r && (r.code === "network" || r.code === "timeout")) setConn("off");
    return r;
  }, []);
  const read = useCallback(async (tool, input2) => {
    try { return track(await ted.crm.read(tool, input2)) || { ok: false, error: "Няма отговор от програмата." }; }
    catch { return { ok: false, error: "Вътрешна грешка в програмата." }; }
  }, []);

  /* ---- Loading and saving ---- */
  useEffect(() => {
    let off = false;
    (async () => {
      const [st, saved] = await Promise.all([
        Promise.resolve(ted.store.getSettings()).catch(() => ({})),
        Promise.resolve(ted.store.loadChats()).catch(() => ({ chats: [] })),
      ]);
      if (off) return;
      const nextS = { ...DEF_SETTINGS, ...(st && typeof st === "object" ? st : {}) };
      const list = cleanChats(saved && saved.chats);
      setS(nextS); SRef.current = nextS;
      setChats(list);
      // An interrupted request may have prepared a draft that no card shows: older cards must not send.
      const cut = newestInterrupted(list);
      if (cut) bumpMark({ unsureAt: cut });
      setLoaded(true);
    })();
    return () => { off = true; };
  }, []);

  useEffect(() => {
    if (!loaded) return undefined;
    refreshModels(); refreshCases(); refreshRg();
    if (!remembered) toast(SESSION_NOTE);
    const offs = [];
    offs.push(ted.realgpt.onDelta((d) => {
      const s = stream.current;
      if (!s || !d || d.requestId !== s.requestId) return;
      updMsg(s.cid, s.mid, (m) => ({ ...m, text: typeof d.text === "string" ? d.text : (m.text || "") + (d.delta || "") }));
    }));
    // Agent events the shell acts on itself (steps and files go to the FEATURES reducer of useAgentEvents).
    offs.push(ted.realgpt.onEvent((ev) => live.current.onAgentEvent(ev)));
    offs.push(ted.video.onEvent((job) => { if (job && job.id) setVideoJobs((j) => ({ ...j, [job.id]: job })); }));
    offs.push(ted.scheduled.onDue((d) => live.current.onDue(d)));
    Promise.resolve(ted.updates.state()).then((u) => { if (u && typeof u === "object") setUpd(u); }).catch(() => {});
    offs.push(ted.updates.onChange((u) => { if (u && typeof u === "object") { setUpd(u); if (u.status === "ready") setUpdHidden(false); } }));
    return () => { offs.forEach((un) => { if (typeof un === "function") un(); }); };
  }, [loaded]);

  // Local history: debounced, without temporary chats and without transient flags.
  useEffect(() => {
    if (!loaded) return undefined;
    const t = setTimeout(async () => {
      const keep = chats.filter((c) => !c.temporary).map((c) => ({ ...c, messages: c.messages.map((m) => (m.streaming ? unfinished(m) : m)) }));
      let r;
      try { r = await ted.store.saveChats(keep); } catch { r = { ok: false }; }
      if (r && r.ok === false && !live.current.saveWarned) { live.current.saveWarned = true; toast(r.error || "Чатовете не могат да се запазят на този компютър."); }
    }, 500);
    return () => clearTimeout(t);
  }, [chats, loaded]);

  useEffect(() => () => {
    drafts.set(user.id, inputRef.current);
    if (speaker.current) speaker.current.stop();
    if (recorder.current) recorder.current.cancel();
    clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => { const el = threadRef.current; if (el && atBottom) el.scrollTop = el.scrollHeight; }, [active, chats, busy, agentState, approvals]);
  useEffect(() => { setAtBottom(true); }, [active]);
  useEffect(() => { if (taRef.current) { taRef.current.style.height = "auto"; taRef.current.style.height = Math.min(220, taRef.current.scrollHeight) + "px"; } }, [input, rec]);
  useEffect(() => {
    if (loaded && models.length && S.model && !models.some((m) => m.id === S.model)) { patch({ model: "" }); toast("Избраният модел вече не е наличен – върнато е „По подразбиране“."); }
  }, [models, loaded]);
  // The calendar row of „Плъгини“ shows the result of a real read, made when that list is first on screen.
  useEffect(() => { if (loaded && cal.status === "idle" && (view === "plugins" || (S.mode === "work" && view === "chat" && !active))) checkCal(); }, [loaded, view, S.mode, active]);

  useEffect(() => {
    const k = (e) => {
      const key = (e.key || "").toLowerCase(); const mod = e.ctrlKey || e.metaKey; const f = live.current;
      if (mod && e.shiftKey && e.code === "Space") { e.preventDefault(); setQuick(true); }
      else if (mod && key === "k") { e.preventDefault(); setModal("search"); }
      else if (mod && e.shiftKey && key === "o") { e.preventDefault(); f.newChat(); }
      else if (mod && e.shiftKey && key === "s") { e.preventDefault(); f.toggleMini(); }
      else if (mod && key === "/") { e.preventDefault(); setModal("help"); }
      else if (mod && e.shiftKey && key === "c") { e.preventDefault(); if (f.lastAnswer) f.copy(f.lastAnswer); }
      else if (e.shiftKey && key === "escape") { e.preventDefault(); if (taRef.current) taRef.current.focus(); }
    };
    // A file dropped outside the composer must never navigate the window.
    const stopDrop = (e) => { e.preventDefault(); };
    document.addEventListener("keydown", k); window.addEventListener("dragover", stopDrop); window.addEventListener("drop", stopDrop);
    return () => { document.removeEventListener("keydown", k); window.removeEventListener("dragover", stopDrop); window.removeEventListener("drop", stopDrop); };
  }, []);

  /* ---- Server data ---- */
  async function refreshModels() {
    let r; try { r = track(await ted.api.models()); } catch { r = { ok: false, error: "Вътрешна грешка в програмата." }; }
    if (r && r.ok) { setModels(Array.isArray(r.models) ? r.models : []); setModelsErr(""); }
    else setModelsErr((r && r.error) || "Няма връзка със сървъра.");
    return r;
  }
  async function refreshCases() {
    const r = await read("cases.list", { status: "open" });
    if (r.ok) setCases({ status: "ok", items: Array.isArray(r.result && r.result.cases) ? r.result.cases : [], error: "" });
    else setCases((c) => ({ status: "error", items: c.items, error: r.error || "Казусите не се заредиха." }));
  }
  async function checkConn() {
    const r = await refreshModels();
    toast(r && r.ok ? "Сървърът на Тед отговаря." : "Няма връзка със сървъра: " + ((r && r.error) || "грешка"));
  }
  async function checkCal() {
    setCal({ status: "loading" });
    const from = new Date(); const to = new Date(Date.now() + 14 * 86400000);
    const r = await read("calendar.list", { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
    if (!r.ok) { setCal({ status: "error", error: r.error || "Календарът не се зареди." }); return; }
    const x = r.result || {};
    const list = Array.isArray(x) ? x : Array.isArray(x.events) ? x.events : Array.isArray(x.items) ? x.items : [];
    setCal({ status: "ok", at: now(), text: list.length ? list.length + " събития в следващите 14 дни" : "Няма събития в следващите 14 дни" });
  }
  async function loadRgModels() {
    let r; try { r = await ted.realgpt.models(); } catch { r = { ok: false, error: "Вътрешна грешка в програмата." }; }
    if (r && r.ok) { setRgModels(r.models || []); setRgErr(""); } else { setRgModels([]); setRgErr((r && r.error) || "Моделите на Real GPT не се заредиха."); }
  }
  async function loadConsent() {
    let r; try { r = await ted.realgpt.consent(); } catch { r = null; }
    setRgConsent(r && r.ok ? (r.consent === "all" || r.consent === "text" ? r.consent : null) : null);
  }
  async function setConsent(choice) {
    let r; try { r = await ted.realgpt.setConsent(choice); } catch { r = null; }
    if (r && r.ok) { setRgConsent(r.consent === "all" || r.consent === "text" ? r.consent : choice); consentRef.current = r.consent || choice; return true; }
    toast((r && r.error) || "Изборът не беше записан.");
    return false;
  }
  function applyRg(st) {
    const s = st && st.connected ? st : { connected: false };
    setRg(s);
    if (s.connected && s.planEnabled !== false) loadRgModels(); else setRgModels([]);
    if (s.connected) loadConsent(); else setRgConsent(null);
    if (!s.connected && SRef.current.engine === "realgpt") patch({ engine: "server" });
  }
  async function refreshRg() {
    let st; try { st = await ted.realgpt.status(); } catch { st = null; }
    applyRg(st);
  }
  async function rgSignOut() {
    let r; try { r = await ted.realgpt.signOut(); } catch { r = { ok: false, error: "Вътрешна грешка в програмата." }; }
    if (!r || r.ok === false) {
      // The tokens may still be saved: keep showing the real status and say so.
      toast("Връзката с Real GPT не беше премахната: " + ((r && r.error) || "грешка") + ".");
      refreshRg(); closeAll();
      return false;
    }
    applyRg({ connected: false });
    setModal((m) => (m === "realgpt" ? null : m)); closeAll();
    toast(r.revoked ? "Връзката с Real GPT е прекъсната." : "Връзката е премахната от този компютър. Отдалеченото прекратяване не е потвърдено – прекъснете я и от ChatGPT → Settings.");
    return true;
  }
  function signOutAll() {
    setConfirm({ title: "Изход от CRM и ChatGPT?", text: "Сесията в CRM и връзката с ChatGPT ще бъдат прекратени на този компютър. Запазените тук чатове остават за следващото ви влизане.",
      ok: async () => { if (rg.connected) { const ok = await rgSignOut(); if (!ok) return; } setModal(null); onLogout(); } });
  }
  async function openCase(id) {
    setView("case"); setDrawer(false); closeAll(); setCaseTab("history");
    setCaseView({ id, status: "loading" });
    const r = await read("cases.get", { id });
    setCaseView((cv) => (cv && cv.id === id ? (r.ok ? { id, status: "ok", data: r.result || {} } : { id, status: "error", error: r.error || "Казусът не се зареди." }) : cv));
  }
  async function createCase(title, clientName) {
    if (caseBusy) return;
    setCaseBusy(true);
    let r; try { r = await ted.cases.create({ title, clientName: clientName || undefined }); } catch { r = { ok: false, error: "Вътрешна грешка в програмата." }; }
    setCaseBusy(false);
    if (!r || !r.ok) { toast("Казусът не се създаде: " + ((r && r.error) || "грешка")); return; }
    const made = { id: r.result.id, title: r.result.title || title, client: clientName || "" };
    setCases((c) => ({ ...c, items: c.items.some((x) => x.id === made.id) ? c.items : [made, ...c.items] }));
    setModal(null); toast("📁 Казусът е създаден.");
    refreshCases(); openCase(made.id);
  }

  /* ---- Chats ---- */
  const chat = chats.find((c) => c.id === active) || null;
  const caseId = chat ? chat.caseId : draftCase;
  const curCase = caseId ? (cases.items.find((c) => c.id === caseId) || { id: caseId, title: (chat && chat.caseTitle) || "Казус" }) : null;
  const role = roleOf(S.role) || ROLES[0];
  const mode = modeOf(S.mode);
  const rgModel = rgModels.find((m) => m.slug === S.rgModel);
  const rgLabel = rgModel ? rgModel.displayName : S.rgModel || "";
  const serverModel = models.find((m) => m.id === S.model);
  const rgOn = S.engine === "realgpt";
  const rgTools = rgOn && rg.connected && rgConsent === "all";
  const modelLabel = rgOn ? "Real GPT" + (rgLabel ? " · " + rgLabel : "") : serverModel ? serverModel.name : "Тед";
  const newestEmail = useMemo(() => newestEmailId(chats), [chats]);
  const mark = markOf(S);
  const visible = chats.filter((c) => !c.archived && !c.temporary);
  const pinned = visible.filter((c) => c.pinned).sort((a, b) => b.updatedAt - a.updatedAt);
  const recentChats = visible.filter((c) => !c.pinned).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, CHATS_SHOWN);

  function updChat(id, fn) { setChats((cs) => cs.map((c) => (c.id === id ? fn(c) : c))); }
  function updMsg(cid, mid, fn) { updChat(cid, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === mid ? fn(m) : m)) })); }
  function dropTemp(keepId) { setChats((cs) => (cs.some((c) => c.temporary && c.id !== keepId) ? cs.filter((c) => !c.temporary || c.id === keepId) : cs)); }
  // The Canvas belongs to one chat: switching chats puts it aside and shows the other chat's own (or none), so its
  // text never goes with a question in another chat (security review).
  function switchCanvas(toId) {
    const cv = canvasRef.current;
    const key = toId || "";
    if (cv && (cv.chatId || "") === key) return;
    if (cv) {
      let keep = cv;
      const d = canvasDraft.current;
      if (typeof d === "string") {
        const v = Math.max(...cv.versions.map((x) => x.v)) + 1;
        keep = { ...cv, versions: [...cv.versions, { v, text: d, at: now(), label: "ваша незапазена редакция" }], cur: v };
      }
      canvasStash.current.set(cv.chatId || "", keep);
    }
    canvasDraft.current = null;
    const next = canvasStash.current.get(key) || null;
    canvasStash.current.delete(key);
    canvasRef.current = next;
    setCanvas(next);
  }
  function newChat(forCase) {
    dropTemp(null); setActive(null); setView("chat"); setDraftCase(forCase || null); setDrawer(false); setInput(""); setFiles([]); setHints([]); setTemp(false); setEditing(null); closeAll();
    switchCanvas(null);
    focusComposer();
  }
  function openChat(id) { dropTemp(id); switchCanvas(id); setActive(id); setView("chat"); setDrawer(false); setEditing(null); }
  function openView(v) { setView(v); setDrawer(false); closeAll(); }
  function delChat(id) {
    const b = busyRef.current;
    if (b && b.chatId === id) stop(); // a deleted chat has no thread to wait in: stop waiting, otherwise the Home shows a lone "Спри"
    setChats((cs) => cs.filter((c) => c.id !== id)); if (active === id) setActive(null);
    canvasStash.current.delete(id); // a deleted chat takes its Canvas with it
    if (canvasRef.current && canvasRef.current.chatId === id) { canvasRef.current = null; setCanvas(null); }
  }
  function askDelete(c) { setConfirm({ title: "Изтриване на чата?", text: "„" + c.title + "“ ще бъде изтрит от този компютър. Данните в CRM и паметта на Тед на сървъра не се променят.", ok: () => delChat(c.id) }); }
  function openCanvas(b) { const txt = String(b.text || ""); setCanvas({ uid: uid("cv_"), title: b.title || "Документ", kind: b.kind || "doc", versions: [{ v: 1, text: txt, at: now() }], cur: 1, chatId: activeRef.current || null }); }
  function openSettings(tab) { closeAll(); setDrawer(false); setSetTab(tab || "general"); setModal("settings"); }

  async function copy(text) {
    let r; try { r = await ted.app.copy(String(text || "")); } catch { r = null; }
    toast(r && r.ok ? "📋 Копирано" : "Копирането не успя. Маркирайте текста ръчно.");
  }
  async function exportChat(id) {
    const c = chatsRef.current.find((x) => x.id === id);
    if (!c) return;
    let r; try { r = await ted.app.saveFile({ suggestedName: safeFileName(c.title, "md"), text: chatMarkdown(c) }); } catch { r = { ok: false, error: "Файлът не можа да се запише." }; }
    if (r && r.ok) toast("✅ Запазено: " + r.path); else if (r && !r.canceled) toast(r.error || "Файлът не можа да се запише.");
  }
  async function clearLocal() {
    let r; try { r = await ted.store.clearLocal(); } catch { r = { ok: false }; }
    if (r && r.ok) { setChats([]); setActive(null); toast("Чатовете на този компютър са изтрити."); }
  }
  async function toggleCompact() {
    const on = !SRef.current.compact;
    let r; try { r = await ted.app.setCompact(on); } catch { r = null; }
    if (r && r.ok) set("compact", on); else toast("Размерът на прозореца не можа да се смени.");
    closeAll();
  }

  /* ---- Canvas: the open document goes with the next Real GPT question; the agent adds new versions ---- */
  function canvasCtx(cid) {
    const cv = canvasRef.current;
    if (!cv || (cv.chatId && cv.chatId !== cid)) return null; // only the Canvas of the asking chat goes along
    const cur = cv.versions.find((v) => v.v === cv.cur) || cv.versions[0];
    return cur ? { title: String(cv.title || "Документ").slice(0, 120), text: String(cur.text || "").slice(0, 200000), version: cur.v } : null;
  }
  // chatId = the chat of the request that made the version: shown if that chat's Canvas is on screen, else kept aside.
  function addCanvasVersion(c, chatId) {
    const text = String((c && c.text) || "");
    const label = "Тед: " + String((c && c.label) || "нова версия").slice(0, 60);
    const grow = (cv) => {
      if (!cv) return { uid: uid("cv_"), title: (c && c.title) || "Документ", kind: "doc", versions: [{ v: 1, text, at: now(), label }], cur: 1, chatId: chatId || null };
      const v = Math.max(...cv.versions.map((x) => x.v)) + 1;
      return { ...cv, title: (c && c.title) || cv.title, versions: [...cv.versions, { v, text, at: now(), label }], cur: v };
    };
    const shown = canvasRef.current;
    const here = shown ? (shown.chatId || null) === (chatId || null) : (chatId || null) === (activeRef.current || null);
    if (here || !chatId) { const next = grow(shown); canvasRef.current = next; setCanvas(next); return; }
    canvasStash.current.set(chatId, grow(canvasStash.current.get(chatId) || null));
  }
  async function exportCanvas(format) {
    const cv = canvasRef.current;
    if (!cv) return;
    if ((format === "docx" || format === "pdf") && SRef.current.engine === "realgpt" && rg.connected && consentRef.current === "all") {
      send("Експортирай документа от Canvas („" + cv.title + "“) като ." + format + " файл с create_document. Не променяй текста.");
      return;
    }
    const cur = cv.versions.find((v) => v.v === cv.cur) || cv.versions[0];
    let r; try { r = await ted.app.saveFile({ suggestedName: safeFileName(cv.title, "md"), text: String((cur && cur.text) || "") }); } catch { r = { ok: false, error: "Файлът не можа да се запише." }; }
    if (r && r.ok) toast("✅ Запазено: " + r.path + ((format === "docx" || format === "pdf") ? " (като .md – Word и PDF се правят от Real GPT с разрешени инструменти)" : ""));
    else if (r && !r.canceled) toast(r.error || "Файлът не можа да се запише.");
  }

  /* ---- Attachments ---- */
  async function attach(list) {
    closeAll();
    if (!list || !list.length) return;
    const r = await addFiles(list, filesRef.current, { engine: SRef.current.engine, files: ted.files });
    if (r.items.length) setFiles((fs) => [...fs, ...r.items]);
    if (r.errors.length) toast(r.errors.join(" ")); // every refused file is named, not only the first
    focusComposer();
  }
  function attachRefs(refs, text) {
    const room = Math.max(0, 6 - filesRef.current.filter((f) => f.kind === "ref").length);
    if (refs.length > room) toast("Най-много 6 препратки към CRM на съобщение.");
    setFiles((fs) => [...fs, ...refs.slice(0, room)]);
    setModal(null);
    if (text) setInput((v) => v || text);
    focusComposer();
  }
  async function loadRecent() {
    setRecent({ status: "loading", items: [] });
    let r; try { r = await ted.library.list({ limit: 8 }); } catch { r = null; }
    setRecent(r && r.ok ? { status: "ok", items: (r.items || []).slice(0, 8) } : { status: "error", items: [], error: (r && r.error) || "Библиотеката не се зареди." });
  }
  // A library file: Real GPT gets its store id; Тед (сървър) gets the bytes like a freshly picked file.
  async function pickRecent(f) {
    closeAll();
    if (SRef.current.engine === "realgpt") {
      if (filesRef.current.filter((x) => x.kind !== "ref").length >= LIMITS.rgFiles) { toast(`Най-много ${LIMITS.rgFiles} файла на съобщение.`); return; }
      setFiles((fs) => (fs.some((x) => x.fileId === f.id) ? fs : [...fs, libItem(f)])); focusComposer(); return;
    }
    let r; try { r = await ted.files.read({ id: f.id }); } catch { r = null; }
    if (!r || !r.ok || !r.data) { toast((r && r.error) || "Файлът не можа да се прочете."); return; }
    attach([new File([r.data], r.name || f.name, { type: r.mime || f.mime || "" })]);
  }

  /* ---- Hints of the „+“ menu: Real GPT gets them as tags; Тед (сървър) as a visible text prefix ---- */
  function toggleHint(id) {
    closeAll();
    const h = hintOf(id);
    if (!h) return;
    if (hints.includes(id)) { setHints((x) => x.filter((y) => y !== id)); focusComposer(); return; }
    if (SRef.current.engine !== "realgpt") { setInput((v) => (v.startsWith(h.prefix) ? v : h.prefix + v)); focusComposer(); return; }
    setHints((x) => [...x, id]);
    focusComposer();
  }

  /* ---- Voice ---- */
  function getSpeaker() { if (!speaker.current) speaker.current = createSpeaker(); return speaker.current; }
  function stopSpeak() { if (speaker.current) speaker.current.stop(); setSpeaking(null); }
  // Reads a text aloud; resolves when it ends. id marks which button shows "stop".
  async function speak(text, id) {
    const key = id || "voice";
    setSpeaking(key);
    const r = await getSpeaker().speak(text, { voice: SRef.current.voice, style: SRef.current.style });
    setSpeaking((x) => (x === key ? null : x));
    return r;
  }
  async function toggleSpeak(text, id) {
    if (speaking === id) { stopSpeak(); return; }
    const r = await speak(text, id);
    if (r && !r.ok) toast(r.error);
  }
  async function toggleRec() {
    if (rec === "busy") return;
    if (rec) {
      const r = recorder.current; recorder.current = null;
      if (!r) { setRec(null); return; }
      setRec("busy");
      const out = await r.stop();
      if (!out.ok) { setRec(null); toast(out.error); return; }
      let t; try { t = track(await ted.voice.transcribe({ mime: out.mime, data: out.data })); } catch { t = { ok: false }; }
      setRec(null);
      if (!t || !t.ok) { toast((t && t.error) || "Разпознаването не успя."); return; }
      const said = String(t.text || "").trim();
      if (!said) { toast("Не чух нищо – опитайте отново."); return; }
      if (SRef.current.dictSend) live.current.send(said, { voice: true }); else { setInput((v) => (v ? v + " " + said : said)); focusComposer(); }
      return;
    }
    const r = await startRecorder({ maxMs: 120000, onLimit: () => live.current.toggleRec() });
    if (!r.ok) { toast(r.error); return; }
    recorder.current = r; setRec({ t0: now() });
  }

  /* ---- Sending ---- */
  function appendLocal(cid, userMsg, text) {
    updChat(cid, (c) => ({ ...c, updatedAt: now(), messages: [...c.messages, userMsg, { id: uid("m_"), role: "assistant", local: true, text, time: now() }] }));
  }
  // The request as it goes to one engine (also used again by a manual retry, which may switch the engine).
  function prepare(engine, text, items) {
    const tools = engine === "realgpt" && consentRef.current === "all";
    const problem = engineProblem(engine, items, tools);
    if (problem) return { ok: false, error: problem };
    if (engine === "realgpt") {
      const c = composeText(text, items, 0, !tools);
      return { ok: true, text: c.text, cut: false, images: tools ? [] : items.filter((f) => f.kind === "image").map((f) => ({ mime: f.mime, data: f.data })),
        uploads: tools ? items.filter((f) => f.kind !== "ref" && f.kind !== "text") : [] };
    }
    const c = composeText(text, items, LIMITS.serverText, true);
    // MAIN rejects (never truncates) a server message over 8000 chars; CRM reference lines count too.
    if (c.text.length > LIMITS.serverText) return { ok: false, error: "Съобщението заедно с препратките към CRM е над 8000 знака – съкратете го." };
    return { ok: true, text: c.text, cut: c.cut, files: items.filter((f) => (f.kind === "image" || f.kind === "pdf") && f.data).map((f) => ({ name: f.name, mime: f.mime, data: f.data })) };
  }

  function send(textArg, opts) {
    const o = opts || {};
    const fromInput = textArg == null;
    const typed = (fromInput ? input : String(textArg)).trim();
    const useFiles = fromInput ? files : [];
    const useHints = fromInput ? hints : (o.hints || []);
    if (!typed && !useFiles.length) return;
    const done = (a) => { if (o.onDone) o.onDone(a || ""); };
    if (busyRef.current) { toast("Тед още отговаря – изчакайте или натиснете „Спри“."); done(""); return; }
    const engine = o.engine || S.engine;
    const cur = o.fresh ? null : chat;
    const sendCase = cur ? cur.caseId : (o.fresh ? null : draftCase);
    const prior = cur ? (o.replaceFrom != null ? cur.messages.slice(0, o.replaceFrom) : cur.messages) : [];
    // Hints armed for Real GPT and then sent to the server become the same visible prefix the server path uses.
    const text = engine === "realgpt" ? typed : useHints.map((h) => (hintOf(h) || {}).prefix || "").filter((p) => p && !typed.startsWith(p)).join("") + typed;

    // Engine checks happen before anything is added to the chat.
    if (engine === "realgpt") {
      if (!rg.connected) { toast("Real GPT не е свързан."); setModal("realgpt"); done(""); return; }
      if (rg.planEnabled === false) { toast("Използването на ChatGPT плана не е разрешено – влезте отново с ChatGPT."); done(""); return; }
      if (!S.rgModel) { toast("Изберете модел на Real GPT от менюто „Модел“."); done(""); return; }
      // One question per ChatGPT account (kept by MAIN): tools for CRM, internet and files, or text only.
      if (consentRef.current === null) {
        setConsentAsk({ textArg: fromInput ? null : textArg, opts: o });
        if (o.voice) toast("Изберете дали Real GPT да ползва инструментите на Тед.");
        done(""); return;
      }
    } else {
      const imgs = useFiles.filter((f) => f.kind === "image");
      const pdfs = useFiles.filter((f) => f.kind === "pdf");
      if (serverModel && imgs.length && !serverModel.vision) { toast("Избраният модел не приема снимки – изберете друг модел или махнете снимката."); done(""); return; }
      if (serverModel && pdfs.length && !serverModel.pdf) { toast("Избраният модел не приема PDF – изберете друг модел или махнете файла."); done(""); return; }
      if (text.length > LIMITS.serverText) { toast("Съобщението е твърде дълго (над 8000 знака)."); done(""); return; }
    }
    const prep = prepare(engine, text, useFiles);
    if (!prep.ok) { toast(prep.error); done(""); return; }
    if (prep.cut) toast("Текстът от прикачения файл е съкратен – сървърът приема до 8000 знака на съобщение.");
    const names = useFiles.filter((f) => f.kind !== "ref").map((f) => "[Прикачен файл: " + f.name + "]");
    const refs = useFiles.filter((f) => f.kind === "ref").map((f) => f.line);
    const userMsg = { id: uid("m_"), role: "user", text, files: useFiles.map(chipOf), hist: [text, ...refs, ...names].filter(Boolean).join("\n"), time: now(), ...(o.voice ? { voice: true } : {}), ...(engine === "realgpt" && useHints.length ? { hints: useHints } : {}) };
    payloads.current.set(userMsg.id, { text, items: useFiles });

    let cid = cur ? cur.id : null;
    if (!cid) {
      cid = uid("c_");
      // Cut by code points: a plain slice can split an emoji into a lone surrogate (broken title and file name).
      const title = o.title || Array.from(text || (useFiles[0] && useFiles[0].name) || "Нов чат").slice(0, 48).join("");
      const fresh = { id: cid, title, caseId: sendCase || null, caseTitle: sendCase && curCase ? curCase.title : null, updatedAt: now(), archived: false, pinned: false, temporary: o.fresh ? false : temp, messages: [] };
      setChats((cs) => [fresh, ...cs.filter((c) => !c.temporary)]);
      setActive(cid); setView("chat");
      if (fromInput) focusAfterSwitch.current = true; // the composer under the thread is a new textarea
      // A Canvas opened on the Home (no chat yet) belongs to the chat this first message creates.
      const cvNow = canvasRef.current;
      if (cvNow && !cvNow.chatId) { const own = { ...cvNow, chatId: cid }; canvasRef.current = own; setCanvas(own); }
    }
    if (fromInput) { setInput(""); setFiles([]); setHints([]); }
    setAtBottom(true);
    const addUser = (extra) => updChat(cid, (c) => ({ ...c, updatedAt: now(), messages: [...(o.replaceFrom != null ? c.messages.slice(0, o.replaceFrom) : c.messages), ...extra] }));

    // A typed confirmation must never reach the server as a silent "send the e-mail" (see affirmGuard).
    const guard = affirmGuard({ text, hasFiles: useFiles.length > 0, prior, inCase: !!sendCase, newestId: newestEmail, mark: markOf(SRef.current), realgpt: engine === "realgpt" });
    if (guard) {
      const localUser = { ...userMsg, local: true };
      if (guard.kind === "confirm") { addUser([localUser]); confirmEmail(cid, guard.id); }
      else addUser([localUser, { id: uid("m_"), role: "assistant", local: true, text: guard.text, time: now() }]);
      done(""); return;
    }

    addUser([userMsg]);
    run(cid, prior, userMsg, { engine, caseId: sendCase, onDone: o.onDone, voice: !!o.voice, hints: useHints, temporary: o.fresh ? false : (cur ? !!cur.temporary : temp) });
  }

  // One request. Never retried automatically: a retry is always a click by the user.
  async function run(cid, prior, userMsg, o) {
    const fallbackItems = (userMsg.files || []).filter((f) => f.fileId).map((f) => ({ id: f.id, kind: "lib", fileId: f.fileId, name: f.name, size: f.size || 0 }));
    const payload = payloads.current.get(userMsg.id) || { text: histText(userMsg), items: fallbackItems };
    const requestId = uid("r_");
    const s = SRef.current;
    const finish = (text, mid) => {
      if (o.onDone) o.onDone(text || "");
      else if (text && (s.speak === "always" || (s.speak === "voice" && o.voice))) speak(text, mid).then((r) => { if (r && !r.ok) toast(r.error); });
    };

    if (o.engine === "realgpt") {
      const mid = uid("m_");
      const label = (rgModels.find((m) => m.slug === s.rgModel) || {}).displayName || s.rgModel;
      const hintsNow = o.hints || userMsg.hints || [];
      const agentMode = hintsNow.includes("research") || s.mode === "work" ? "work" : "chat";
      const tools = consentRef.current === "all";
      const t0 = now(); // the answer's time: its e-mail draft (if any) is dated by it, like a server reply by its arrival
      stream.current = { requestId, cid, mid };
      reqChat.current.set(requestId, cid);
      if (reqChat.current.size > 50) reqChat.current.delete(reqChat.current.keys().next().value);
      setBusy({ chatId: cid, requestId, engine: "realgpt", t0 });
      updChat(cid, (c) => ({ ...c, updatedAt: t0, messages: [...c.messages, { id: mid, role: "assistant", engine: "realgpt", text: "", streaming: true, modelName: label, requestId, retry: userMsg.id, time: t0, ...(tools ? { agentOn: true } : {}) }] }));
      const fail = (error, code) => {
        stream.current = null; setBusy(null);
        updMsg(cid, mid, (m) => ({ ...m, streaming: false, retry: userMsg.id, error: { text: error, code } }));
        finish("");
      };
      const prep = prepare("realgpt", payload.text, payload.items);
      if (!prep.ok) { fail(prep.error, "invalid"); return; }
      // Attached files go to MAIN's store once (the model reads them with read_document); the id is reused on a retry.
      const ids = [];
      for (const f of prep.uploads) {
        if (f.fileId) { ids.push(f.fileId); continue; }
        let a; try { a = await ted.files.add({ name: f.name, mime: f.mime, data: f.data, chatId: cid, ...(o.temporary ? { temporary: true } : {}) }); } catch { a = null; }
        if (!a || !a.ok || !a.file) { fail("Файлът „" + f.name + "“ не можа да се подготви: " + ((a && a.error) || "грешка") + ". Нищо не е изпратено.", "invalid"); return; }
        f.fileId = a.file.id; ids.push(a.file.id);
      }
      if (ids.length) updMsg(cid, userMsg.id, (m) => ({ ...m, files: (m.files || []).map((ch) => { const it = payload.items.find((x) => x.id === ch.id); return it && it.fileId ? { ...ch, fileId: it.fileId } : ch; }) }));
      const messages = rgHistory(prior);
      const curMsg = { role: "user", text: prep.text };
      if (prep.images.length) curMsg.images = prep.images;
      if (ids.length) curMsg.files = ids.slice(0, 10);
      messages.push(curMsg);
      // chatId/temporary: files Ted makes are filed with this chat in the Библиотека (never for a temporary chat).
      const args = { requestId, messages, model: s.rgModel, chatId: cid, ...(o.temporary ? { temporary: true } : {}) };
      // „Мислене“ from the „+“ menu raises a lower explicit effort (Мигновено/none … medium) to high for this question.
      const effort = hintsNow.includes("thinking") && (!s.rgEffort || ["none", "minimal", "low", "medium"].includes(s.rgEffort)) ? "high" : s.rgEffort || "";
      if (effort) args.effort = effort;
      // Настройки → Персонализиране. With tools MAIN adds the nick itself (from the settings) to its own rules.
      const own = [!tools && String(s.nick || "").trim() ? "Обръщай се към служителя с „" + String(s.nick).trim().slice(0, 60) + "“." : "", String(s.instructions || "").trim()].filter(Boolean).join("\n");
      if (own) args.instructions = own.slice(0, 1500);
      if (tools) {
        args.mode = agentMode;
        if (hintsNow.length) args.hints = hintsNow.slice(0, 6);
        const cv = canvasCtx(cid);
        if (cv) args.canvas = cv;
        if (o.caseId) args.caseId = o.caseId;
        if (s.role && s.role !== "auto") args.role = s.role;
      }
      let r;
      try { r = await ted.realgpt.send(args); }
      catch { r = { ok: false, error: "Вътрешна грешка в програмата.", code: "internal" }; }
      stream.current = null; setBusy(null);
      const snap = agentSnapshot(agentRef.current, requestId) || {};
      const rFiles = Array.isArray(r && r.files) ? r.files : [];
      const allFiles = [...rFiles, ...(snap.files || []).filter((f) => !rFiles.some((x) => x.id === f.id))];
      const steps = Array.isArray(r && r.steps) ? r.steps : (snap.steps || []);
      const limited = (r && r.limited) || snap.limited;
      const agent = tools || steps.length || allFiles.length ? { mode: agentMode, steps, files: allFiles, ...(limited ? { limited } : {}), ...(snap.video ? { video: snap.video } : {}), ...(snap.email ? { email: snap.email } : {}) } : null;
      resetAgent(requestId);
      setApprovals((a) => { if (!a[requestId]) return a; const n = { ...a }; delete n[requestId]; return n; });
      const extra = { ...(agent ? { agent } : {}), ...(agent && agent.email ? { email: agent.email } : {}) };
      if (r && r.ok) {
        updMsg(cid, mid, (m) => ({ ...m, text: r.text, streaming: false, ...extra, ...(r.incomplete ? { incomplete: true } : {}), ...(r.effortIgnored ? { effortIgnored: true } : {}), ...(r.toolsOff ? { toolsOff: true } : {}) }));
        // The newest draft is this answer's (time t0); a later previewAt would disable its own „Да, изпрати“.
        if (agent && agent.email) bumpMark({ previewAt: t0 });
        if (steps.some((x) => x.mutating && x.status === "ok")) refreshCases();
        finish(r.text, mid);
      } else {
        const stopped = !!r && r.code === "aborted";
        updMsg(cid, mid, (m) => ({ ...m, text: (r && r.text) || m.text || "", streaming: false, retry: userMsg.id, ...extra, ...(stopped ? { stopped: true } : { error: { text: (r && r.error) || "Грешка в Real GPT.", code: (r && r.code) || "error" } }) }));
        if (r && ["reauth", "not_connected", "plan_disabled"].includes(r.code)) refreshRg();
        finish("");
      }
      return;
    }

    // A question asked with „+“ hints and sent to the server again (fallback/retry) gets the same visible prefixes.
    const sText = (userMsg.hints || []).map((h) => (hintOf(h) || {}).prefix || "").filter((x) => x && !payload.text.startsWith(x)).join("") + payload.text;
    const prep = prepare("server", sText, payload.items);
    if (!prep.ok) {
      updChat(cid, (c) => ({ ...c, updatedAt: now(), messages: [...c.messages, { id: uid("m_"), role: "assistant", engine: "server", text: "", time: now(), retry: userMsg.id, error: { text: prep.error, code: "invalid" } }] }));
      finish(""); return;
    }
    setBusy({ chatId: cid, requestId, engine: "server", t0: now() });
    // Saved with the chat until the answer arrives: if the program closes meanwhile, the next start shows
    // "interrupted - actions may have run" instead of a question without an answer (lib/chat.js cleanChats).
    updMsg(cid, userMsg.id, (m) => ({ ...m, pending: true }));
    const unpend = (list) => list.map((m) => {
      if (m.id !== userMsg.id || !m.pending) return m;
      const { pending: _done, ...rest } = m;
      return rest;
    });
    const messages = o.caseId ? [] : serverHistory(prior);
    messages.push(prep.files.length ? { role: "user", text: prep.text, files: prep.files } : { role: "user", text: prep.text });
    let r;
    try { r = await ted.api.chat({ requestId, messages, ...(s.model ? { model: s.model } : {}), ...(s.role !== "auto" ? { mode: s.role } : {}), ...(o.caseId ? { caseId: o.caseId } : {}) }); }
    catch { r = { ok: false, error: "Вътрешна грешка в програмата. Не е ясно дали заявката е изпълнена.", code: "internal", maybeExecuted: true }; }
    setBusy(null); track(r);
    const mid = uid("m_");
    const at = now();
    bumpMark(markFromReply(r, at));
    if (r && r.ok) {
      const am = {
        id: mid, role: "assistant", engine: "server", text: r.text || "", time: at, actions: Array.isArray(r.actions) ? r.actions : [],
        ...(r.email ? { email: r.email } : {}), ...(r.mode ? { mode: r.mode } : {}), ...(r.modelName ? { modelName: r.modelName } : {}), ...(r.fallback ? { fallback: r.fallback } : {}),
        ...(r.uiPanel ? { panel: r.uiPanel } : {}), ...(r.video ? { video: true } : {}), ...(r.listings && r.listings.length ? { listings: r.listings } : {}),
        ...(o.fromRg ? { rgFallback: true } : {}),
      };
      // Ted on the server sent the latest draft itself (email.send in this reply): its card is no longer sendable.
      const sentBy = am.actions.some((a) => a.ok && a.tool === "email.send") ? newestEmailId(chatsRef.current) : null;
      updChat(cid, (c) => ({ ...c, updatedAt: now(), messages: [...unpend(c.messages), am] }));
      if (sentBy) setChats((cs) => cs.map((c) => (c.messages.some((x) => x.id === sentBy) ? { ...c, messages: c.messages.map((x) => (x.id === sentBy && x.time < at ? { ...x, emailState: "sent" } : x)) } : c)));
      if (am.actions.some((a) => a.ok && a.mutating)) refreshCases();
      finish(am.text, mid);
    } else {
      const code = (r && r.code) || "error";
      const am = { id: mid, role: "assistant", engine: "server", text: "", time: at, retry: userMsg.id, ...(o.fromRg ? { rgFallback: true } : {}),
        ...(code === "aborted" ? { stopped: true } : { error: { text: (r && r.error) || "Грешка при връзката със сървъра.", code, maybeExecuted: !!(r && r.maybeExecuted) } }) };
      updChat(cid, (c) => ({ ...c, updatedAt: now(), messages: [...unpend(c.messages), am] }));
      finish("");
    }
  }

  function stop() {
    const b = busyRef.current;
    if (!b) return;
    Promise.resolve(b.engine === "realgpt" ? ted.realgpt.cancel(b.requestId) : ted.api.cancel(b.requestId)).catch(() => {});
  }

  // The question an answer belongs to, its index and whether its attachments can be sent again.
  function questionOf(m) {
    if (!chat) return null;
    const idx = chat.messages.findIndex((x) => x.id === m.id);
    let u = m.retry ? chat.messages.findIndex((x) => x.id === m.retry) : idx - 1;
    if (!m.retry) while (u >= 0 && chat.messages[u].role !== "user") u--;
    if (idx < 0 || u < 0) return null;
    const userMsg = chat.messages[u];
    const kept = payloads.current.get(userMsg.id);
    if (!kept && (userMsg.files || []).some((f) => f.kind !== "ref" && !f.fileId)) { toast("Прикачените файлове не се пазят след рестарт – прикачете ги отново и изпратете пак."); return null; }
    return { idx, u, userMsg };
  }

  // Manual "try again" for a failed or stopped answer; engine can be switched to Ted's server.
  function retry(m, engine) {
    if (busyRef.current || !chat) return;
    const q = questionOf(m);
    if (!q) return;
    const eng = engine || m.engine || S.engine;
    const go = () => {
      updChat(chat.id, (c) => ({ ...c, messages: c.messages.filter((x) => x.id !== m.id) }));
      run(chat.id, chat.messages.slice(0, q.u), q.userMsg, { engine: eng, caseId: chat.caseId, temporary: !!chat.temporary, fromRg: eng === "server" && m.engine === "realgpt" });
    };
    const unknown = m.stopped ? m.engine !== "realgpt" || !!m.agentOn || answerChanged(m) : !!(m.error && (m.error.maybeExecuted || m.error.code === "quota")) || answerChanged(m);
    if (unknown) setConfirm({ title: "Да опитам ли отново?", text: "Сигурни ли сте? Проверете в CRM дали действието не е изпълнено. Ако вече е изпълнено, повторното изпращане може да го извърши втори път.", ok: go });
    else go();
  }
  // „Само текст“ after the plan route refused the tools: Real GPT answers without tools from now on (changeable in Настройки).
  async function textOnly(m) {
    if (await setConsent("text")) { toast("Real GPT вече отговаря само с текст. Инструментите се връщат от Настройки → Безопасност."); retry(m, "realgpt"); }
  }
  // „Отговори пак“ (ChatGPT regenerate) for the newest answer; asks first when that answer changed CRM data.
  function regenerate(m) {
    if (busyRef.current || !chat) return;
    const q = questionOf(m);
    if (!q) return;
    const eng = m.engine === "realgpt" || m.engine === "server" ? m.engine : S.engine;
    const go = () => {
      updChat(chat.id, (c) => ({ ...c, messages: c.messages.slice(0, q.idx) }));
      run(chat.id, chat.messages.slice(0, q.u), q.userMsg, { engine: eng, caseId: chat.caseId, temporary: !!chat.temporary });
    };
    if (answerChanged(m)) setConfirm({ title: "Да отговоря ли пак?", text: "Този отговор е променил данни в CRM. Нов отговор може да повтори действието – проверете в CRM, преди да продължите.", ok: go });
    else go();
  }
  // Inline „Редактирай“ of the newest question: the question and everything after it are replaced.
  function resendEdited(m, text) {
    if (!chat) return;
    const t = String(text || "").trim();
    if (!t) { toast("Напишете въпроса."); return; }
    if (busyRef.current) { toast("Тед още отговаря – изчакайте или натиснете „Спри“."); return; }
    const idx = chat.messages.findIndex((x) => x.id === m.id);
    if (idx < 0) return;
    const go = () => { setEditing(null); send(t, { replaceFrom: idx, engine: S.engine }); };
    if (chat.messages.slice(idx + 1).some(answerChanged)) setConfirm({ title: "Да изпратя ли редакцията?", text: "Отговорът под този въпрос е променил данни в CRM. Новият отговор може да повтори действието – проверете в CRM, преди да продължите.", ok: go });
    else go();
  }

  // How this program sends an e-mail: the card button or a short typed confirmation -> native confirmation in
  // MAIN -> the server tool. (Ted on the server can still send mail when explicitly asked in other words; the
  // server's own rules apply then - a hard gate would need a server change.)
  async function confirmEmail(cid, mid) {
    if (live.current.emailBusy) return;
    const c = chatsRef.current.find((x) => x.id === cid);
    const m = c && c.messages.find((x) => x.id === mid);
    if (!m || !m.email) return;
    const block = emailBlock(m, newestEmailId(chatsRef.current), Date.now(), markOf(SRef.current));
    if (block) { toast("Нищо не е изпратено. " + block); return; }
    live.current.emailBusy = true; setEmailBusy(mid);
    let r;
    try { r = await ted.email.confirmSend({ to: m.email.to, subject: m.email.subject || "", attachments: Array.isArray(m.email.attachments) ? m.email.attachments : [] }); }
    catch { r = { ok: false, error: "Не е ясно дали имейлът е изпратен (вътрешна грешка в програмата). Проверете, преди да опитате отново.", maybeExecuted: true }; }
    live.current.emailBusy = false; setEmailBusy(null);
    if (r && r.canceled) { toast("Отказано – нищо не е изпратено."); return; }
    const out = emailResult(r);
    if (out.state === "sent") bumpMark({ sentAt: now() });
    else if (out.state === "unknown") bumpMark({ unsureAt: now() });
    const step = out.state === "unknown" ? [] : [{ raw: "email.send" + (out.state === "sent" ? "" : " ✗"), kind: "tool", tool: "email.send", label: "Изпращане на имейл", ok: out.state === "sent", mutating: true }];
    updChat(cid, (ch) => ({
      ...ch, updatedAt: now(),
      messages: [...ch.messages.map((x) => (x.id === mid ? { ...x, emailState: out.state } : x)),
        { id: uid("m_"), role: "assistant", engine: "server", text: out.text, time: now(), actions: step, fromEmail: true, ...(out.panel ? { panel: out.panel } : {}) }],
    }));
  }

  /* ---- Agent events and approvals (Real GPT) ---- */
  function onAgentEvent(ev) {
    if (!ev || typeof ev !== "object") return;
    if (ev.type === "approval" && ev.approval && ev.requestId) setApprovals((a) => ({ ...a, [ev.requestId]: [...(a[ev.requestId] || []).filter((x) => x.id !== ev.approval.id), ev.approval] }));
    else if (ev.type === "canvas" && ev.canvas) addCanvasVersion(ev.canvas, reqChat.current.get(ev.requestId));
    else if (ev.type === "video" && ev.job && ev.job.id) setVideoJobs((j) => ({ ...j, [ev.job.id]: ev.job }));
  }
  async function decide(requestId, ap, decision, options) {
    setApprovalBusy(ap.id);
    let r; try { r = await ted.realgpt.approve({ requestId, approvalId: ap.id, decision, ...(options ? { options } : {}) }); } catch { r = { ok: false, error: "Вътрешна грешка в програмата." }; }
    setApprovalBusy(null);
    if (r && r.ok) setApprovals((a) => ({ ...a, [requestId]: (a[requestId] || []).filter((x) => x.id !== ap.id) }));
    else toast((r && r.error) || "Решението не беше прието.");
  }

  /* ---- Scheduled tasks: reminders, prompts, missed runs (never run silently) ---- */
  function runTask(t) {
    if (t.kind === "prompt") {
      if (busyRef.current) { toast("Планирано „" + t.title + "“ не е изпълнено: Тед още отговаря на друг въпрос."); return; }
      send(String(t.text || t.title), { fresh: true, engine: t.engine === "realgpt" ? "realgpt" : "server", title: "Планирано: " + String(t.title).slice(0, 36) });
    } else toast("⏰ " + t.title + (t.text ? " – " + t.text : ""));
  }
  function onDue(d) {
    if (!d || !d.task) return;
    if (d.missed) { setMissed((x) => [...x.filter((y) => y.id !== d.task.id), d.task]); toast("Пропусната планирана задача: „" + d.task.title + "“ – вижте Планирани."); return; }
    runTask(d.task);
  }

  /* ---- Updates ---- */
  const updAct = {
    check: async () => { let r; try { r = await ted.updates.check(); } catch { r = null; } if (r && typeof r === "object") setUpd(r); },
    setAuto: async (on) => { let r; try { r = await ted.updates.setAuto(!!on); } catch { r = null; } if (r && typeof r === "object") setUpd(r); else toast("Настройката не можа да се промени."); },
    download: async () => { let r; try { r = await ted.updates.download(); } catch { r = null; } if (!r || !r.ok) toast((r && r.error) || "Изтеглянето не можа да започне."); },
    install: async () => { setUpdBusy(true); let r; try { r = await ted.updates.install(); } catch { r = null; } setUpdBusy(false); if (!r || !r.ok) toast((r && r.error) || "Обновяването не можа да започне."); },
  };

  live.current.send = send; live.current.toggleRec = toggleRec; live.current.newChat = newChat; live.current.copy = copy;
  live.current.onAgentEvent = onAgentEvent; live.current.onDue = onDue;
  live.current.toggleMini = () => set("mini", !SRef.current.mini);
  live.current.lastAnswer = chat ? ((chat.messages.filter((m) => m.role === "assistant" && m.text).slice(-1)[0]) || {}).text || null : null;

  /* ---- Parts of the interface ---- */
  const me = <><Avatar text={initials(user.name, user.email)} /><span className="me-txt"><b>{user.name || "Профил"}</b><small>{user.email || user.phoneMasked || "Имоти Надежда"}</small></span></>;
  const pl = { user, conn, checkConn, rg, consent: rgConsent, openRealGpt: () => setModal("realgpt"), rgSignOut, S, patch, cal, checkCal, openBrowser: () => openSettings("browser") };
  const modelBag = { S, patch, set, models, modelsErr, refreshModels, rg, rgModels, rgErr, loadRgModels, openRealGpt: () => setModal("realgpt"), rgSignOut, manageUsage };

  const chatRow = (c) => (
    <div key={c.id} className={"row" + (c.id === active && view === "chat" ? " on" : "")}>
      {renaming === c.id ? (
        <input id={"rn-" + c.id} autoFocus defaultValue={c.title} maxLength={120} onBlur={(e) => { const v = e.target.value.trim(); updChat(c.id, (x) => ({ ...x, title: v || x.title })); setRenaming(null); }} onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setRenaming(null); }} />
      ) : <button className="t" onClick={() => openChat(c.id)} title={c.title}>{c.pinned ? "📌 " : ""}{c.title}</button>}
      <button className="more" aria-label="Опции на чата" aria-expanded={!!(pop && pop.id === "chat-" + c.id)} onClick={(e) => openPop("chat-" + c.id, e, c)}><Icon n="dots" /></button>
    </div>
  );
  const sideProps = {
    S, setMini: (v) => set("mini", v), drawer, setDrawer, view, active, me, meOpen: pop && pop.id === "me", onMe: (e) => openPop("me", e),
    onNew: () => newChat(), onSearch: () => { setModal("search"); setDrawer(false); }, openView, onPersonal: () => openSettings("personal"),
    cases, caseView, openCase, newCase: () => { closeAll(); setDrawer(false); setModal("newCase"); }, onCaseMenu: (e, cs) => openPop("case-" + cs.id, e, cs), refreshCases,
    pinned, recent: recentChats, total: visible.length, chatRow, fold, setFold,
  };

  // Чат | Работа: on a page (Проекти, Библиотека…) the toggle opens that mode's start screen, as in ChatGPT.
  const setModeHome = (m) => { set("mode", m); if (view !== "chat") newChat(); };
  const Top = (
    <TopBar phone={phone} mini={S.mini} chat={chat} view={view} temp={temp} setTemp={setTemp} modelLabel={modelLabel} modelOpen={pop && pop.id === "model"} onModel={(e) => openPop("model", e)}
      mode={S.mode} setMode={setModeHome} rgOn={rgOn} manageUsage={manageUsage} onMenu={() => setDrawer(true)} onExpand={() => set("mini", false)}
      onNewChat={() => newChat()} onChatMenu={(e) => chat && openPop("chat-" + chat.id, e, chat)} />
  );

  const fillExample = (ex) => { closeAll(); setInput(ex); focusComposer(); };
  const disc = rgOn
    ? rgTools
      ? phone ? "С CRM, интернет и вашите файлове. Може да греши." : "Real GPT работи през вашия ChatGPT план с CRM, интернет и прикачените файлове; за промени пита. Може да греши – проверявайте важното."
      : phone ? "Без достъп до CRM. Може да греши." : "Real GPT отговаря през вашия ChatGPT план, без достъп до CRM, казусите и паметта на Тед. Може да греши – проверявайте важното."
    : phone ? "Тед може да греши. Проверявайте важното." : "Тед работи с реалните данни в CRM според правата на вашия акаунт. Може да греши – проверявайте важното.";
  const discEl = <div className="disc">{rgOn ? <span className="rg-ind-d" data-testid="rg-ind-narrow">Използва вашия ChatGPT план · <button className="lnk" onClick={manageUsage}>Управление на лимита</button> · </span> : null}{disc}</div>;
  const chips = {
    image: () => toggleHint("image"), search: () => toggleHint("search"),
    write: (e) => openPop("write", e), more: (e) => openPop("more-ex", e),
    findProp: () => setModal("attachProp"), docs: () => setModal("docs"), attachProp: () => setModal("attachProp"),
  };
  const homeChips = <HomeChips c={chips} phone={phone} />;
  const homePlugins = S.mode === "work" ? <HomePlugins rows={pluginRows(pl)} /> : null;
  const composerEl = (home) => (
    <Composer phone={phone} S={S} mode={mode} input={input} setInput={setInput} files={files} setFiles={setFiles} taRef={taRef} rec={rec} busy={busy}
      onSend={() => send()} onStop={stop} onMic={toggleRec} onVoice={() => setVoice(true)} onPlus={(e) => { setSub(null); openPop("plus", e); }} plusOpen={pop && pop.id === "plus"} onDropFiles={attach}
      hints={hints} dropHint={(h) => setHints((x) => x.filter((y) => y !== h))} curCase={curCase} dropCase={!chat ? () => setDraftCase(null) : null}
      role={S.role !== "auto" ? role : null} dropRole={() => set("role", "auto")}
      pill={{ label: rgOn ? rgLabel || "Real GPT" : serverModel ? serverModel.name : "Тед Асистент", effort: rgOn ? effortName(S.rgEffort) : "сървър", open: pop && pop.id === "adv", onClick: (e) => { setSub(null); openPop("adv", e); } }}
      canvasTag={canvas && rgTools && (!canvas.chatId || canvas.chatId === active) ? { title: String(canvas.title || "Документ").slice(0, 40), drop: () => setCanvas(null) } : null}
      disc={home && !phone ? null : discEl} home={home} above={home ? null : !chat && phone ? <>{homePlugins}{homeChips}</> : null} />
  );

  // Never retried automatically. Real GPT codes get their own next step (usage page / new sign-in / server fallback).
  const errorBox = (m) => {
    const e = m.error;
    const rgLimit = m.engine === "realgpt" && e.code === "usage_limit";
    const rgSignIn = m.engine === "realgpt" && RG_SIGNIN_CODES.includes(e.code);
    const toolsNo = m.engine === "realgpt" && e.code === "tools_unsupported";
    const canRetry = !!m.retry && e.code !== "invalid" && e.code !== "auth" && !rgLimit && !rgSignIn && !toolsNo;
    const quota = e.code === "quota" || rgLimit;
    return (
      <div className={"err" + (quota ? " quota" : "")} role="alert" data-testid={quota ? "quota-banner" : "error-banner"}>
        <span>{quota ? "⏳ " : "⚠️ "}{e.text}</span>
        {e.code === "quota" ? <span className="err-w" data-testid="maybe-note">{QUOTA_NOTE}</span>
          : e.maybeExecuted ? <span className="err-w" data-testid="maybe-note">{MAYBE_NOTE}</span> : null}
        {rgLimit ? <button className="b wine" onClick={manageUsage}><Icon n="external" />Управление на лимита</button> : null}
        {rgSignIn ? <button className="b wine" onClick={() => setModal("realgpt")}><Icon n="external" />Продължи с ChatGPT</button> : null}
        {canRetry ? <button className="b" onClick={() => retry(m)} disabled={!!busy}><Icon n="refresh" />Опитай отново</button> : null}
        {e.code === "quota" ? <button className="b" onClick={(ev) => openPop("model", ev)}>Избери друг модел</button> : null}
        {!toolsNo && m.engine === "realgpt" && m.retry ? <button className="b" onClick={() => retry(m, "server")} disabled={!!busy}>Отговори с Тед (сървъра)</button> : null}
      </div>
    );
  };

  // The Real GPT agent part of an answer: „Изпълнение“ steps, approvals, files, video, e-mail (docs/CONTRACT.md §16).
  const agentCards = (m) => {
    const liveSnap = m.streaming && m.requestId ? (agentSnapshot(agentState, m.requestId) || {}) : null;
    const a = liveSnap || m.agent || null;
    const pending = m.streaming && m.requestId ? (approvals[m.requestId] || []) : [];
    const steps = (a && a.steps) || [];
    const fl = (a && a.files) || [];
    const vid = a && a.video ? (videoJobs[a.video.jobId] || null) : null;
    if (!steps.length && !fl.length && !pending.length && !vid && !(m.agent && m.agent.limited)) return null;
    return <>
      {steps.length ? <AgentSteps steps={steps} live={!!m.streaming} /> : null}
      {pending.map((ap) => <ApprovalCard key={ap.id} approval={ap} busy={approvalBusy === ap.id} onDecide={(d, opt) => decide(m.requestId, ap, d, opt)} />)}
      {fl.map((f) => <FileCard key={f.id} file={f} onToast={toast} />)}
      {vid ? <VideoCard job={vid} onToast={toast} /> : null}
    </>;
  };

  const lastA = chat ? [...chat.messages].reverse().find((x) => x.role === "assistant") : null;
  const lastU = chat ? [...chat.messages].reverse().find((x) => x.role === "user") : null;
  const Thread = chat ? (
    <div className="thread" ref={threadRef} onScroll={(e) => { const el = e.currentTarget; const b2 = el.scrollHeight - el.scrollTop - el.clientHeight < 90; if (b2 !== atBottom) setAtBottom(b2); }}>
      <div className="col">
        {chat.messages.map((m) => (m.role === "user" ? (
          <div className="msg u" key={m.id}>
            <div className="mbody">
              {m.files && m.files.length ? <div className="ufiles">{m.files.map((f) => (f.thumb ? <img key={f.id} src={f.thumb} alt={f.name} onClick={() => setLb({ src: f.thumb, cap: f.name })} /> : <div key={f.id} className="card file ufile"><span className={"ficon " + (f.kind === "ref" ? "ref" : extOf(f.name))}>{f.kind === "ref" ? "CRM" : (extOf(f.name) || "file").slice(0, 4).toUpperCase()}</span><div className="fx"><b>{f.name}</b><span className="meta">{f.kind === "ref" ? "препратка към CRM" : fmtSize(f.size)}</span></div></div>))}</div> : null}
              {m.hints && m.hints.length ? <div className="ctags uhints">{m.hints.map((h) => <span className="ctag" key={h}>{(hintOf(h) || { name: h }).name}</span>)}</div> : null}
              {editing && editing.id === m.id ? (
                <div className="edit-box" data-testid="edit-box">
                  <textarea id="edit-q" autoFocus value={editing.text} maxLength={20000} onChange={(e) => setEditing({ id: m.id, text: e.target.value })} onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }} />
                  {m.files && m.files.some((f) => f.kind !== "ref") ? <small className="meta">Прикачените файлове не се изпращат отново – прикачете ги, ако трябват.</small> : null}
                  <div className="r"><button className="b" onClick={() => setEditing(null)}>Отказ</button><button className="b wine" onClick={() => resendEdited(m, editing.text)} disabled={!!busy}>Изпрати</button></div>
                </div>
              ) : m.text ? <div className="bub">{m.voice ? "🎤 " : ""}{m.text}</div> : null}
              {!(editing && editing.id === m.id) ? <div className="uacts">
                <button className="ibtn" onClick={() => copy(m.text)} aria-label="Копирай"><Icon n="copy" /></button>
                <button className="ibtn" onClick={() => { setInput(m.text); focusComposer(); }} aria-label="Постави в полето за писане" title="Постави в полето за писане"><Icon n="upload" /></button>
                {lastU && lastU.id === m.id && !m.local ? <button className="ibtn" onClick={() => setEditing({ id: m.id, text: m.text || "" })} disabled={!!busy} aria-label="Редактирай" title="Редактирай и изпрати пак"><Icon n="pencil" /></button> : null}
              </div> : null}
            </div>
          </div>
        ) : (
          <div className="msg a" key={m.id} data-engine={m.engine || "local"}>
            <span className="mav"><img src={avatar} alt="" /></span>
            <div className="mbody">
              <div className="bub lv">
                {m.text ? <Md text={m.text} onCanvas={openCanvas} copy={copy} /> : m.streaming ? <span className="wait">💭 Мисля… <span className="dots"><i /><i /><i /></span></span> : null}
                {m.streaming && m.text ? <span className="caret" /> : null}
                {(() => {
                  const acts = m.actions || [];
                  const showActs = acts.length && (S.showActs || acts.some((a) => !a.ok || a.mutating));
                  const ag = m.engine === "realgpt" ? agentCards(m) : null;
                  if (!showActs && !m.email && !m.panel && !m.video && !m.listings && !ag) return null;
                  return (
                    <div className="cards">
                      {ag}
                      {showActs ? <ActionsCard actions={acts} /> : null}
                      {m.email ? <EmailCard m={m} block={emailBlock(m, newestEmail, Date.now(), mark)} busy={emailBusy === m.id} onSend={() => confirmEmail(chat.id, m.id)} onEdit={() => { setInput("Промени имейла: "); focusComposer(); }} /> : null}
                      {m.listings ? <ListingCards items={m.listings} onAttach={(p) => attachRefs([propFile(p)])} /> : null}
                      {m.panel || m.video ? <PanelCard panel={m.panel} video={m.video} /> : null}
                    </div>
                  );
                })()}
                {m.error && m.error.code === "tools_unsupported" && m.retry ? <ToolsUnsupportedCard onServer={() => retry(m, "server")} onTextOnly={() => textOnly(m)} /> : null}
                {m.error ? errorBox(m) : null}
                {m.stopped ? <div className="note stop-note" data-testid="stop-note">⏹ {m.engine === "realgpt" ? (m.agentOn ? "Спряно от вас. Стъпките, завършени преди спирането, остават изпълнени – вижте „Изпълнение“ и проверете в CRM." : "Спряно от вас.") : STOP_NOTE}{m.retry ? <> <button className="lnk" onClick={() => retry(m)} disabled={!!busy}>Опитай отново</button></> : null}</div> : null}
                {m.incomplete ? <div className="note">✂️ Отговорът е прекъснат по дължина – натиснете „Продължи“.</div> : null}
                {m.agent && m.agent.limited ? <div className="note" data-testid="limit-note">Търсенето спря на лимита: {m.agent.limited.rounds} кръга / {m.agent.limited.calls} извиквания. Натиснете „Продължи“ или напишете „продължи“, за да продължа.</div> : null}
                {m.local || m.mode || m.modelName || m.fallback || m.effortIgnored || m.fromEmail || m.rgFallback || m.toolsOff ? (
                  <div className="foot-tags">
                    {m.local ? <span className="demo">ℹ️ Съобщение от програмата – не е изпратено към Тед</span> : null}
                    {m.rgFallback ? <span className="demo fb" data-testid="rg-fallback">↪ Отговор от Тед (сървъра) вместо Real GPT</span> : null}
                    {m.fromEmail ? <span className="demo live">Резултат от сървъра · email.send</span> : null}
                    {m.mode && roleOf(m.mode) ? <span className="demo">{roleOf(m.mode).em} {roleOf(m.mode).short}</span> : null}
                    {m.engine === "server" && m.modelName ? <span className="demo live" data-testid="model-chip">Сървър · {m.modelName}</span> : null}
                    {m.engine === "realgpt" ? <span className="demo sel" data-testid="model-chip">Real GPT · {m.modelName}</span> : null}
                    {m.toolsOff ? <span className="demo">без инструменти</span> : null}
                    {m.fallback ? <span className="demo fb">↪ {m.fallback}</span> : null}
                    {m.effortIgnored ? <span className="demo fb">Нивото на мислене не се поддържа от този модел и не е приложено</span> : null}
                  </div>
                ) : null}
              </div>
              {m.text && !m.streaming ? (
                <div className="macts">
                  <button className="ibtn" onClick={() => copy(m.text)} aria-label="Копирай" title="Копирай"><Icon n="copy" /></button>
                  <button className={"ibtn" + (speaking === m.id ? " on" : "")} onClick={() => toggleSpeak(m.text, m.id)} aria-label={speaking === m.id ? "Спри четенето" : "Чуй"} title={speaking === m.id ? "Спри четенето" : "Чуй"}><Icon n={speaking === m.id ? "stopsq" : "speaker"} /></button>
                  <button className="ibtn" onClick={() => openCanvas({ title: "Отговор на Тед", kind: "doc", text: m.text })} aria-label="Отвори в Canvas" title="Отвори в Canvas"><Icon n="pencil" /></button>
                  {lastA && lastA.id === m.id && !m.local && !m.fromEmail ? <button className="ibtn" onClick={() => regenerate(m)} disabled={!!busy} aria-label="Отговори пак" title="Отговори пак"><Icon n="refresh" /></button> : null}
                  {lastA && lastA.id === m.id && (m.incomplete || (m.agent && m.agent.limited)) ? <button className="b macts-b" onClick={() => send("Продължи", {})} disabled={!!busy}><Icon n="chevR" />Продължи</button> : null}
                  {m.modelName ? <span className="mdl" title="Модел, отговорил на това съобщение">{m.modelName.length > 34 ? m.modelName.slice(0, 32) + "…" : m.modelName}</span> : null}
                </div>
              ) : null}
            </div>
          </div>
        )))}
        {busy && busy.chatId === chat.id && busy.engine === "server" ? <Waiting t0={busy.t0} onStop={stop} /> : null}
      </div>
    </div>
  ) : null;
  const ToBottom = chat && !atBottom ? <button className="tobottom" onClick={() => { const el = threadRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); setAtBottom(true); }} aria-label="Към последното съобщение"><Icon n="chev" /></button> : null;

  const hello = String(S.nick || "").trim() || firstName(user.name);
  const tempSub = rgOn
    ? "Този чат не се пази на този компютър. Разговорът минава през вашия ChatGPT акаунт."
    : "Този чат не се пази на този компютър. Сървърът на Тед все пак записва разговора в паметта си, както в сайта.";
  const sessNote = remembered ? null : <div className="sess-note" role="note" data-testid="session-note">🔐 {SESSION_NOTE}</div>;
  const homeTitle = temp ? "⏳ Временен чат" : S.mode === "work" ? mode.hello : hello ? "Здравейте, " + hello + ". " + mode.hello : "Здравейте! " + mode.hello;
  const caseBanner = draftCase && curCase ? <span className="case-banner"><Icon n="folder" cls="sm16" />{phone ? "Казус „" + curCase.title + "“" : "Нов чат в казус „" + curCase.title + "“"}</span> : null;
  const HomeView = <Home phone={phone} title={homeTitle} sub={temp ? tempSub : ""} caseBanner={caseBanner} sessNote={sessNote} composer={composerEl(true)} chips={homeChips} plugins={homePlugins} disc={phone ? null : discEl} />;

  /* ---- Pages ---- */
  const cv = caseView;
  const kase = cv && cv.status === "ok" ? (cv.data.kase || {}) : (cv ? cases.items.find((c) => c.id === cv.id) || {} : {});
  const caseChats = cv ? chats.filter((c) => c.caseId === cv.id && !c.archived && !c.temporary) : [];
  const CasePage = cv ? (
    <div className="page"><div className="page-in" data-testid="case-page">
      <div className="case-h"><span className="fi"><Icon n="folder" /></span><div className="case-tx"><div className="page-h"><h1>{kase.title || "Казус"}</h1></div><span className="case-sub">{[kase.client, kase.status === "closed" ? "затворен" : kase.status === "open" ? "отворен" : "", kase.updated_at ? "обновен " + fmtDate(kase.updated_at) : ""].filter(Boolean).join(" · ") || "Казус с памет на сървъра на Тед"}</span></div>
        <button className="ibtn case-ref" onClick={() => openCase(cv.id)} aria-label="Обнови" title="Обнови"><Icon n="refresh" /></button></div>
      <button className="b wine self-start" onClick={() => newChat(cv.id)}><Icon n="newchat" />Нов чат в този казус</button>
      <div className="seg self-start">{[["history", "История"], ["facts", "Факти"], ["chats", "Чатове тук"]].map(([k, l]) => <button key={k} className={caseTab === k ? "on" : ""} onClick={() => setCaseTab(k)}>{l}</button>)}</div>
      <div className="sheet">
        {cv.status === "loading" ? <div className="empty"><i className="spin" /> Зареждам казуса от сървъра…</div> : null}
        {cv.status === "error" ? <div className="err" role="alert">⚠️ {cv.error} <button className="b" onClick={() => openCase(cv.id)}><Icon n="refresh" />Опитай отново</button></div> : null}
        {cv.status === "ok" && caseTab === "history" ? <>
          {kase.summary ? <div className="info case-sum"><b>Резюме:</b> {kase.summary}</div> : null}
          {(cv.data.messages || []).map((x, i) => <div className={"case-msg " + (x.role === "assistant" ? "a" : "u")} key={i}><small>{x.role === "assistant" ? "Тед" : "Служител"}{x.at ? " · " + fmtDate(x.at) : ""}</small><div>{x.text}</div></div>)}
          {!(cv.data.messages || []).length ? <div className="empty">Още няма разговори по този казус.</div> : null}
          <div className="note">Последните съобщения по казуса, както ги пази сървърът на Тед (дълбоките се съкращават).</div>
        </> : null}
        {cv.status === "ok" && caseTab === "facts" ? <>
          {(cv.data.facts || []).map((f, i) => <div className="mem" key={i}><Icon n="bookmark" /><div className="tx">{String(f)}</div></div>)}
          {!(cv.data.facts || []).length ? <div className="empty">Няма запомнени факти по казуса. Кажете на Тед „запомни …“ в чат по казуса.</div> : null}
        </> : null}
        {cv.status === "ok" && caseTab === "chats" ? (
          <div className="clist">{caseChats.map((c) => <button key={c.id} onClick={() => openChat(c.id)}><Icon n="chat" /><b>{c.title}</b><small>{dayGroup(c.updatedAt)}</small></button>)}
            {!caseChats.length ? <div className="empty">На този компютър няма чатове по казуса.</div> : null}</div>
        ) : null}
      </div>
    </div></div>
  ) : null;

  /* ---- Popovers ---- */
  function pickCase(id) {
    closeAll();
    if (chat) { if ((chat.caseId || null) !== (id || null)) { newChat(id); toast(id ? "Нов чат в избрания казус." : "Нов чат без казус."); } } else setDraftCase(id || null);
  }
  function popContent() {
    if (!pop) return null;
    const id = pop.id;
    if (id === "model") return (
      <Pop pop={pop} onClose={closeAll} width={390}>
        <div className="hd">Модел<small>кой отговаря</small></div>
        {phone ? <div className="pop-mode"><ModeToggle mode={S.mode} setMode={(x) => { closeAll(); setModeHome(x); }} cls="in-pop" /></div> : null}
        <ModelItems m={modelBag} close={closeAll} />
      </Pop>
    );
    if (id === "adv") return <AdvancedPop key={sub || "root"} pop={pop} onClose={closeAll} sub={sub} setSub={setSub} m={modelBag} rgOn={rgOn} modelLabel={modelLabel} />;
    if (id === "plus") return (
      <PlusMenu pop={pop} onClose={closeAll} phone={phone} sub={sub} setSub={(x) => { if (x === "recent") loadRecent(); setSub(x); }} hints={hints} onHint={toggleHint} rgOn={rgOn}
        recent={recent} onRecent={pickRecent} cases={cases} curCase={curCase} onCase={pickCase}
        a={{
          files: () => { closeAll(); filesInRef.current.click(); },
          canvas: () => { closeAll(); openCanvas({ title: "Нов документ", kind: "doc", text: "" }); },
          video: () => { closeAll(); setModal("video"); },
          docs: () => { closeAll(); setModal("docs"); },
          prop: () => { closeAll(); setModal("attachProp"); },
          newCase: () => { closeAll(); setModal("newCase"); },
          agents: () => openView("agents"),
          plugins: () => openView("plugins"),
        }} />
    );
    if (id === "write") return (
      <Pop pop={pop} onClose={closeAll} width={340}>
        <div className="hd">Пиши или редактирай</div>
        {WRITE_EX.map((w) => <It key={w.name} em={w.em} title={w.name} sub={w.ex.trim()} onClick={() => fillExample(w.ex)} />)}
        <div className="sep" />
        <It icon="pencil" title="Отвори Canvas" sub="празен документ встрани от чата" onClick={() => { closeAll(); openCanvas({ title: "Нов документ", kind: "doc", text: "" }); }} />
      </Pop>
    );
    if (id === "more-ex") return (
      <Pop pop={pop} onClose={closeAll} width={360}>
        <div className="hd">Още предложения<small>попълват полето, нищо не се изпраща</small></div>
        {GROUPS.map((g) => <It key={g.id} em={g.em} title={g.name} sub={g.ex} onClick={() => fillExample(g.ex)} />)}
      </Pop>
    );
    if (id === "me") return (
      <Pop pop={pop} onClose={closeAll} width={280}>
        <div className="hd">{user.name || "Профил"}<small className="hd-sub">{user.email || user.phoneMasked || ""}</small></div>
        <div className="sep" />
        <It icon="gear" title="Настройки" onClick={() => openSettings("general")} />
        <It icon="help" title="Помощ" sub="клавишни комбинации" onClick={() => { closeAll(); setDrawer(false); setModal("help"); }} />
        <It icon="monitor" title={S.compact ? "Пълен прозорец" : "Компактен прозорец"} sub="тесен прозорец с подредба като на телефон" onClick={toggleCompact} />
        <div className="sep" />
        <It icon="logout" title="Изход" onClick={() => { closeAll(); onLogout(); }} />
      </Pop>
    );
    if (id.startsWith("chat-")) {
      const c = pop.data;
      return (
        <Pop pop={pop} onClose={closeAll} align="right" width={250}>
          <It icon="pencil" title="Преименувай" onClick={() => { closeAll(); setRenaming(c.id); if (S.mini) set("mini", false); if (window.innerWidth < 900) setDrawer(true); }} />
          <It icon="pin" title={c.pinned ? "Откачи" : "Закачи"} onClick={() => { updChat(c.id, (x) => ({ ...x, pinned: !x.pinned })); closeAll(); }} />
          <It icon="download" title="Експорт (Markdown)" sub="запис като файл" onClick={() => { closeAll(); exportChat(c.id); }} />
          <It icon="archive" title="Архивирай" onClick={() => { updChat(c.id, (x) => ({ ...x, archived: true })); if (active === c.id) setActive(null); closeAll(); toast("Архивирано. Виж Настройки → Контрол на данните."); }} />
          <div className="sep" />
          <It icon="trash" title="Изтрий" danger onClick={() => { closeAll(); askDelete(c); }} />
        </Pop>
      );
    }
    if (id.startsWith("case-")) {
      const cs = pop.data;
      return (
        <Pop pop={pop} onClose={closeAll} align="right" width={240}>
          <It icon="newchat" title="Нов чат в казуса" onClick={() => newChat(cs.id)} />
          <It icon="folder" title="Отвори казуса" sub="история и факти от сървъра" onClick={() => openCase(cs.id)} />
        </Pop>
      );
    }
    return null;
  }

  /* ---- Modals ---- */
  function modalContent() {
    if (!modal) return null;
    const close = () => setModal(null);
    if (modal === "search") {
      const q = search.trim().toLowerCase();
      // Empty query = „Вижте всички…“: every chat (not archived), newest first. With a query archived ones are found too.
      const res = chats.filter((c) => !c.temporary && (q ? c.title.toLowerCase().includes(q) || c.messages.some((m) => (m.text || "").toLowerCase().includes(q)) : !c.archived))
        .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, q ? 100 : 2000);
      const hl = (s) => { if (!q) return s; const i = s.toLowerCase().indexOf(q); return i < 0 ? s : <>{s.slice(0, i)}<mark>{s.slice(i, i + q.length)}</mark>{s.slice(i + q.length)}</>; };
      return (
        <Modal title="Търсене в чатовете" onClose={() => { close(); setSearch(""); }} size="md">
          <div className="search-in"><Icon n="search" /><input id="srch" autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Търси по заглавие или текст…" /></div>
          <div className="mb mb0"><div className="sres">
            <It icon="newchat" title="Нов чат" onClick={() => { close(); newChat(); }} />
            {res.map((c) => { const hit = q ? c.messages.find((m) => (m.text || "").toLowerCase().includes(q)) : null; return <It key={c.id} icon={c.caseId ? "folder" : "chat"} title={hl(c.title)} sub={hit ? hl((hit.text || "").slice(0, 90)) : (c.archived ? "в архива · " : "") + dayGroup(c.updatedAt)} onClick={() => { close(); setSearch(""); if (c.archived) updChat(c.id, (x) => ({ ...x, archived: false })); openChat(c.id); }} />; })}
            {!res.length ? <div className="empty">Няма намерени чатове на този компютър.</div> : null}
          </div></div>
        </Modal>
      );
    }
    if (modal === "settings") return (
      <SettingsView phone={phone} S={S} set={set} patch={patch} tab={setTab} setTab={setSetTab} close={close} user={user} chats={chats} setChats={setChats} active={active} toast={toast}
        testVoice={() => toggleSpeak("Здравейте! Аз съм Тед, вашият асистент в Имоти Надежда.", "test")} speaking={speaking === "test"}
        models={models} modelsErr={modelsErr} refreshModels={refreshModels} rg={rg} rgModels={rgModels} rgErr={rgErr} openRealGpt={() => setModal("realgpt")} rgSignOut={rgSignOut}
        read={read} conn={conn} onConn={track} exportChat={exportChat} deleteChat={askDelete} clearLocal={clearLocal} setConfirm={setConfirm} logout={onLogout}
        remembered={remembered} manageUsage={manageUsage} consent={rgConsent} setConsent={setConsent} pl={pl} upd={upd} updAct={updAct} signOutAll={signOutAll} />
    );
    if (modal === "newCase") return (
      <Modal title="Нов проект" onClose={close} size="sm" foot={<><button className="b" onClick={close}>Отказ</button><button className="b wine" disabled={caseBusy} onClick={() => {
        const t = document.getElementById("nc-t").value.trim(); const cl = document.getElementById("nc-c").value.trim();
        if (!t) { toast("Въведете име на проекта."); return; }
        createCase(t.slice(0, 160), cl.slice(0, 120));
      }}>{caseBusy ? <i className="spin" /> : null}Създай проект</button></>}>
        <div className="mb">
          <div className="fld"><label htmlFor="nc-t">Име на проекта</label><input id="nc-t" className="inp" autoFocus maxLength={160} placeholder="Напр. Продажба · къща с двор" /></div>
          <div className="fld"><label htmlFor="nc-c">Клиент (по желание)</label><input id="nc-c" className="inp" maxLength={120} placeholder="Име на клиент от CRM" /></div>
          <div className="info">Проектът (в сайта – „казус“) се създава на сървъра на Тед и се вижда и в сайта. Всичко, казано в него, се помни там.</div>
        </div>
      </Modal>
    );
    if (modal === "attachProp") return <AttachProp close={close} read={read} onAttach={(ps) => { attachRefs(ps.map(propFile)); toast("🏠 Към съобщението е добавена препратка към имота."); }} />;
    if (modal === "docs") return <DocsModal close={close} read={read} onAttach={(f) => { attachRefs([f]); toast("📄 Към съобщението е добавена препратка към документа."); }} />;
    if (modal === "video") return <VideoWizard close={close} read={read} jobs={videoJobs} onJob={(j) => setVideoJobs((x) => ({ ...x, [j.id]: j }))} toast={toast} />;
    if (modal === "help") return (
      <Modal title="Помощ" onClose={close} size="sm">
        <div className="mb">
          <div className="sec-h">Клавишни комбинации</div>
          <dl className="kv">{SHORTCUTS.map(([a, b]) => <React.Fragment key={a}><dt>{a}</dt><dd>{b}</dd></React.Fragment>)}</dl>
          <div className="sec-h mt">Как работи</div>
          <p className="help-p">Тед отговаря през сървъра на imotinadezhda.bg със същите права и памет като в сайта. Чатовете се пазят шифровано на този компютър. Бутонът „✅ Да, изпрати“ и кратките потвърждения („да“, „ок“…) след чернова винаги минават през потвърждение в отделен прозорец на Windows. Тед на сървъра може да изпрати имейл и когато изрично го помолите с други думи – тогава важат правилата на сървъра.</p>
          <div className="clist">
            <button onClick={() => openSettings("about")}>💻 <b>Относно</b><small>версия, връзка, лицензи</small></button>
            <button onClick={() => openSettings("helpc")}>📘 <b>Помощен център</b><small>ръководство и комбинации</small></button>
            <button onClick={openCrm}>🌐 <b>CRM на сайта</b><small>отваря се в браузъра</small></button>
          </div>
        </div>
      </Modal>
    );
    if (modal === "realgpt") return <RealGptConnect close={close} rg={rg} onStatus={applyRg} onSignOut={rgSignOut} onManage={manageUsage} />;
    if (typeof modal === "string" && modal.startsWith("skill-")) return <SkillPanel id={modal.slice(6)} close={close} />;
    return null;
  }

  async function consentDecide(choice) {
    const ask = consentAsk;
    setConsentAsk(null);
    if (choice !== "all" && choice !== "text") return; // closed without a choice: nothing is sent
    if (!(await setConsent(choice))) return;
    if (ask) live.current.send(ask.textArg, ask.opts);
  }

  if (!loaded) return <Shell phone={phone} conn="wait"><div className="login"><span className="wait boot"><i className="spin" /> Зареждане…</span></div></Shell>;

  const bodyMain = view === "agents" ? <AgentsPage S={S} setRole={(r) => { set("role", r.id); toast("Роля: " + r.name); }} openSkill={(sid) => setModal("skill-" + sid)} />
    : view === "projects" ? <ProjectsPage cases={cases} chats={chats} openCase={openCase} newCase={() => setModal("newCase")} newChatIn={(id) => newChat(id)} refreshCases={refreshCases} />
      : view === "scheduled" ? <ScheduledPage read={read} toast={toast} missed={missed} onRunNow={(t) => { setMissed((x) => x.filter((y) => y.id !== t.id)); runTask(t); }} onDismissMissed={(tid) => setMissed((x) => x.filter((y) => y.id !== tid))} rgReady={rg.connected && rg.planEnabled !== false} />
        : view === "library" ? <LibraryPage chats={chats} openChat={openChat} toast={toast} />
          : view === "plugins" ? <PluginsPage pl={pl} />
            : view === "case" ? CasePage : (chat ? Thread : HomeView);
  const notify = { ...NOTIFY_DEF, ...(S.notify && typeof S.notify === "object" ? S.notify : {}) };
  return (
    <Shell phone={phone} conn={conn} onQuick={() => setQuick(true)}>
      <div className={"app cg-app" + (S.big ? " big" : "")}>
        {phone ? <PhoneDrawer {...sideProps} /> : <Sidebar {...sideProps} />}
        {drawer ? <div className="scrim" onClick={() => setDrawer(false)} /> : null}
        <main className="main" id="main-area">
          {Top}
          {notify.updates && !updHidden ? <UpdateBanner upd={upd} busy={updBusy} onInstall={updAct.install} onHide={() => setUpdHidden(true)} /> : null}
          <div className="body">
            <div className="center">
              {bodyMain}
              {view === "chat" ? ToBottom : null}
              {view === "chat" && (chat || phone) ? composerEl(false) : null}
            </div>
            {canvas ? <Canvas key={canvas.uid || "cv"} draft={canvasDraft} cv={canvas} setCv={setCanvas} toast={toast} copy={copy} onExport={exportCanvas} /> : null}
          </div>
        </main>
        <input ref={filesInRef} className="file-in" data-testid="files-in" type="file" multiple onChange={(e) => { attach(Array.from(e.target.files)); e.target.value = ""; }} />
        {popContent()}
        {modalContent()}
        {consentAsk ? <ConsentModal account={rg.email || ""} onDecide={consentDecide} /> : null}
        {confirm ? (
          <Modal title={confirm.title} onClose={() => setConfirm(null)} size="sm" foot={<><button className="b" onClick={() => setConfirm(null)}>Отказ</button><button className="b wine" onClick={() => { const ok = confirm.ok; setConfirm(null); ok(); }}>Потвърди</button></>}>
            <div className="mb"><p className="p0">{confirm.text}</p></div>
          </Modal>
        ) : null}
        {voice ? <VoiceMode close={() => setVoice(false)} toast={toast} speak={(t) => speak(t, "voice")} stopSpeak={stopSpeak} ask={(q, done) => send(q, { onDone: done, voice: true })} /> : null}
        {quick ? (
          <div className="quick-back" onMouseDown={(e) => { if (e.target === e.currentTarget) setQuick(false); }}>
            <div className="quick" role="dialog" aria-label="Бърз прозорец"><img src={avatar} alt="" />
              <input id="quick-in" autoFocus placeholder="Попитай Тед…  Enter изпраща · Esc затваря" maxLength={8000} onKeyDown={(e) => { if (e.key === "Escape") setQuick(false); if (e.key === "Enter" && e.target.value.trim()) { const v = e.target.value; setQuick(false); send(v, { fresh: true }); } }} />
              <kbd>Ctrl + Shift + Space</kbd></div>
          </div>
        ) : null}
        {lb ? (
          <div className="lb" onClick={() => setLb(null)} role="dialog" aria-label="Преглед">
            <img src={lb.src} alt={lb.cap} onClick={(e) => e.stopPropagation()} />
            <div className="r"><span>{lb.cap}</span><button className="b" onClick={() => setLb(null)}><Icon n="x" />Затвори</button></div>
          </div>
        ) : null}
        {toastMsg ? <div className="toast" role="status">{toastMsg}</div> : null}
      </div>
    </Shell>
  );
}
