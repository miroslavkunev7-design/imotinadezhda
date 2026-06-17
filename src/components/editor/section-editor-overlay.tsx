import { useEffect } from "react";

/**
 * Page editor overlay.
 * Активира се САМО когато URL съдържа `?__editor=1` (т.е. вътре в iframe-а
 * на /admin/settings/page-editor). Прави всяка секция с `data-section-id`
 * избираема с двойно цъкване — после следва мишката (мести вертикално
 * между другите секции), на втори клик я пуска и изпраща новия ред към
 * родителския прозорец.
 */
export function SectionEditorOverlay() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("__editor") !== "1") return;

    // ----- стил за маркиране -----
    const style = document.createElement("style");
    style.setAttribute("data-editor-overlay", "true");
    style.textContent = `
      [data-section-id] { outline: 2px dashed transparent; outline-offset: -2px; transition: outline-color .15s; cursor: pointer; }
      [data-section-id]:hover { outline-color: rgba(245, 196, 110, .55); }
      [data-section-id].__editor-picked {
        outline: 3px solid #f5c46e !important;
        box-shadow: 0 12px 40px rgba(245,196,110,.35), 0 0 0 9999px rgba(20,4,8,.35);
        position: relative;
        z-index: 50;
        pointer-events: none;
        opacity: .92;
      }
      .__editor-banner {
        position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
        z-index: 99999; background: linear-gradient(90deg,#4f0314,#260108);
        color: #f4d07d; border: 1px solid rgba(245,196,110,.5);
        padding: 8px 14px; border-radius: 999px;
        font: 600 12px/1 ui-sans-serif, system-ui;
        box-shadow: 0 8px 24px rgba(0,0,0,.4);
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);

    const banner = document.createElement("div");
    banner.className = "__editor-banner";
    banner.textContent = "Двойно цъкни секция, за да я избереш";
    document.body.appendChild(banner);

    let picked: HTMLElement | null = null;
    let pickedRect: DOMRect | null = null;
    let pointerOffsetY = 0;

    function getSections(): HTMLElement[] {
      return Array.from(
        document.querySelectorAll<HTMLElement>("[data-section-id]"),
      ).filter((el) => !el.closest("[data-editor-skip]"));
    }

    function sendOrder() {
      const order = getSections()
        .map((el) => el.getAttribute("data-section-id") || "")
        .filter(Boolean);
      window.parent?.postMessage(
        { type: "page-editor:reorder", order },
        "*",
      );
    }

    function pickup(target: HTMLElement) {
      if (picked) drop();
      picked = target;
      pickedRect = target.getBoundingClientRect();
      target.classList.add("__editor-picked");
      banner.textContent = "Местиш… Цъкни веднъж за да пуснеш. Esc = отказ.";
      document.body.style.userSelect = "none";
    }

    function drop() {
      if (!picked) return;
      picked.classList.remove("__editor-picked");
      picked.style.transform = "";
      picked.style.transition = "";
      picked = null;
      pickedRect = null;
      banner.textContent = "Двойно цъкни секция, за да я избереш";
      document.body.style.userSelect = "";
      sendOrder();
    }

    function cancel() {
      // Просто отказ на местенето на ТЕКУЩАТА секция — DOM преструктурата
      // вече е извършена в реално време, така че за пълен revert
      // потребителят натиска „Откажи" в редактора (което презарежда iframe).
      drop();
    }

    function onDblClick(e: MouseEvent) {
      const target = (e.target as HTMLElement)?.closest<HTMLElement>(
        "[data-section-id]",
      );
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      pickup(target);
      const r = target.getBoundingClientRect();
      pointerOffsetY = e.clientY - r.top;
    }

    function onPointerMove(e: PointerEvent) {
      if (!picked) return;
      const y = e.clientY;
      // Визуално следване
      const r = picked.getBoundingClientRect();
      // Преместване между съседи: намери секцията под/над курсора и
      // вмъкни преди/след нея.
      const all = getSections();
      for (const other of all) {
        if (other === picked) continue;
        const or = other.getBoundingClientRect();
        const mid = or.top + or.height / 2;
        if (y < mid && picked.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_PRECEDING === 0) {
          // курсорът е над средата на 'other' и 'other' е след 'picked' → вмъкни преди other
          other.parentNode?.insertBefore(picked, other);
          break;
        }
        if (y > mid && (picked.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING)) {
          // курсорът е под средата на 'other' и 'other' е преди 'picked' → вмъкни след other
          other.parentNode?.insertBefore(picked, other.nextSibling);
          break;
        }
      }
    }

    function onClick(e: MouseEvent) {
      if (!picked) return;
      e.preventDefault();
      e.stopPropagation();
      drop();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && picked) {
        cancel();
      }
    }

    document.addEventListener("dblclick", onDblClick, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);

    // Кажи на родителя че сме готови
    window.parent?.postMessage({ type: "page-editor:ready" }, "*");

    return () => {
      document.removeEventListener("dblclick", onDblClick, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      style.remove();
      banner.remove();
    };
  }, []);

  return null;
}
