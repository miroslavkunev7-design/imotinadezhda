import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ted } from "./bridge.js";
import Icon from "./components/Icon.jsx";
import { Avatar, It, Modal, Pop, usePhone, usePop } from "./components/ui.jsx";
import Md from "./components/Md.jsx";
import { ActionsCard, EmailCard, ListingCards, PanelCard, SkillPanel, openCrm, propRef } from "./components/Cards.jsx";
import Login from "./components/Login.jsx";
import Settings from "./components/Settings.jsx";
import Canvas from "./components/Canvas.jsx";
import VoiceMode from "./components/VoiceMode.jsx";
import RealGptConnect from "./components/RealGptConnect.jsx";
import { AttachProp, DocsModal, propFile } from "./components/Attach.jsx";
import { DEF_SETTINGS, EFFORTS, GROUPS, RG_LIMITS, RG_SIGNIN_CODES, RG_USAGE_URL, ROLES, SESSION_NOTE, SKILLS, provEm, roleOf } from "./lib/consts.js";
import { dayGroup, extOf, firstName, fmtClock, fmtDate, fmtSize, initials, now, uid } from "./lib/format.js";
import { LIMITS, addFiles, chipOf, composeText } from "./lib/files.js";
import { affirmGuard, chatMarkdown, cleanChats, emailBlock, emailResult, histText, markFromReply, newestEmailId, newestInterrupted, raiseMark, readMark, rgHistory, safeFileName, serverHistory } from "./lib/chat.js";
import { createSpeaker, startRecorder } from "./lib/voice.js";
import avatar from "./assets/avatar.webp";
import logo from "./assets/logo.png";

const STOP_NOTE = "Спряно изчакването. Ако Тед вече е започнал действие на сървъра, то може да бъде довършено – проверете в CRM.";
const MAYBE_NOTE = "Възможно е действието вече да е изпълнено на сървъра. Проверете в CRM, преди да опитате отново.";
const QUOTA_NOTE = "Ако Тед е започнал действие, преди да спре заради лимита, то може вече да е изпълнено – проверете в CRM, преди да опитате отново.";const CONN_TEXT = { ok: "Свързан с imotinadezhda.bg", off: "Няма връзка", wait: "Проверка на връзката…", out: "Излезли сте" };
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

function RecBar({ rec }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 500); return () => clearInterval(t); }, []);
  return rec === "busy"
    ? <div className="recbar live"><i />Разпознавам записа…</div>
    : <div className="recbar"><i />● Записвам {fmtClock(now() - rec.t0)} · натиснете ⏹ за край</div>;
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
  const [conn, setConn] = useState("wait");
  const [view, setView] = useState("chat");
  const [active, setActive] = useState(null);
  const [caseView, setCaseView] = useState(null);
  const [draftCase, setDraftCase] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState(null);
  const [setTab, setSetTab] = useState("general");
  const [pop, openPop, closePop] = usePop();
  const [canvas, setCanvas] = useState(null);
  const [voice, setVoice] = useState(false);
  const [lb, setLb] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [input, setInput] = useState(() => drafts.get(user.id) || "");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(null);
  const [rec, setRec] = useState(null);
  const [renaming, setRenaming] = useState(null);
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
  const phone = usePhone();

  const threadRef = useRef(null);
  const taRef = useRef(null);
  const galleryRef = useRef(null);
  const filesInRef = useRef(null);
  const toastTimer = useRef(null);
  const payloads = useRef(new Map()); // user message id -> {text, files} as sent (this session only, for a manual retry)
  const stream = useRef(null);         // {requestId, cid, mid} of the Real GPT answer being streamed
  const speaker = useRef(null);
  const recorder = useRef(null);
  const live = useRef({});             // latest values for handlers registered once
  const chatsRef = useRef(chats); chatsRef.current = chats;
  const SRef = useRef(S); SRef.current = S;
  const filesRef = useRef(files); filesRef.current = files;
  const inputRef = useRef(input); inputRef.current = input;
  const busyRef = useRef(busy); busyRef.current = busy;

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
    const un = ted.realgpt.onDelta((d) => {
      const s = stream.current;
      if (!s || !d || d.requestId !== s.requestId) return;
      updMsg(s.cid, s.mid, (m) => ({ ...m, text: typeof d.text === "string" ? d.text : (m.text || "") + (d.delta || "") }));
    });
    return () => { if (typeof un === "function") un(); };
  }, [loaded]);

  // Local history: debounced, without temporary chats and without transient flags.
  useEffect(() => {
    if (!loaded) return undefined;
    const t = setTimeout(async () => {
      const keep = chats.filter((c) => !c.temporary).map((c) => ({ ...c, messages: c.messages.map((m) => (m.streaming ? { ...m, streaming: false, stopped: true } : m)) }));
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

  useEffect(() => { const el = threadRef.current; if (el && atBottom) el.scrollTop = el.scrollHeight; }, [active, chats, busy]);
  useEffect(() => { setAtBottom(true); }, [active]);
  useEffect(() => { if (taRef.current) { taRef.current.style.height = "auto"; taRef.current.style.height = Math.min(220, taRef.current.scrollHeight) + "px"; } }, [input, rec]);
  useEffect(() => {
    if (loaded && models.length && S.model && !models.some((m) => m.id === S.model)) { patch({ model: "" }); toast("Избраният модел вече не е наличен – върнато е „По подразбиране“."); }
  }, [models, loaded]);

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
  async function loadRgModels() {
    let r; try { r = await ted.realgpt.models(); } catch { r = { ok: false, error: "Вътрешна грешка в програмата." }; }
    if (r && r.ok) { setRgModels(r.models || []); setRgErr(""); } else { setRgModels([]); setRgErr((r && r.error) || "Моделите на Real GPT не се заредиха."); }
  }
  function applyRg(st) {
    const s = st && st.connected ? st : { connected: false };
    setRg(s);
    if (s.connected && s.planEnabled !== false) loadRgModels(); else setRgModels([]);
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
      refreshRg(); closePop();
      return;
    }
    applyRg({ connected: false });
    setModal((m) => (m === "realgpt" ? null : m)); closePop();
    toast(r.revoked ? "Връзката с Real GPT е прекъсната." : "Връзката е премахната от този компютър. Отдалеченото прекратяване не е потвърдено – прекъснете я и от ChatGPT → Settings.");
  }
  async function openCase(id) {
    setView("case"); setDrawer(false); closePop(); setCaseTab("history");
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
  const rgModel = rgModels.find((m) => m.slug === S.rgModel);
  const rgLabel = rgModel ? rgModel.displayName : S.rgModel || "";
  const serverModel = models.find((m) => m.id === S.model);
  const modelShort = S.engine === "realgpt" ? "Real GPT" + (rgLabel ? " · " + rgLabel : "") : serverModel ? serverModel.name : "Тед Асистент";
  const newestEmail = useMemo(() => newestEmailId(chats), [chats]);
  const mark = markOf(S);
  const visible = chats.filter((c) => !c.archived && !c.temporary);
  const pinned = visible.filter((c) => c.pinned);
  const groups = {};
  visible.filter((c) => !c.pinned).sort((a, b) => b.updatedAt - a.updatedAt).forEach((c) => { const g = dayGroup(c.updatedAt); (groups[g] = groups[g] || []).push(c); });

  function updChat(id, fn) { setChats((cs) => cs.map((c) => (c.id === id ? fn(c) : c))); }
  function updMsg(cid, mid, fn) { updChat(cid, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === mid ? fn(m) : m)) })); }
  function dropTemp(keepId) { setChats((cs) => (cs.some((c) => c.temporary && c.id !== keepId) ? cs.filter((c) => !c.temporary || c.id === keepId) : cs)); }
  function newChat(forCase) {
    dropTemp(null); setActive(null); setView("chat"); setDraftCase(forCase || null); setDrawer(false); setInput(""); setFiles([]); setTemp(false); closePop();
    focusComposer();
  }
  function openChat(id) { dropTemp(id); setActive(id); setView("chat"); setDrawer(false); }
  function openView(v) { setView(v); setDrawer(false); closePop(); }
  function delChat(id) {
    const b = busyRef.current;
    if (b && b.chatId === id) stop(); // a deleted chat has no thread to wait in: stop waiting, otherwise the Home shows a lone "Спри"
    setChats((cs) => cs.filter((c) => c.id !== id)); if (active === id) setActive(null);
  }
  function askDelete(c) { setConfirm({ title: "Изтриване на чата?", text: "„" + c.title + "“ ще бъде изтрит от този компютър. Данните в CRM и паметта на Тед на сървъра не се променят.", ok: () => delChat(c.id) }); }
  function openCanvas(b) { const txt = String(b.text || ""); setCanvas({ title: b.title || "Документ", kind: b.kind || "doc", versions: [{ v: 1, text: txt, at: now() }], cur: 1 }); }
  function openSettings(tab) { closePop(); setDrawer(false); setSetTab(tab || "general"); setModal("settings"); }

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
    closePop();
  }

  /* ---- Attachments ---- */
  async function attach(list) {
    closePop();
    if (!list || !list.length) return;
    const r = await addFiles(list, filesRef.current);
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

  function send(textArg, opts) {
    const o = opts || {};
    const fromInput = textArg == null;
    const text = (fromInput ? input : String(textArg)).trim();
    const useFiles = fromInput ? files : [];
    if (!text && !useFiles.length) return;
    const done = (a) => { if (o.onDone) o.onDone(a || ""); };
    if (busyRef.current) { toast("Тед още отговаря – изчакайте или натиснете „Спри“."); done(""); return; }
    const engine = o.engine || S.engine;
    const cur = o.fresh ? null : chat;
    const sendCase = cur ? cur.caseId : (o.fresh ? null : draftCase);
    const prior = cur ? cur.messages : [];
    const images = useFiles.filter((f) => f.kind === "image");
    const pdfs = useFiles.filter((f) => f.kind === "pdf");

    // Engine checks happen before anything is added to the chat.
    if (engine === "realgpt") {
      if (!rg.connected) { toast("Real GPT не е свързан."); setModal("realgpt"); done(""); return; }
      if (rg.planEnabled === false) { toast("Използването на ChatGPT плана не е разрешено – влезте отново с ChatGPT."); done(""); return; }
      if (!S.rgModel) { toast("Изберете модел на Real GPT от менюто „Модел“."); done(""); return; }
      if (pdfs.length) { toast("Real GPT приема само снимки и текст. За PDF изберете модел на Тед (сървър)."); done(""); return; }
    } else {
      if (serverModel && images.length && !serverModel.vision) { toast("Избраният модел не приема снимки – изберете друг модел или махнете снимката."); done(""); return; }
      if (serverModel && pdfs.length && !serverModel.pdf) { toast("Избраният модел не приема PDF – изберете друг модел или махнете файла."); done(""); return; }
      if (text.length > LIMITS.serverText) { toast("Съобщението е твърде дълго (над 8000 знака)."); done(""); return; }
    }

    const composed = composeText(text, useFiles, engine === "realgpt" ? 0 : LIMITS.serverText);
    // MAIN rejects (never truncates) a server message over 8000 chars; CRM reference lines count too.
    if (engine !== "realgpt" && composed.text.length > LIMITS.serverText) { toast("Съобщението заедно с препратките към CRM е над 8000 знака – съкратете го."); done(""); return; }
    if (composed.cut) toast("Текстът от прикачения файл е съкратен – сървърът приема до 8000 знака на съобщение.");
    const names = useFiles.filter((f) => f.kind !== "ref").map((f) => "[Прикачен файл: " + f.name + "]");
    const refs = useFiles.filter((f) => f.kind === "ref").map((f) => f.line);
    const userMsg = { id: uid("m_"), role: "user", text, files: useFiles.map(chipOf), hist: [text, ...refs, ...names].filter(Boolean).join("\n"), time: now(), ...(o.voice ? { voice: true } : {}) };
    payloads.current.set(userMsg.id, { text: composed.text, files: useFiles.filter((f) => f.data).map((f) => ({ name: f.name, mime: f.mime, data: f.data })) });

    let cid = cur ? cur.id : null;
    if (!cid) {
      cid = uid("c_");
      // Cut by code points: a plain slice can split an emoji into a lone surrogate (broken title and file name).
      const title = Array.from(text || (useFiles[0] && useFiles[0].name) || "Нов чат").slice(0, 48).join("");
      const fresh = { id: cid, title, caseId: sendCase || null, caseTitle: sendCase && curCase ? curCase.title : null, updatedAt: now(), archived: false, pinned: false, temporary: o.fresh ? false : temp, messages: [] };
      setChats((cs) => [fresh, ...cs.filter((c) => !c.temporary)]);
      setActive(cid); setView("chat");
    }
    if (fromInput) { setInput(""); setFiles([]); }
    setAtBottom(true);

    // A typed confirmation must never reach the server as a silent "send the e-mail" (see affirmGuard).
    const guard = affirmGuard({ text, hasFiles: useFiles.length > 0, prior, inCase: !!sendCase, newestId: newestEmail, mark: markOf(SRef.current), realgpt: engine === "realgpt" });
    if (guard) {
      const localUser = { ...userMsg, local: true };
      if (guard.kind === "confirm") {
        updChat(cid, (c) => ({ ...c, updatedAt: now(), messages: [...c.messages, localUser] }));
        confirmEmail(cid, guard.id);
      } else appendLocal(cid, localUser, guard.text);
      done(""); return;
    }

    updChat(cid, (c) => ({ ...c, updatedAt: now(), messages: [...c.messages, userMsg] }));
    run(cid, prior, userMsg, { engine, caseId: sendCase, onDone: o.onDone, voice: !!o.voice });
  }

  // One request. Never retried automatically: a retry is always a click by the user.
  async function run(cid, prior, userMsg, o) {
    const payload = payloads.current.get(userMsg.id) || { text: histText(userMsg), files: [] };
    const requestId = uid("r_");
    const s = SRef.current;
    const finish = (text, mid) => {
      if (o.onDone) o.onDone(text || "");
      else if (text && (s.speak === "always" || (s.speak === "voice" && o.voice))) speak(text, mid).then((r) => { if (r && !r.ok) toast(r.error); });
    };

    if (o.engine === "realgpt") {
      const mid = uid("m_");
      const label = (rgModels.find((m) => m.slug === s.rgModel) || {}).displayName || s.rgModel;
      stream.current = { requestId, cid, mid };
      setBusy({ chatId: cid, requestId, engine: "realgpt", t0: now() });
      updChat(cid, (c) => ({ ...c, updatedAt: now(), messages: [...c.messages, { id: mid, role: "assistant", engine: "realgpt", text: "", streaming: true, modelName: label, time: now() }] }));
      // No `instructions`: the module's default tells the model it has no CRM access in this mode.
      const messages = rgHistory(prior);
      const imgs = payload.files.filter((f) => /^image\//.test(f.mime)).map((f) => ({ mime: f.mime, data: f.data }));
      messages.push(imgs.length ? { role: "user", text: payload.text, images: imgs } : { role: "user", text: payload.text });
      let r;
      try { r = await ted.realgpt.send({ requestId, messages, model: s.rgModel, ...(s.rgEffort ? { effort: s.rgEffort } : {}) }); }
      catch { r = { ok: false, error: "Вътрешна грешка в програмата.", code: "internal" }; }
      stream.current = null; setBusy(null);
      if (r && r.ok) {
        updMsg(cid, mid, (m) => ({ ...m, text: r.text, streaming: false, ...(r.incomplete ? { incomplete: true } : {}), ...(r.effortIgnored ? { effortIgnored: true } : {}) }));
        finish(r.text, mid);
      } else {
        const stopped = !!r && r.code === "aborted";
        updMsg(cid, mid, (m) => ({ ...m, text: (r && r.text) || m.text || "", streaming: false, retry: userMsg.id, ...(stopped ? { stopped: true } : { error: { text: (r && r.error) || "Грешка в Real GPT.", code: (r && r.code) || "error" } }) }));
        if (r && ["reauth", "not_connected", "plan_disabled"].includes(r.code)) refreshRg();
        finish("");
      }
      return;
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
    messages.push(payload.files.length ? { role: "user", text: payload.text, files: payload.files } : { role: "user", text: payload.text });
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
      };
      // Ted on the server sent the latest draft itself (email.send in this reply): its card is no longer sendable.
      const sentBy = am.actions.some((a) => a.ok && a.tool === "email.send") ? newestEmailId(chatsRef.current) : null;
      updChat(cid, (c) => ({ ...c, updatedAt: now(), messages: [...unpend(c.messages), am] }));
      if (sentBy) setChats((cs) => cs.map((c) => (c.messages.some((x) => x.id === sentBy) ? { ...c, messages: c.messages.map((x) => (x.id === sentBy && x.time < at ? { ...x, emailState: "sent" } : x)) } : c)));
      if (am.actions.some((a) => a.ok && a.mutating)) refreshCases();
      finish(am.text, mid);
    } else {
      const code = (r && r.code) || "error";
      const am = { id: mid, role: "assistant", engine: "server", text: "", time: at, retry: userMsg.id,
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

  // Manual "try again" for a failed or stopped answer; engine can be switched to Ted's server.
  function retry(m, engine) {
    if (busyRef.current || !chat) return;
    const idx = chat.messages.findIndex((x) => x.id === m.retry);
    if (idx < 0) return;
    const userMsg = chat.messages[idx];
    const kept = payloads.current.get(userMsg.id);
    if (!kept && (userMsg.files || []).some((f) => f.kind !== "ref")) { toast("Прикачените файлове не се пазят след рестарт – прикачете ги отново и изпратете пак."); return; }
    const go = () => {
      updChat(chat.id, (c) => ({ ...c, messages: c.messages.filter((x) => x.id !== m.id) }));
      run(chat.id, chat.messages.slice(0, idx), userMsg, { engine: engine || m.engine || S.engine, caseId: chat.caseId });
    };
    const unknown = m.stopped ? m.engine !== "realgpt" : !!(m.error && (m.error.maybeExecuted || m.error.code === "quota"));
    if (unknown) setConfirm({ title: "Да опитам ли отново?", text: "Сигурни ли сте? Проверете в CRM дали действието не е изпълнено. Ако вече е изпълнено, повторното изпращане може да го извърши втори път.", ok: go });
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

  live.current.send = send; live.current.toggleRec = toggleRec; live.current.newChat = newChat; live.current.copy = copy;
  live.current.toggleMini = () => set("mini", !SRef.current.mini);
  live.current.lastAnswer = chat ? ((chat.messages.filter((m) => m.role === "assistant" && m.text).slice(-1)[0]) || {}).text || null : null;

  /* ---- Parts of the interface ---- */
  const me = <><Avatar text={initials(user.name, user.email)} /><span className="me-txt"><b>{user.name || "Профил"}</b><small>{user.email || user.phoneMasked || "Имоти Надежда"}</small></span></>;
  const chev = (folded) => <Icon n="chev" cls={"sec-chev" + (folded ? " folded" : "")} />;

  const chatRow = (c) => (
    <div key={c.id} className={"row" + (c.id === active && view === "chat" ? " on" : "")}>
      {renaming === c.id ? (
        <input id={"rn-" + c.id} autoFocus defaultValue={c.title} maxLength={120} onBlur={(e) => { const v = e.target.value.trim(); updChat(c.id, (x) => ({ ...x, title: v || x.title })); setRenaming(null); }} onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setRenaming(null); }} />
      ) : <button className="t" onClick={() => openChat(c.id)} title={c.title}>{c.pinned ? "📌 " : ""}{c.title}</button>}
      <button className="more" aria-label="Опции на чата" aria-expanded={!!(pop && pop.id === "chat-" + c.id)} onClick={(e) => openPop("chat-" + c.id, e, c)}><Icon n="dots" /></button>
    </div>
  );

  const Sidebar = (
    <aside className={"side" + (S.mini ? " min" : "") + (drawer ? " open" : "")} aria-label="Странична лента">
      {phone ? <>
        <div className="side-top ph">
          <button className="srch" onClick={() => { setModal("search"); setDrawer(false); }}><Icon n="search" /><span>Търси</span></button>
          <button className="ibtn" onClick={() => newChat()} aria-label="Нов чат"><Icon n="newchat" /></button>
        </div>
        <div className="logo-mini"><img src={logo} alt="Имоти Надежда" /></div>
      </> : (
        <div className="side-top">
          <div className="logo-tile"><img src={logo} alt="Имоти Надежда" /></div>
          <button className="ibtn collapse-btn" onClick={() => set("mini", !S.mini)} aria-label={S.mini ? "Отвори лентата" : "Затвори лентата"} title="Ctrl+Shift+S"><Icon n="sidebar" /></button>
          {drawer ? <button className="ibtn" onClick={() => setDrawer(false)} aria-label="Затвори"><Icon n="x" /></button> : null}
        </div>
      )}
      <nav className="side-nav">
        <button className={"nav n-new" + (view === "chat" && !active ? " on" : "")} onClick={() => newChat()}><Icon n="newchat" /><span>Нов чат</span><kbd>Ctrl ⇧ O</kbd></button>
        <button className="nav n-search" onClick={() => { setModal("search"); setDrawer(false); }}><Icon n="search" /><span>Търси в чатовете</span><kbd>Ctrl K</kbd></button>
        <button className={"nav" + (view === "skills" ? " on" : "")} onClick={() => openView("skills")}><Icon n="skills" /><span>Умения и роли</span></button>
      </nav>
      <div className="side-scroll">
        <div className="sec"><button className="sec-t" onClick={() => setFold((f) => ({ ...f, cases: !f.cases }))} aria-expanded={!fold.cases}>📁 Казуси{chev(fold.cases)}</button><button onClick={() => setModal("newCase")} aria-label="Нов казус" title="Нов казус"><Icon n="plus" cls="sm16" /></button></div>
        {!fold.cases ? (
          <div className="side-list" data-testid="case-list">
            <div className="row"><button className="t row-ic" onClick={() => setModal("newCase")}><Icon n="folderPlus" />Нов казус…</button></div>
            {cases.items.map((cs) => (
              <div key={cs.id} className={"row" + (view === "case" && caseView && caseView.id === cs.id ? " on" : "")}>
                <button className="t row-ic" onClick={() => openCase(cs.id)} title={cs.title}><Icon n="folder" /><span className="ell">{cs.title}</span></button>
                <button className="more" aria-label="Опции на казуса" onClick={(e) => openPop("case-" + cs.id, e, cs)}><Icon n="dots" /></button>
              </div>
            ))}
            {cases.status === "loading" ? <div className="grp-day">Зареждам казусите…</div> : null}
            {cases.status === "error" ? <div className="grp-day side-err">Казусите не се заредиха. <button className="lnk" onClick={refreshCases}>Опитай отново</button></div> : null}
            {cases.status === "ok" && !cases.items.length ? <div className="grp-day">Няма отворени казуси.</div> : null}
          </div>
        ) : null}
        <div className="sec"><button className="sec-t" onClick={() => setFold((f) => ({ ...f, chats: !f.chats }))} aria-expanded={!fold.chats}>💬 Чатове{chev(fold.chats)}</button></div>
        {!fold.chats ? (
          <div className="side-list">
            {pinned.length ? <><div className="grp-day">Закачени</div>{pinned.map(chatRow)}</> : null}
            {["Днес", "Вчера", "Последните 7 дни", "Последните 30 дни", "По-стари"].map((g) => (groups[g] ? <Fragment key={g}><div className="grp-day">{g}</div>{groups[g].map(chatRow)}</Fragment> : null))}
            {!visible.length ? <div className="grp-day">Още няма чатове на този компютър.</div> : null}
          </div>
        ) : null}
      </div>
      {phone ? (
        <div className="me-row">
          <button className="me" onClick={(e) => openPop("me", e)} aria-label="Профил">{me}</button>
          <button className="ibtn me-gear" onClick={() => openSettings("general")} aria-label="Настройки"><Icon n="gear" /></button>
        </div>
      ) : <button className="me" onClick={(e) => openPop("me", e)} aria-label="Профил">{me}</button>}
    </aside>
  );

  const tempTitle = "Временен чат – не се пази на този компютър";
  const Top = phone ? (
    <header className="top ph">
      <button className="ibtn burger" onClick={() => setDrawer(true)} aria-label="Меню"><Icon n="menu" /></button>
      <button className="mtitle" onClick={(e) => openPop("model", e)} aria-haspopup="menu" data-testid="model-btn">{chat && chat.temporary ? "⏳ " : ""}<span>{modelShort}</span><Icon n="chev" cls="sm16" /></button>
      <span className="spacer" />
      {!chat && view === "chat" ? <button className={"ibtn tmp-i" + (temp ? " on" : "")} onClick={() => setTemp(!temp)} aria-label="Временен чат" aria-pressed={temp} title={tempTitle}>⏳</button> : null}
      <button className="ibtn" onClick={() => newChat()} aria-label="Нов чат"><Icon n="newchat" /></button>
      {chat ? <button className="ibtn" onClick={(e) => openPop("chat-" + chat.id, e, chat)} aria-label="Опции на разговора"><Icon n="dots" /></button> : null}
    </header>
  ) : (
    <header className="top">
      <button className="ibtn burger" onClick={() => setDrawer(true)} aria-label="Меню"><Icon n="menu" /></button>
      <span className="av"><img src={avatar} alt="" /></span>
      <div className="ttl"><b>Тед Асистент</b><span className={"online " + conn}><i />{conn === "ok" ? "На линия" : conn === "off" ? "Няма връзка" : "Свързване…"}</span></div>
      <button className="pill-top" onClick={(e) => openPop("model", e)} aria-haspopup="menu" data-testid="model-btn"><span>{modelShort}</span>{S.engine === "realgpt" ? null : <small className="pill-live">сървър</small>}<Icon n="chev" cls="sm16" /></button>
      {S.engine === "realgpt" ? <span className="rg-ind" data-testid="rg-ind">Използва вашия ChatGPT план<button className="lnk" onClick={manageUsage}>Управление на лимита</button></span> : null}
      {chat && chat.temporary ? <span className="tmp-tag">⏳ Временен чат</span> : null}
      <span className="spacer" />
      <button className="ibtn newc" onClick={() => newChat()} aria-label="Нов чат"><Icon n="newchat" /></button>
      {!chat && view === "chat" ? <button className={"tmp" + (temp ? " on" : "")} onClick={() => setTemp(!temp)} title={tempTitle} aria-pressed={temp}>⏳<span>Временен</span></button> : null}
      {chat ? <button className="ibtn" onClick={(e) => openPop("chat-" + chat.id, e, chat)} aria-label="Опции на разговора"><Icon n="dots" /></button> : null}
      <button className="gear" onClick={() => openSettings("general")} aria-label="Настройки" title="Настройки"><Icon n="gear" cls="sm19" /></button>
    </header>
  );

  const fillExample = (g) => { setInput(g.ex); focusComposer(); };
  const disc = S.engine === "realgpt"
    ? phone ? "Без достъп до CRM. Може да греши." : "Real GPT отговаря през вашия ChatGPT план, без достъп до CRM, казусите и паметта на Тед. Може да греши – проверявайте важното."
    : phone ? "Тед може да греши. Проверявайте важното." : "Тед работи с реалните данни в CRM според правата на вашия акаунт. Може да греши – проверявайте важното.";
  const Composer = (
    <div className="dock">
      {phone && !chat ? <div className="sugcards" aria-label="Предложения">
        {[["🏠", "Намери имот", "търсене в CRM", () => setModal("attachProp")], ["📄", "Прегледай документи", "документи в CRM", () => setModal("docs")], ["📎", "Прикачи имот", "към съобщението", () => setModal("attachProp")]].map(([em, t, sb, fn]) => <button key={t} className="scard" onClick={fn}><span className="se">{em}</span><b>{t}</b><small>{sb}</small></button>)}
        {GROUPS.map((g) => <button key={g.id} className="scard" onClick={() => fillExample(g)}><span className="se">{g.em}</span><b>{g.name}</b><small>{g.ex}</small></button>)}
      </div> : null}
      {!phone ? (
        <div className="rail" aria-label="Действия на Тед">
          <button onClick={() => setModal("attachProp")}><Icon n="home" /><b>Намери имот</b></button>
          <button onClick={() => setModal("docs")}><Icon n="doc" /><b>Прегледай документи</b></button>
          <button onClick={() => setModal("attachProp")}><Icon n="clip" /><b>Прикачи имот</b></button>
        </div>
      ) : null}
      <div className="compose" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); attach(e.dataTransfer.files); }}>
        {files.length ? (
          <div className="cfiles">{files.map((f) => (
            <div className="cfile" key={f.id}>
              {f.thumb ? <img src={f.thumb} alt="" /> : <span className={"ficon " + (f.kind === "ref" ? "ref" : extOf(f.name))}>{f.kind === "ref" ? "CRM" : (extOf(f.name) || "file").slice(0, 4).toUpperCase()}</span>}
              <div className="cfile-tx"><span>{f.name}</span><small>{f.kind === "ref" ? "препратка към CRM" : f.kind === "text" ? "текст · " + f.text.length + " знака" + (f.cut ? " (съкратен)" : "") : fmtSize(f.size)}</small></div>
              <button className="x" onClick={() => setFiles((fs) => fs.filter((x) => x.id !== f.id))} aria-label="Премахни"><Icon n="x" /></button>
            </div>))}</div>
        ) : null}
        {phone && (curCase || S.role !== "auto") ? <div className="ctags">
          {curCase ? <span className="ctag">📁 {curCase.title}{!chat ? <button onClick={() => setDraftCase(null)} aria-label="Махни казуса">×</button> : null}</span> : null}
          {S.role !== "auto" ? <span className="ctag">{role.em} {role.short}<button onClick={() => set("role", "auto")} aria-label="Махни ролята">×</button></span> : null}
        </div> : null}
        {rec ? <RecBar rec={rec} /> : (
          <textarea id="composer" ref={taRef} rows={1} value={input} placeholder={phone ? "Попитай Тед" : "Съобщение…"} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && S.enterSend && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); attach(e.clipboardData.files); } }} />
        )}
        <div className="crow">
          <button className="cbtn c-plus" onClick={(e) => openPop("plus", e)} aria-label="Прикачи" title="Прикачи снимка, PDF или имот"><Icon n="plus" /></button>
          {!phone ? <><button className={"cpill" + (curCase ? " on" : "")} onClick={(e) => openPop("case", e)} data-testid="case-pill"><Icon n="folder" /><span>{curCase ? <>Казус: <b>{curCase.title}</b></> : "Общ разговор"}</span><Icon n="chev" cls="sm14" /></button>
            <button className={"cpill role" + (S.role !== "auto" ? " on" : "")} onClick={(e) => openPop("skills", e)}>{S.role !== "auto" ? <span>{role.em} <b>{role.short}</b></span> : <><Icon n="skills" /><span>Умения и роли</span></>}<Icon n="chev" cls="sm14" /></button>
          </> : null}
          <span className="spacer" />
          <button className={"cbtn c-mic" + (rec ? " rec" : "")} onClick={toggleRec} disabled={rec === "busy"} aria-label={rec ? "Спри диктовката" : "Диктовка"} title="Диктовка">{rec ? <Icon n="stopsq" fill="currentColor" /> : <Icon n="mic" />}</button>
          {/* The second click of a double-click on "Изпрати" lands here (the button swaps while busy): it must not stop the request. */}
          {busy ? <button className="snd" onClick={(e) => { if (e.detail > 1) return; stop(); }} aria-label="Спри" title="Спри"><Icon n="stopsq" fill="currentColor" /></button>
            : (input.trim() || files.length) ? <button className="snd" onClick={() => send()} aria-label="Изпрати"><Icon n="up" /></button>
              : <button className="snd" onClick={() => setVoice(true)} aria-label="Гласов режим" title="Гласов режим"><Icon n="wave" /></button>}
        </div>
      </div>
      <div className="disc">{S.engine === "realgpt" ? <span className="rg-ind-d" data-testid="rg-ind-narrow">Използва вашия ChatGPT план · <button className="lnk" onClick={manageUsage}>Управление на лимита</button> · </span> : null}{disc}</div>
    </div>
  );

  // Never retried automatically. Real GPT codes get their own next step (usage page / new sign-in).
  const errorBox = (m) => {
    const e = m.error;
    const rgLimit = m.engine === "realgpt" && e.code === "usage_limit";
    const rgSignIn = m.engine === "realgpt" && RG_SIGNIN_CODES.includes(e.code);
    const canRetry = !!m.retry && e.code !== "invalid" && e.code !== "auth" && !rgLimit && !rgSignIn;
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
        {m.engine === "realgpt" && m.retry ? <button className="b" onClick={() => retry(m, "server")} disabled={!!busy}>Отговори с Тед (сървъра)</button> : null}
      </div>
    );
  };

  const Thread = chat ? (
    <div className="thread" ref={threadRef} onScroll={(e) => { const el = e.currentTarget; const b2 = el.scrollHeight - el.scrollTop - el.clientHeight < 90; if (b2 !== atBottom) setAtBottom(b2); }}>
      <div className="col">
        {chat.messages.map((m) => (m.role === "user" ? (
          <div className="msg u" key={m.id}>
            <div className="mbody">
              {m.files && m.files.length ? <div className="ufiles">{m.files.map((f) => (f.thumb ? <img key={f.id} src={f.thumb} alt={f.name} onClick={() => setLb({ src: f.thumb, cap: f.name })} /> : <div key={f.id} className="card file ufile"><span className={"ficon " + (f.kind === "ref" ? "ref" : extOf(f.name))}>{f.kind === "ref" ? "CRM" : (extOf(f.name) || "file").slice(0, 4).toUpperCase()}</span><div className="fx"><b>{f.name}</b><span className="meta">{f.kind === "ref" ? "препратка към CRM" : fmtSize(f.size)}</span></div></div>))}</div> : null}
              {m.text ? <div className="bub">{m.voice ? "🎤 " : ""}{m.text}</div> : null}
              <div className="uacts"><button className="ibtn" onClick={() => copy(m.text)} aria-label="Копирай"><Icon n="copy" /></button><button className="ibtn" onClick={() => { setInput(m.text); focusComposer(); }} aria-label="Редактирай като ново съобщение" title="Постави в полето за писане"><Icon n="pencil" /></button></div>
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
                  if (!showActs && !m.email && !m.panel && !m.video && !m.listings) return null;
                  return (
                    <div className="cards">
                      {showActs ? <ActionsCard actions={acts} /> : null}
                      {m.email ? <EmailCard m={m} block={emailBlock(m, newestEmail, Date.now(), mark)} busy={emailBusy === m.id} onSend={() => confirmEmail(chat.id, m.id)} onEdit={() => { setInput("Промени имейла: "); focusComposer(); }} /> : null}
                      {m.listings ? <ListingCards items={m.listings} onAttach={(p) => attachRefs([propFile(p)])} /> : null}
                      {m.panel || m.video ? <PanelCard panel={m.panel} video={m.video} /> : null}
                    </div>
                  );
                })()}
                {m.error ? errorBox(m) : null}
                {m.stopped ? <div className="note stop-note" data-testid="stop-note">⏹ {m.engine === "realgpt" ? "Спряно от вас." : STOP_NOTE}{m.retry ? <> <button className="lnk" onClick={() => retry(m)} disabled={!!busy}>Опитай отново</button></> : null}</div> : null}
                {m.incomplete ? <div className="note">✂️ Отговорът е прекъснат по дължина – помолете „продължи“.</div> : null}
                {m.local || m.mode || m.modelName || m.fallback || m.effortIgnored || m.fromEmail ? (
                  <div className="foot-tags">
                    {m.local ? <span className="demo">ℹ️ Съобщение от програмата – не е изпратено към Тед</span> : null}
                    {m.fromEmail ? <span className="demo live">Резултат от сървъра · email.send</span> : null}
                    {m.mode && roleOf(m.mode) ? <span className="demo">{roleOf(m.mode).em} {roleOf(m.mode).short}</span> : null}
                    {m.engine === "server" && m.modelName ? <span className="demo live" data-testid="model-chip">Сървър · {m.modelName}</span> : null}
                    {m.engine === "realgpt" ? <span className="demo sel" data-testid="model-chip">Real GPT · {m.modelName}</span> : null}
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

  const hello = firstName(user.name);
  const tempSub = S.engine === "realgpt"
    ? "Този чат не се пази на този компютър. Разговорът минава през вашия ChatGPT акаунт."
    : "Този чат не се пази на този компютър. Сървърът на Тед все пак записва разговора в паметта си, както в сайта.";
  const badge = <span className={"mode-badge" + (conn === "ok" ? " on" : "")}>{conn === "ok" ? "● Свързан · " + modelShort : conn === "off" ? "Няма връзка със сървъра" : "… свързване"}</span>;
  const sessNote = remembered ? null : <div className="sess-note" role="note" data-testid="session-note">🔐 {SESSION_NOTE}</div>;
  const Home = phone ? (
    <div className="home ph">
      {draftCase && curCase ? <span className="case-banner"><Icon n="folder" cls="sm16" />Казус „{curCase.title}“</span> : null}
      {badge}
      {temp ? <h1>⏳ Временен чат</h1> : <h1>С какво да помогна{hello ? ", " + hello : ""}?</h1>}
      {temp ? <p className="sub">{tempSub}</p> : null}
      {sessNote}
    </div>
  ) : (
    <div className="home">
      <span className="av"><img src={avatar} alt="" /></span>
      {draftCase && curCase ? <span className="case-banner"><Icon n="folder" cls="sm16" />Нов чат в казус „{curCase.title}“</span> : null}
      {badge}
      {temp ? <h1>⏳ Временен чат</h1> : <h1>С какво да помогна{hello ? ", " + hello : ""}? <span className="wave">👋</span></h1>}
      <p className="sub">{temp ? tempSub : "Аз съм Тед Асистент на Имоти Надежда. Помагам с клиенти, имоти, огледи, документи, преводи, ипотека и комисионна. Пишете ми, прикачете снимка или файл, или говорете с мен."}</p>
      <div className="chips">{GROUPS.map((g) => <button key={g.id} className="chip" onClick={() => fillExample(g)}><span className="cem">{g.em}</span>{g.name}</button>)}</div>
      {sessNote}
    </div>
  );

  /* ---- Pages ---- */
  const Skills = (
    <div className="page"><div className="page-in">
      <div className="page-h"><h1>Умения и роли</h1><p>Тед избира ролята автоматично според въпроса. Ръчният избор тук важи, докато не върнете „Автоматично“.</p></div>
      <div className="sheet">
        <div className="sec-h">Роля на Тед</div>
        <div className="grid-cards">{ROLES.map((r) => <button key={r.id} className={"gcard" + (S.role === r.id ? " on" : "")} onClick={() => { set("role", r.id); toast("Роля: " + r.name); }}><span className="em">{r.em}</span><span><b>{r.name}</b><small>{r.sub}</small></span></button>)}</div>
        <div className="sec-h mt">Вградени умения <small>работят в CRM на сайта</small></div>
        <div className="grid-cards">{SKILLS.map((s) => <button key={s.id} className="gcard" onClick={() => setModal("skill-" + s.id)}><span className="em">{s.em}</span><span><b>{s.name}</b><small>{s.sub}</small></span></button>)}</div>
        <div className="info">Ролите са режимите на сървъра на Тед (същите като в сайта). С Real GPT ролите не се прилагат.</div>
      </div>
    </div></div>
  );

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
    closePop();
    if (chat) { if ((chat.caseId || null) !== (id || null)) { newChat(id); toast(id ? "Нов чат в избрания казус." : "Нов чат без казус."); } } else setDraftCase(id || null);
  }
  function popContent() {
    if (!pop) return null;
    const id = pop.id;
    if (id === "model") return (
      <Pop pop={pop} onClose={closePop} width={390}>
        <div className="hd">Модел<small>кой отговаря</small></div>
        <div className="grp">Тед (сървър)</div>
        <It em="🤖" title="По подразбиране" sub="моделът, който сървърът на Тед избира сам" check={S.engine === "server" && !S.model} onClick={() => { patch({ engine: "server", model: "" }); closePop(); }} />
        {models.map((m) => <It key={m.id} em={provEm(m.provider)} title={m.name} sub={[m.note, m.vision ? "снимки" : "", m.pdf ? "PDF" : ""].filter(Boolean).join(" · ")} prov={m.provider} check={S.engine === "server" && S.model === m.id} onClick={() => { patch({ engine: "server", model: m.id }); closePop(); }} />)}
        {modelsErr ? <div className="info pop-info">Списъкът с модели не се зареди: {modelsErr} <button className="lnk" onClick={refreshModels}>Опитай отново</button></div> : null}
        <div className="grp">🔗 Real GPT · вашият ChatGPT план</div>
        {!rg.connected ? <It em="🔗" title="Продължи с ChatGPT" sub="вход с вашия ChatGPT акаунт в браузъра" prov="ChatGPT план" onClick={() => { closePop(); setModal("realgpt"); }} /> : <>
          <div className="seg-l">{rg.email || "ChatGPT акаунт"} · модели от вашия акаунт</div>
          {rg.planEnabled === false ? <div className="info pop-info">Използването на ChatGPT плана не е разрешено. <button className="lnk" onClick={() => { closePop(); setModal("realgpt"); }}>Продължи с ChatGPT</button> и го разрешете.</div>
            : <div className="rg-use" data-testid="rg-use">Използва вашия ChatGPT план<button className="lnk" onClick={manageUsage}>Управление на лимита</button></div>}
          {rgModels.map((m) => <It key={m.slug} em="✴️" title={m.displayName} sub={m.slug} check={S.engine === "realgpt" && S.rgModel === m.slug} onClick={() => { patch({ engine: "realgpt", rgModel: m.slug }); closePop(); }} />)}
          {rgErr ? <div className="info pop-info">{rgErr} <button className="lnk" onClick={loadRgModels}>Опитай отново</button></div> : null}
          <div className="seg-l">Ниво на мислене (по избор)</div>
          <div className="segs" role="group" aria-label="Ниво на мислене">
            <button className={!S.rgEffort ? "on" : ""} aria-pressed={!S.rgEffort} onClick={() => set("rgEffort", "")}>Станд.</button>
            {EFFORTS.map((e) => <button key={e.id} className={S.rgEffort === e.id ? "on" : ""} aria-pressed={S.rgEffort === e.id} onClick={() => set("rgEffort", S.rgEffort === e.id ? "" : e.id)}>{e.name}</button>)}
          </div>
          <It icon="logout" title="Прекъсни връзката" sub="изход от ChatGPT акаунта в програмата" onClick={rgSignOut} />
        </>}
        <div className="info pop-info">{RG_LIMITS}</div>
      </Pop>
    );
    if (id === "plus") return (
      <Pop pop={pop} onClose={closePop} width={phone ? undefined : 320}>
        {phone ? (
          <div className="ptiles">
            <button onClick={() => galleryRef.current.click()}><span>🖼</span>Снимки</button>
            <button onClick={() => filesInRef.current.click()}><span>📎</span>Файлове</button>
            <button onClick={() => { closePop(); setModal("attachProp"); }}><span>🏠</span>Имот</button>
          </div>
        ) : <>
          <div className="hd">Прикачи</div>
          <It em="🖼" title="Снимки" sub="намаляват се до 1400 px преди изпращане" onClick={() => galleryRef.current.click()} />
          <It em="📎" title="Файлове" sub="PDF, снимки и текст (.txt, .md, .csv) · до 3 файла, общо 3,8 MB" onClick={() => filesInRef.current.click()} />
        </>}
        <It em="🗂" title="Документи от CRM" sub="прикачва се препратка, не файлът" onClick={() => { closePop(); setModal("docs"); }} />
        {!phone ? <It em="🏠" title="Прикачи имот" sub="търсене в имотите на агенцията" onClick={() => { closePop(); setModal("attachProp"); }} /> : null}
        {phone ? <>
          <div className="sep" />
          <It em="📁" title={curCase ? "Казус: " + curCase.title : "Казус"} sub={curCase ? "смени казуса" : "Общ разговор · избери казус с памет"} right={<Icon n="chevR" />} onClick={(e) => openPop("case", e)} />
          <It em="✨" title={S.role !== "auto" ? "Роля: " + role.short : "Умения и роли"} sub="вградени умения и роля на Тед" right={<Icon n="chevR" />} onClick={(e) => openPop("skills", e)} />
        </> : null}
        <div className="sep" />
        <It em="🔌" title="Свързани услуги" sub="CRM и Real GPT" onClick={() => openSettings("apps")} />
      </Pop>
    );
    if (id === "case") return (
      <Pop pop={pop} onClose={closePop} width={330}>
        <div className="hd">Казуси – теми с памет на сървъра</div>
        <It em="💬" title="Общ разговор" sub="без казус, с дългосрочната памет на Тед" check={!curCase} onClick={() => pickCase(null)} />
        {cases.items.map((cs) => <It key={cs.id} em="📁" title={cs.title} sub={cs.client || undefined} check={!!curCase && curCase.id === cs.id} onClick={() => pickCase(cs.id)} />)}
        {cases.status === "error" ? <div className="info pop-info">Казусите не се заредиха: {cases.error} <button className="lnk" onClick={refreshCases}>Опитай отново</button></div> : null}
        <It em="＋" title="Нов казус…" sub="име и по желание клиент" onClick={() => { closePop(); setModal("newCase"); }} />
      </Pop>
    );
    if (id === "skills") return (
      <Pop pop={pop} onClose={closePop} width={360}>
        <div className="hd">Умения и роли<small>вградени умения и роля на Тед</small></div>
        <div className="grp">Вградени умения · в CRM на сайта</div>
        {SKILLS.map((s) => <It key={s.id} em={s.em} title={s.name} sub={s.sub} onClick={() => { closePop(); setModal("skill-" + s.id); }} />)}
        <div className="grp">Роля на Тед</div>
        {ROLES.map((r) => <It key={r.id} em={r.em} title={r.name} sub={r.sub} check={S.role === r.id} onClick={() => { set("role", r.id); closePop(); }} />)}
        <div className="sep" />
        <It icon="skills" title="Всички умения и роли" onClick={() => openView("skills")} />
      </Pop>
    );
    if (id === "me") return (
      <Pop pop={pop} onClose={closePop} width={280}>
        <div className="hd">{user.name || "Профил"}<small className="hd-sub">{user.email || user.phoneMasked || ""}</small></div>
        <div className="sep" />
        <It icon="gear" title="Настройки" onClick={() => openSettings("general")} />
        <It icon="monitor" title={S.compact ? "Пълен прозорец" : "Компактен прозорец"} sub="тесен прозорец с подредба като на телефон" onClick={toggleCompact} />
        <It icon="help" title="Помощ" sub="клавишни комбинации" onClick={() => { closePop(); setDrawer(false); setModal("help"); }} />
        <div className="sep" />
        <It icon="logout" title="Изход" onClick={() => { closePop(); onLogout(); }} />
      </Pop>
    );
    if (id.startsWith("chat-")) {
      const c = pop.data;
      return (
        <Pop pop={pop} onClose={closePop} align="right" width={250}>
          <It icon="pencil" title="Преименувай" onClick={() => { closePop(); setRenaming(c.id); if (S.mini) set("mini", false); if (window.innerWidth < 900) setDrawer(true); }} />
          <It icon="pin" title={c.pinned ? "Откачи" : "Закачи"} onClick={() => { updChat(c.id, (x) => ({ ...x, pinned: !x.pinned })); closePop(); }} />
          <It icon="download" title="Експорт (Markdown)" sub="запис като файл" onClick={() => { closePop(); exportChat(c.id); }} />
          <It icon="archive" title="Архивирай" onClick={() => { updChat(c.id, (x) => ({ ...x, archived: true })); if (active === c.id) setActive(null); closePop(); toast("Архивирано. Виж Настройки → Данни."); }} />
          <div className="sep" />
          <It icon="trash" title="Изтрий" danger onClick={() => { closePop(); askDelete(c); }} />
        </Pop>
      );
    }
    if (id.startsWith("case-")) {
      const cs = pop.data;
      return (
        <Pop pop={pop} onClose={closePop} align="right" width={240}>
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
      const res = chats.filter((c) => !c.temporary && (!q || c.title.toLowerCase().includes(q) || c.messages.some((m) => (m.text || "").toLowerCase().includes(q)))).slice(0, 30);
      const hl = (s) => { if (!q) return s; const i = s.toLowerCase().indexOf(q); return i < 0 ? s : <>{s.slice(0, i)}<mark>{s.slice(i, i + q.length)}</mark>{s.slice(i + q.length)}</>; };
      return (
        <Modal title="Търси в чатовете" onClose={() => { close(); setSearch(""); }} size="md">
          <div className="search-in"><Icon n="search" /><input id="srch" autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Търси по заглавие или текст…" /></div>
          <div className="mb mb0"><div className="sres">
            <It icon="newchat" title="Нов чат" onClick={() => { close(); newChat(); }} />
            {res.map((c) => { const hit = q ? c.messages.find((m) => (m.text || "").toLowerCase().includes(q)) : null; return <It key={c.id} icon={c.caseId ? "folder" : "chat"} title={hl(c.title)} sub={hit ? hl((hit.text || "").slice(0, 90)) : dayGroup(c.updatedAt)} onClick={() => { close(); setSearch(""); if (c.archived) updChat(c.id, (x) => ({ ...x, archived: false })); openChat(c.id); }} />; })}
            {!res.length ? <div className="empty">Няма намерени чатове на този компютър.</div> : null}
          </div></div>
        </Modal>
      );
    }
    if (modal === "settings") return (
      <Settings phone={phone} S={S} set={set} patch={patch} tab={setTab} setTab={setSetTab} close={close} user={user} chats={chats} setChats={setChats} active={active} toast={toast}
        testVoice={() => toggleSpeak("Здравейте! Аз съм Тед, вашият асистент в Имоти Надежда.", "test")} speaking={speaking === "test"}
        models={models} modelsErr={modelsErr} refreshModels={refreshModels} rg={rg} rgModels={rgModels} rgErr={rgErr} openRealGpt={() => setModal("realgpt")} rgSignOut={rgSignOut}
        read={read} conn={conn} onConn={track} exportChat={exportChat} deleteChat={askDelete} clearLocal={clearLocal} setConfirm={setConfirm} logout={onLogout}
        remembered={remembered} manageUsage={manageUsage} />
    );
    if (modal === "newCase") return (
      <Modal title="Нов казус" onClose={close} size="sm" foot={<><button className="b" onClick={close}>Отказ</button><button className="b wine" disabled={caseBusy} onClick={() => {
        const t = document.getElementById("nc-t").value.trim(); const cl = document.getElementById("nc-c").value.trim();
        if (!t) { toast("Въведете име на казуса."); return; }
        createCase(t.slice(0, 160), cl.slice(0, 120));
      }}>{caseBusy ? <i className="spin" /> : null}Създай казус</button></>}>
        <div className="mb">
          <div className="fld"><label htmlFor="nc-t">Име на казуса</label><input id="nc-t" className="inp" autoFocus maxLength={160} placeholder="Напр. Продажба · къща с двор" /></div>
          <div className="fld"><label htmlFor="nc-c">Клиент (по желание)</label><input id="nc-c" className="inp" maxLength={120} placeholder="Име на клиент от CRM" /></div>
          <div className="info">Казусът се създава на сървъра на Тед и се вижда и в сайта. Всичко, казано в него, се помни там.</div>
        </div>
      </Modal>
    );
    if (modal === "attachProp") return <AttachProp close={close} read={read} onAttach={(ps) => { attachRefs(ps.map(propFile)); toast("🏠 Към съобщението е добавена препратка към имота."); }} />;
    if (modal === "docs") return <DocsModal close={close} read={read} onAttach={(f) => { attachRefs([f]); toast("📄 Към съобщението е добавена препратка към документа."); }} />;
    if (modal === "help") return (
      <Modal title="Помощ" onClose={close} size="sm">
        <div className="mb">
          <div className="sec-h">Клавишни комбинации</div>
          <dl className="kv"><dt>Нов чат</dt><dd>Ctrl + Shift + O</dd><dt>Търси в чатовете</dt><dd>Ctrl + K</dd><dt>Скрий/покажи лентата</dt><dd>Ctrl + Shift + S</dd><dt>Копирай последния отговор</dt><dd>Ctrl + Shift + C</dd><dt>Към полето за писане</dt><dd>Shift + Esc</dd><dt>Бърз прозорец</dt><dd>Ctrl + Shift + Space</dd><dt>Тази помощ</dt><dd>Ctrl + /</dd><dt>Нов ред</dt><dd>Shift + Enter</dd></dl>
          <div className="sec-h mt">Как работи</div>
          <p className="help-p">Тед отговаря през сървъра на imotinadezhda.bg със същите права и памет като в сайта. Чатовете се пазят шифровано на този компютър. Бутонът „✅ Да, изпрати“ и кратките потвърждения („да“, „ок“…) след чернова винаги минават през потвърждение в отделен прозорец на Windows. Тед на сървъра може да изпрати имейл и когато изрично го помолите с други думи – тогава важат правилата на сървъра.</p>
          <div className="clist">
            <button onClick={() => openSettings("about")}>💻 <b>За програмата</b><small>версия, връзка, логове</small></button>
            <button onClick={openCrm}>🌐 <b>CRM на сайта</b><small>отваря се в браузъра</small></button>
          </div>
        </div>
      </Modal>
    );
    if (modal === "realgpt") return <RealGptConnect close={close} rg={rg} onStatus={applyRg} onSignOut={rgSignOut} onManage={manageUsage} />;
    if (typeof modal === "string" && modal.startsWith("skill-")) return <SkillPanel id={modal.slice(6)} close={close} />;
    return null;
  }

  if (!loaded) return <Shell phone={phone} conn="wait"><div className="login"><span className="wait boot"><i className="spin" /> Зареждане…</span></div></Shell>;

  const bodyMain = view === "skills" ? Skills : view === "case" ? CasePage : (chat ? Thread : Home);
  return (
    <Shell phone={phone} conn={conn} onQuick={() => setQuick(true)}>
      <div className={"app" + (S.big ? " big" : "")}>
        {Sidebar}
        {drawer ? <div className="scrim" onClick={() => setDrawer(false)} /> : null}
        <main className="main">
          {Top}
          <div className="body">
            <div className="center">
              {bodyMain}
              {view === "chat" ? ToBottom : null}
              {view === "chat" ? Composer : null}
            </div>
            {canvas ? <Canvas cv={canvas} setCv={setCanvas} toast={toast} copy={copy} /> : null}
          </div>
        </main>
        <input ref={galleryRef} className="file-in" type="file" accept="image/*" multiple onChange={(e) => { attach(Array.from(e.target.files)); e.target.value = ""; }} />
        <input ref={filesInRef} className="file-in" type="file" accept="image/*,.pdf,.txt,.md,.csv" multiple onChange={(e) => { attach(Array.from(e.target.files)); e.target.value = ""; }} />
        {popContent()}
        {modalContent()}
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
