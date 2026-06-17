import { useEffect } from "react";

/**
 * Page editor overlay (Етап 1 — само визуално, без запис в БД).
 *
 * Активира се само в iframe-а на /admin/settings/page-editor (?__editor=1).
 *
 * Двоен клик / двоен тап върху секция (елемент с `data-section-id`)
 * → отваря плаващо меню с три опции:
 *   1. ↕ Премести         — секцията следва мишката/пръста между съседите
 *   2. ⤡ Размер           — балон с дръжки за ширина/височина
 *   3. 🎨 Дизайн          — галерия с готови визуални варианти + жив preview
 *
 * Промените са локални — записват се в DOM, но не и в БД. Запис в БД идва
 * в Етап 2 след нова миграция.
 */
export function SectionEditorOverlay() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("__editor") !== "1") return;

    // ---------------- стилове ----------------
    const style = document.createElement("style");
    style.setAttribute("data-editor-overlay", "true");
    style.textContent = `
      [data-section-id] {
        outline: 2px dashed transparent;
        outline-offset: -2px;
        transition: outline-color .15s;
      }
      [data-section-id]:hover { outline-color: rgba(245,196,110,.55); }
      [data-section-id].__ed-active {
        outline: 3px solid #f5c46e !important;
        box-shadow: 0 0 0 9999px rgba(20,4,8,.35);
        position: relative;
        z-index: 5;
      }
      [data-section-id].__ed-picked {
        outline: 3px solid #f5c46e !important;
        opacity: .92;
        pointer-events: none;
      }

      .__ed-menu, .__ed-bubble, .__ed-gallery, .__ed-banner {
        font: 600 12px/1.2 ui-sans-serif, system-ui, -apple-system;
        color: #f4d07d;
      }

      .__ed-banner {
        position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
        z-index: 99999;
        background: linear-gradient(90deg,#4f0314,#260108);
        border: 1px solid rgba(245,196,110,.5);
        padding: 8px 14px; border-radius: 999px;
        box-shadow: 0 8px 24px rgba(0,0,0,.4);
        pointer-events: none; max-width: 90vw; text-align: center;
      }

      .__ed-menu {
        position: absolute; z-index: 99998;
        background: linear-gradient(180deg,#4f0314,#260108);
        border: 1px solid rgba(245,196,110,.55);
        border-radius: 12px; padding: 6px;
        box-shadow: 0 16px 40px rgba(0,0,0,.55);
        display: flex; flex-direction: column; gap: 2px; min-width: 180px;
      }
      .__ed-menu button {
        display: flex; align-items: center; gap: 8px;
        padding: 9px 12px; border-radius: 8px;
        background: transparent; color: #f4d07d; border: 0;
        cursor: pointer; font: 600 13px/1 ui-sans-serif, system-ui;
        text-align: left;
      }
      .__ed-menu button:hover { background: rgba(245,196,110,.15); }
      .__ed-menu .__ed-sep { height: 1px; background: rgba(245,196,110,.2); margin: 4px 0; }
      .__ed-menu .__ed-close { color: #fca5a5; }

      .__ed-bubble {
        position: absolute; z-index: 99997;
        background: linear-gradient(180deg,#4f0314,#260108);
        border: 1px solid rgba(245,196,110,.55);
        border-radius: 14px; padding: 12px 14px;
        box-shadow: 0 16px 40px rgba(0,0,0,.55);
        min-width: 220px;
      }
      .__ed-bubble h4 { margin: 0 0 8px; font-size: 13px; color: #f5c46e; }
      .__ed-bubble .__ed-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
      .__ed-bubble label { font-size: 11px; color: rgba(244,208,125,.8); width: 64px; }
      .__ed-bubble input[type="range"] { flex: 1; accent-color: #f5c46e; }
      .__ed-bubble .__ed-val { font-size: 11px; color: #f5c46e; min-width: 50px; text-align: right; }
      .__ed-bubble .__ed-actions { display: flex; gap: 6px; margin-top: 10px; justify-content: flex-end; }
      .__ed-bubble .__ed-actions button {
        padding: 6px 12px; border-radius: 8px; border: 0; cursor: pointer;
        font: 600 12px/1 ui-sans-serif, system-ui;
      }
      .__ed-bubble .__ed-apply { background: linear-gradient(90deg,#f5c46e,#c59441); color: #260108; }
      .__ed-bubble .__ed-cancel { background: transparent; color: #f4d07d; border: 1px solid rgba(245,196,110,.4); }

      .__ed-gallery {
        position: fixed; inset: auto 12px 12px 12px; z-index: 99997;
        background: linear-gradient(180deg,#4f0314,#260108);
        border: 1px solid rgba(245,196,110,.55);
        border-radius: 16px; padding: 12px;
        box-shadow: 0 24px 60px rgba(0,0,0,.6);
        max-height: 50vh; display: flex; flex-direction: column; gap: 10px;
      }
      .__ed-gallery .__ed-gh { display: flex; align-items: center; justify-content: space-between; }
      .__ed-gallery .__ed-gh h4 { margin: 0; font-size: 13px; color: #f5c46e; }
      .__ed-gallery .__ed-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 8px; overflow-y: auto; padding: 4px 2px;
      }
      .__ed-gallery .__ed-card {
        cursor: pointer; border-radius: 10px; padding: 10px;
        border: 2px solid transparent; background: rgba(245,196,110,.08);
        color: #f4d07d; font: 600 11px/1.3 ui-sans-serif, system-ui;
        text-align: center; min-height: 64px;
        display: flex; align-items: center; justify-content: center;
      }
      .__ed-gallery .__ed-card.__ed-selected { border-color: #f5c46e; background: rgba(245,196,110,.22); }
      .__ed-gallery .__ed-actions { display: flex; gap: 6px; justify-content: flex-end; }
      .__ed-gallery .__ed-actions button {
        padding: 7px 14px; border-radius: 8px; border: 0; cursor: pointer;
        font: 600 12px/1 ui-sans-serif, system-ui;
      }
      .__ed-gallery .__ed-apply { background: linear-gradient(90deg,#f5c46e,#c59441); color: #260108; }
      .__ed-gallery .__ed-cancel { background: transparent; color: #f4d07d; border: 1px solid rgba(245,196,110,.4); }

      /* ===== Дизайн варианти (12 стила) ===== */
      .__ed-v-classic { border: 2px solid #c59441; border-radius: 0 !important; box-shadow: none !important; }
      .__ed-v-rounded { border-radius: 28px !important; overflow: hidden; }
      .__ed-v-shadow-xl { box-shadow: 0 30px 80px rgba(0,0,0,.45) !important; border-radius: 16px !important; }
      .__ed-v-glow { box-shadow: 0 0 60px rgba(245,196,110,.45) !important; border-radius: 14px !important; }
      .__ed-v-frame-gold { border: 4px solid #c59441 !important; border-radius: 10px !important; padding: 6px !important; background: #1a0508 !important; }
      .__ed-v-minimal { border: 0 !important; box-shadow: none !important; background: transparent !important; padding: 4px !important; }
      .__ed-v-dark-red { background: linear-gradient(135deg,#4f0314,#260108) !important; color: #f4d07d !important; padding: 16px !important; border-radius: 14px !important; }
      .__ed-v-gold { background: linear-gradient(135deg,#f4d07d,#c59441) !important; color: #260108 !important; padding: 16px !important; border-radius: 14px !important; }
      .__ed-v-cream { background: #fdfaf5 !important; color: #260108 !important; padding: 16px !important; border-radius: 12px !important; }
      .__ed-v-tight { padding: 4px !important; margin: 4px 0 !important; }
      .__ed-v-spacious { padding: 32px !important; margin: 24px 0 !important; }
      .__ed-v-card { background: rgba(255,255,255,.04); border: 1px solid rgba(245,196,110,.3) !important; border-radius: 16px !important; padding: 18px !important; backdrop-filter: blur(8px); }
    `;
    document.head.appendChild(style);

    const VARIANTS: { id: string; label: string; cls: string }[] = [
      { id: "classic", label: "Класически", cls: "__ed-v-classic" },
      { id: "rounded", label: "Заоблени ъгли", cls: "__ed-v-rounded" },
      { id: "shadow-xl", label: "Голяма сянка", cls: "__ed-v-shadow-xl" },
      { id: "glow", label: "Златен блясък", cls: "__ed-v-glow" },
      { id: "frame-gold", label: "Златна рамка", cls: "__ed-v-frame-gold" },
      { id: "minimal", label: "Минимал", cls: "__ed-v-minimal" },
      { id: "dark-red", label: "Тъмно червено", cls: "__ed-v-dark-red" },
      { id: "gold", label: "Златен фон", cls: "__ed-v-gold" },
      { id: "cream", label: "Кремав фон", cls: "__ed-v-cream" },
      { id: "tight", label: "Компактно", cls: "__ed-v-tight" },
      { id: "spacious", label: "Просторно", cls: "__ed-v-spacious" },
      { id: "card", label: "Карта стил", cls: "__ed-v-card" },
    ];
    const ALL_VARIANT_CLASSES = VARIANTS.map((v) => v.cls);

    // ---------------- банер ----------------
    const banner = document.createElement("div");
    banner.className = "__ed-banner";
    banner.style.display = "none";
    document.body.appendChild(banner);
    function setBanner(text: string | null) {
      if (!text) {
        banner.style.display = "none";
      } else {
        banner.textContent = text;
        banner.style.display = "block";
      }
    }

    // ---------------- state ----------------
    let activeEl: HTMLElement | null = null; // секцията с отворено меню
    let mode: "idle" | "move" | "resize" | "design" = "idle";
    let menuEl: HTMLDivElement | null = null;
    let bubbleEl: HTMLDivElement | null = null;
    let galleryEl: HTMLDivElement | null = null;

    // snapshots за Откажи
    let snapshotSize: { width: string; height: string } | null = null;
    let snapshotVariant: string | null = null;
    let pickedRect: DOMRect | null = null;

    function closeAllPopups() {
      menuEl?.remove(); menuEl = null;
      bubbleEl?.remove(); bubbleEl = null;
      galleryEl?.remove(); galleryEl = null;
    }
    function clearActive() {
      activeEl?.classList.remove("__ed-active", "__ed-picked");
      activeEl = null;
      mode = "idle";
      closeAllPopups();
      setBanner(null);
      document.body.style.userSelect = "";
    }

    function getSections(): HTMLElement[] {
      return Array.from(
        document.querySelectorAll<HTMLElement>("[data-section-id]"),
      ).filter((el) => !el.closest("[data-editor-skip]"));
    }

    function sendOrder() {
      const order = getSections()
        .map((el) => el.getAttribute("data-section-id") || "")
        .filter(Boolean);
      window.parent?.postMessage({ type: "page-editor:reorder", order }, "*");
    }

    // ---------------- floating menu ----------------
    function showMenu(target: HTMLElement, x: number, y: number) {
      closeAllPopups();
      activeEl?.classList.remove("__ed-active");
      activeEl = target;
      target.classList.add("__ed-active");

      menuEl = document.createElement("div");
      menuEl.className = "__ed-menu";

      const items: [string, string, () => void][] = [
        ["↕", "Премести", startMove],
        ["⤡", "Размер", startResize],
        ["🎨", "Дизайн", startDesign],
      ];
      for (const [icon, label, fn] of items) {
        const b = document.createElement("button");
        b.innerHTML = `<span style="font-size:15px">${icon}</span><span>${label}</span>`;
        b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
        menuEl.appendChild(b);
      }
      const sep = document.createElement("div");
      sep.className = "__ed-sep";
      menuEl.appendChild(sep);

      const closeB = document.createElement("button");
      closeB.className = "__ed-close";
      closeB.innerHTML = `<span style="font-size:15px">✕</span><span>Затвори</span>`;
      closeB.addEventListener("click", (e) => { e.stopPropagation(); clearActive(); });
      menuEl.appendChild(closeB);

      document.body.appendChild(menuEl);
      // позициониране — до клика, но в екрана
      const mw = menuEl.offsetWidth;
      const mh = menuEl.offsetHeight;
      const px = Math.min(window.innerWidth - mw - 8, Math.max(8, x + 8)) + window.scrollX;
      const py = Math.min(window.innerHeight - mh - 8, Math.max(8, y + 8)) + window.scrollY;
      menuEl.style.left = px + "px";
      menuEl.style.top = py + "px";
    }

    // ---------------- 1. Премести ----------------
    function startMove() {
      if (!activeEl) return;
      closeAllPopups();
      mode = "move";
      activeEl.classList.remove("__ed-active");
      activeEl.classList.add("__ed-picked");
      pickedRect = activeEl.getBoundingClientRect();
      document.body.style.userSelect = "none";
      setBanner("Местиш секцията… Цъкни/тапни за пускане. Esc = отказ.");
    }

    function reposition(y: number) {
      if (!activeEl || mode !== "move") return;
      const all = getSections();
      for (const other of all) {
        if (other === activeEl) continue;
        const or = other.getBoundingClientRect();
        const mid = or.top + or.height / 2;
        const rel = activeEl.compareDocumentPosition(other);
        const otherIsAfter = (rel & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        const otherIsBefore = (rel & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
        if (y < mid && otherIsAfter) {
          other.parentNode?.insertBefore(activeEl, other);
          break;
        }
        if (y > mid && otherIsBefore) {
          other.parentNode?.insertBefore(activeEl, other.nextSibling);
          break;
        }
      }
    }

    function dropMove() {
      if (mode !== "move" || !activeEl) return;
      activeEl.classList.remove("__ed-picked");
      const el = activeEl;
      mode = "idle";
      activeEl = null;
      document.body.style.userSelect = "";
      setBanner(null);
      sendOrder();
      // леко мигване
      el.classList.add("__ed-active");
      setTimeout(() => el.classList.remove("__ed-active"), 600);
    }

    // ---------------- 2. Размер ----------------
    function startResize() {
      if (!activeEl) return;
      closeAllPopups();
      mode = "resize";
      const el = activeEl;
      const cs = getComputedStyle(el);
      snapshotSize = { width: el.style.width, height: el.style.height };
      const startW = el.offsetWidth;
      const startH = el.offsetHeight;

      bubbleEl = document.createElement("div");
      bubbleEl.className = "__ed-bubble";
      bubbleEl.innerHTML = `
        <h4>Размер на секцията</h4>
        <div class="__ed-row">
          <label>Ширина</label>
          <input type="range" min="40" max="100" step="1" value="100" data-ed-w />
          <div class="__ed-val" data-ed-w-val>100%</div>
        </div>
        <div class="__ed-row">
          <label>Височина</label>
          <input type="range" min="${Math.max(60, Math.round(startH * 0.4))}" max="${Math.max(900, Math.round(startH * 2))}" step="4" value="${startH}" data-ed-h />
          <div class="__ed-val" data-ed-h-val>${startH}px</div>
        </div>
        <div class="__ed-actions">
          <button class="__ed-cancel" data-ed-cancel>Откажи</button>
          <button class="__ed-apply" data-ed-apply>✓ Готово</button>
        </div>
      `;
      document.body.appendChild(bubbleEl);
      // позициониране до секцията
      const r = el.getBoundingClientRect();
      const bw = bubbleEl.offsetWidth;
      const left = Math.min(window.innerWidth - bw - 8, Math.max(8, r.left)) + window.scrollX;
      const top = Math.max(8, r.bottom + 8) + window.scrollY;
      bubbleEl.style.left = left + "px";
      bubbleEl.style.top = top + "px";

      const wInput = bubbleEl.querySelector<HTMLInputElement>("[data-ed-w]")!;
      const hInput = bubbleEl.querySelector<HTMLInputElement>("[data-ed-h]")!;
      const wVal = bubbleEl.querySelector<HTMLElement>("[data-ed-w-val]")!;
      const hVal = bubbleEl.querySelector<HTMLElement>("[data-ed-h-val]")!;

      wInput.addEventListener("input", () => {
        el.style.width = wInput.value + "%";
        el.style.marginLeft = "auto";
        el.style.marginRight = "auto";
        wVal.textContent = wInput.value + "%";
      });
      hInput.addEventListener("input", () => {
        el.style.height = hInput.value + "px";
        hVal.textContent = hInput.value + "px";
      });
      bubbleEl.querySelector("[data-ed-cancel]")!.addEventListener("click", (e) => {
        e.stopPropagation();
        if (snapshotSize) {
          el.style.width = snapshotSize.width;
          el.style.height = snapshotSize.height;
        }
        clearActive();
      });
      bubbleEl.querySelector("[data-ed-apply]")!.addEventListener("click", (e) => {
        e.stopPropagation();
        setBanner('Размерът е приложен. Натисни „Запази" в горния банер за финален запис.');
        setTimeout(() => setBanner(null), 2200);
        clearActive();
        // уведоми редактора че има промяна
        window.parent?.postMessage({ type: "page-editor:dirty" }, "*");
      });
    }

    // ---------------- 3. Дизайн ----------------
    function startDesign() {
      if (!activeEl) return;
      closeAllPopups();
      mode = "design";
      const el = activeEl;
      snapshotVariant =
        ALL_VARIANT_CLASSES.find((c) => el.classList.contains(c)) || null;
      let selectedCls: string | null = snapshotVariant;

      galleryEl = document.createElement("div");
      galleryEl.className = "__ed-gallery";
      galleryEl.innerHTML = `
        <div class="__ed-gh">
          <h4>Дизайн варианти (12)</h4>
          <div style="font-size:11px;opacity:.7">Цъкни вариант за preview • Приложи за фиксиране</div>
        </div>
        <div class="__ed-grid"></div>
        <div class="__ed-actions">
          <button class="__ed-cancel" data-ed-cancel>Откажи</button>
          <button class="__ed-apply" data-ed-apply>✓ Приложи</button>
        </div>
      `;
      document.body.appendChild(galleryEl);
      const grid = galleryEl.querySelector<HTMLElement>(".__ed-grid")!;

      function paintSelection() {
        grid.querySelectorAll<HTMLElement>(".__ed-card").forEach((c) => {
          c.classList.toggle(
            "__ed-selected",
            c.getAttribute("data-cls") === selectedCls,
          );
        });
      }

      // "няма стил" опция
      const none = document.createElement("div");
      none.className = "__ed-card" + (selectedCls === null ? " __ed-selected" : "");
      none.setAttribute("data-cls", "");
      none.textContent = "— Оригинал —";
      none.addEventListener("click", () => {
        el.classList.remove(...ALL_VARIANT_CLASSES);
        selectedCls = null;
        paintSelection();
      });
      grid.appendChild(none);

      for (const v of VARIANTS) {
        const card = document.createElement("div");
        card.className = "__ed-card" + (selectedCls === v.cls ? " __ed-selected" : "");
        card.setAttribute("data-cls", v.cls);
        card.textContent = v.label;
        card.addEventListener("click", () => {
          el.classList.remove(...ALL_VARIANT_CLASSES);
          el.classList.add(v.cls);
          selectedCls = v.cls;
          paintSelection();
        });
        grid.appendChild(card);
      }

      galleryEl.querySelector("[data-ed-cancel]")!.addEventListener("click", (e) => {
        e.stopPropagation();
        el.classList.remove(...ALL_VARIANT_CLASSES);
        if (snapshotVariant) el.classList.add(snapshotVariant);
        clearActive();
      });
      galleryEl.querySelector("[data-ed-apply]")!.addEventListener("click", (e) => {
        e.stopPropagation();
        setBanner('Дизайнът е приложен локално. Натисни „Запази" в горния банер за финален запис.');
        setTimeout(() => setBanner(null), 2200);
        clearActive();
        window.parent?.postMessage({ type: "page-editor:dirty" }, "*");
      });
    }

    // ---------------- глобални събития ----------------
    function onDblClick(e: MouseEvent) {
      const target = (e.target as HTMLElement)?.closest<HTMLElement>(
        "[data-section-id]",
      );
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      if (mode === "move") return; // mid-move dblclick = ignore
      showMenu(target, e.clientX, e.clientY);
    }

    function onClick(e: MouseEvent) {
      // ако сме в режим move → клик пуска секцията
      if (mode === "move") {
        e.preventDefault();
        e.stopPropagation();
        reposition(e.clientY);
        dropMove();
        return;
      }
      // ако кликнем извън меню/балон/галерия → затвори
      const t = e.target as HTMLElement;
      if (
        activeEl &&
        !t.closest(".__ed-menu") &&
        !t.closest(".__ed-bubble") &&
        !t.closest(".__ed-gallery") &&
        !t.closest("[data-section-id].__ed-active")
      ) {
        clearActive();
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (mode === "move") reposition(e.clientY);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && activeEl) clearActive();
    }

    // touch — двоен тап
    let lastTapAt = 0;
    let lastTapY = 0;
    let lastTapX = 0;

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;
      if (mode === "move") {
        e.preventDefault();
        reposition(t.clientY);
        dropMove();
        lastTapAt = 0;
        return;
      }
      const now = Date.now();
      const dt = now - lastTapAt;
      const dy = Math.abs(t.clientY - lastTapY);
      const dx = Math.abs(t.clientX - lastTapX);
      if (dt < 400 && dy < 40 && dx < 40) {
        const target = (e.target as HTMLElement)?.closest<HTMLElement>(
          "[data-section-id]",
        );
        if (target) {
          e.preventDefault();
          showMenu(target, t.clientX, t.clientY);
          lastTapAt = 0;
          return;
        }
      }
      lastTapAt = now;
      lastTapY = t.clientY;
      lastTapX = t.clientX;
    }

    function onTouchMove(e: TouchEvent) {
      if (mode !== "move") return;
      e.preventDefault();
      const t = e.touches[0];
      if (t) reposition(t.clientY);
    }

    document.addEventListener("dblclick", onDblClick, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("touchstart", onTouchStart, { capture: true, passive: false });
    document.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });

    window.parent?.postMessage({ type: "page-editor:ready" }, "*");

    return () => {
      document.removeEventListener("dblclick", onDblClick, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("touchmove", onTouchMove, true);
      style.remove();
      banner.remove();
      closeAllPopups();
    };
  }, []);

  return null;
}
