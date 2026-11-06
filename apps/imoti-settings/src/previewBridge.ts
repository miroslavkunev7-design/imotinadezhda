/** Shared apply / highlight payload for Electron BrowserView inject and iframe walkthrough. */

export type PreviewComponentPayload = {
  component_key: string;
  type: string;
  props: Record<string, unknown>;
};

export function buildApplyScript(components: PreviewComponentPayload[], highlightKey?: string | null): string {
  const json = JSON.stringify({ components, highlightKey: highlightKey || null });
  return `(() => {
    const payload = ${json};
    function ensureApi() {
      if (window.__imotiCmsApply) return window.__imotiCmsApply;
      // Fallback injector when cms-overrides.js is not on the page yet
      window.__imotiCmsApply = function(list, highlightKey) {
        const STYLE_ID = "imoti-cms-live-style";
        let style = document.getElementById(STYLE_ID);
        if (!style) {
          style = document.createElement("style");
          style.id = STYLE_ID;
          document.documentElement.appendChild(style);
        }
        const rules = [];
        (list || []).forEach(function(c) {
          if (!c || !c.props) return;
          const p = c.props;
          if (c.type === "color" || (p.cssVar && p.value)) {
            try { document.documentElement.style.setProperty(p.cssVar || "--wine", String(p.value)); } catch (e) {}
          }
          if (p.selector && (c.type === "shape" || p.radius != null)) {
            rules.push(p.selector + "{border-radius:" + (p.radius || "16px") + " !important;}");
          }
          if (p.selector && (c.type === "section_height" || p.height) && c.type !== "size") {
            rules.push(p.selector + "{min-height:" + (p.height || "200px") + " !important;}");
          }
          if (p.selector && c.type === "size") {
            const bits = [];
            if (p.width) bits.push("width:" + p.width);
            if (p.height) bits.push("min-height:" + p.height);
            if (p.padding) bits.push("padding:" + p.padding);
            if (p.scale) bits.push("transform:scale(" + p.scale + ");transform-origin:top left");
            if (bits.length) rules.push(p.selector + "{" + bits.join(";") + " !important;}");
          }
          if (p.selector && (c.type === "image" || c.type === "melt") && p.url) {
            const els = document.querySelectorAll(p.selector);
            for (let i = 0; i < els.length; i++) {
              if (els[i].tagName === "IMG") els[i].src = p.url;
              else {
                els[i].style.backgroundImage = "url(" + JSON.stringify(p.url).slice(1, -1) + ")";
                els[i].style.backgroundSize = (p.fit || "cover");
              }
            }
          }
          if (p.selector && (c.type === "melt" || p.melt)) {
            const intensity = Number(p.intensity != null ? p.intensity : 0.65);
            const els = document.querySelectorAll(p.selector);
            for (let i = 0; i < els.length; i++) {
              els[i].style.opacity = String(Math.max(0.15, Math.min(1, intensity)));
              if (p.mode === "vignette") els[i].style.boxShadow = "inset 0 0 80px rgba(40,0,10," + intensity + ")";
              if (p.blend) els[i].style.mixBlendMode = String(p.blend);
            }
          }
          if (p.selector && c.type === "graphics") {
            rules.push(p.selector + "{color:" + (p.color || "#c9922e") + ";width:" + (p.size || "44px") + ";height:" + (p.size || "44px") + ";}");
          }
        });
        const hl = highlightKey
          ? (list || []).find(function(x) { return x.component_key === highlightKey; })
          : null;
        let outline = "";
        if (hl && hl.props && hl.props.selector) {
          outline = String(hl.props.selector) + "{outline:3px solid #f0d4a0 !important;outline-offset:4px !important;box-shadow:0 0 0 4px rgba(201,146,46,.35)!important;}";
          try {
            const first = document.querySelector(String(hl.props.selector));
            if (first && first.scrollIntoView) first.scrollIntoView({ behavior: "smooth", block: "center" });
          } catch (e) {}
        }
        style.textContent = rules.join("\\n") + "\\n" + outline;
        try { window.dispatchEvent(new CustomEvent("cms-live-apply", { detail: { list, highlightKey } })); } catch (e) {}
      };
      return window.__imotiCmsApply;
    }
    ensureApi()(payload.components, payload.highlightKey);
    try {
      window.postMessage({ source: "imoti-settings", type: "cms-apply", ...payload }, "*");
    } catch (e) {}
    return true;
  })()`;
}

export function postToIframe(
  iframe: HTMLIFrameElement | null,
  components: PreviewComponentPayload[],
  highlightKey?: string | null
) {
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage(
    { source: "imoti-settings", type: "cms-apply", components, highlightKey: highlightKey || null },
    "*"
  );
}
