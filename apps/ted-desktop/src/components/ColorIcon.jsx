import React from "react";

// Full-colour icons in the spirit of ChatGPT's coloured action icons (0.1.5, docs/CONTRACT.md §15 „Icons“): the „+“
// menu (every level), the sidebar / phone drawer rows and the account menu. Our own flat SVG art (no emoji font, no
// CDN, no gradients with ids – many copies on one page stay valid), 24×24, drawn to read on the dark wine sidebar
// and on the light sheets alike. Only the art differs from the monochrome Icon.jsx; labels and spacing do not.
const S = { strokeLinecap: "round", strokeLinejoin: "round" };
const folderBack = "M2.5 6.5a2 2 0 0 1 2-2h4.2l2 2h8.8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z";
const folderFront = "M2.5 9.5a1 1 0 0 1 1-1h17a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z";
const GEAR = "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z";

const ART = {
  // „+“ menu
  clip: <>
    <path d="M16.5 7.2l-7.6 7.6a2 2 0 0 0 2.8 2.8l8-8a4 4 0 0 0-5.7-5.7l-8.2 8.2a6 6 0 0 0 8.5 8.5l6-6" fill="none" stroke="#2b74e4" strokeWidth="2.5" {...S} />
    <path d="M16.5 7.2l-7.6 7.6a2 2 0 0 0 2.8 2.8l8-8a4 4 0 0 0-5.7-5.7l-8.2 8.2a6 6 0 0 0 8.5 8.5l6-6" fill="none" stroke="#a9d1ff" strokeWidth=".8" {...S} />
  </>,
  recent: <>
    <path d={folderBack} fill="#f2a516" stroke="#c47f00" strokeWidth=".9" />
    <path d={folderFront} fill="#ffcd4a" />
    <circle cx="17" cy="16.6" r="5" fill="#fff" stroke="#2b74e4" strokeWidth="1.5" />
    <path d="M17 14.2v2.6l1.8 1.1" fill="none" stroke="#2b74e4" strokeWidth="1.5" {...S} />
  </>,
  image: <>
    <rect x="2.5" y="4" width="19" height="16" rx="3" fill="#8fd3ff" stroke="#2b74e4" strokeWidth="1" />
    <circle cx="16.4" cy="8.6" r="2.2" fill="#ffcf33" />
    <path d="M2.5 16.8l5.6-6 4.3 4.6 2.4-2.4 6.7 6.2v.3a3 3 0 0 1-3 2.5H5.5a3 3 0 0 1-3-3z" fill="#34c759" />
    <path d="M12.4 15.4l2.4-2.4 6.7 6.2v.3a3 3 0 0 1-3 2.5h-7.7z" fill="#1f9d48" />
    <path d="M6.2 5.4l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" fill="#ff4fa3" />
  </>,
  bulb: <>
    <path d="M12 2.4a6.6 6.6 0 0 0-4 11.8c.7.5 1.1 1.3 1.1 2.1v.8h5.8v-.8c0-.8.4-1.6 1.1-2.1A6.6 6.6 0 0 0 12 2.4z" fill="#ffd43b" stroke="#e09c00" strokeWidth="1" />
    <path d="M9.1 17.9h5.8v1.5a1.1 1.1 0 0 1-1.1 1.1h-3.6a1.1 1.1 0 0 1-1.1-1.1z" fill="#a3adba" stroke="#6b7684" strokeWidth=".8" />
    <path d="M10.6 21.6h2.8" stroke="#6b7684" strokeWidth="1.3" {...S} />
    <path d="M9.3 6.6a3.6 3.6 0 0 1 2.7-1.2" fill="none" stroke="#fff7c9" strokeWidth="1.5" {...S} />
    <path d="M10.6 16.6v-3.4l1.4 1.1 1.4-1.1v3.4" fill="none" stroke="#c97800" strokeWidth=".9" {...S} />
  </>,
  telescope: <>
    <path d="M3.4 12.7l11.4-5.3 1.9 4.1-11.4 5.3z" fill="#7b61ff" stroke="#4730c4" strokeWidth=".9" {...S} />
    <path d="M14.6 6.6l3.6-1.7 2.6 5.6-3.6 1.7z" fill="#5a42e0" stroke="#3a24b0" strokeWidth=".9" {...S} />
    <path d="M2.4 13.2l1.7-.8 1.4 3.1-1.7.8z" fill="#ffcf33" stroke="#c99a00" strokeWidth=".6" />
    <path d="M10.9 15.2l-3 6M12.4 14.6l2.6 6.6" stroke="#8a5a2b" strokeWidth="1.7" {...S} />
    <circle cx="11.7" cy="14.1" r="1.3" fill="#ffcf33" stroke="#c99a00" strokeWidth=".6" />
    <path d="M19.2 1.8l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" fill="#ffcf33" />
  </>,
  globe: <>
    <circle cx="12" cy="12" r="9.6" fill="#2f80ed" stroke="#1a4fb0" strokeWidth="1" />
    <path d="M6.6 7.3c1.7-.6 2.9.2 3.3 1.5.3 1.1-.6 1.7-1.6 1.9-1.1.2-1.3 1.2-.6 2.1.7.9.2 2.3-1 2.5-1.2.2-2.3-1-2.7-2.7-.5-2.1.6-4.6 2.6-5.3z" fill="#3ddc84" />
    <path d="M14.3 4.9c1.7.4 3.6 2 4.2 3.9.3 1-.6 1.5-1.5 1.1-1-.5-2.1.1-2 1.2.1 1.2-.9 1.7-1.8 1.1-.9-.6-.9-2.1-.3-3.1.5-.9.1-1.8-.6-2.3-.7-.6-.2-2.2 2-1.9z" fill="#3ddc84" />
    <path d="M13.6 15.4c1.2-.3 2.4.3 2.5 1.4.1 1.1-1.1 2.5-2.4 2.7-.9.1-1.3-.8-.9-1.7.3-.8.1-1.3-.2-1.6-.3-.4 0-.7 1-.8z" fill="#3ddc84" />
    <ellipse cx="12" cy="12" rx="4.2" ry="9.6" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth=".8" />
    <path d="M2.4 12h19.2" stroke="#fff" strokeOpacity=".5" strokeWidth=".8" />
  </>,
  more: <>
    <circle cx="7" cy="7" r="3.1" fill="#ff5a4f" />
    <circle cx="17" cy="7" r="3.1" fill="#ffcf33" />
    <circle cx="7" cy="17" r="3.1" fill="#34c759" />
    <circle cx="17" cy="17" r="3.1" fill="#3e8bff" />
  </>,
  folder: <>
    <path d={folderBack} fill="#f2a516" stroke="#c47f00" strokeWidth=".9" />
    <path d={folderFront} fill="#ffcd4a" />
    <path d="M4.5 11h15" stroke="#fff3c4" strokeWidth=".9" strokeOpacity=".9" {...S} />
  </>,
  folderPlus: <>
    <path d={folderBack} fill="#f2a516" stroke="#c47f00" strokeWidth=".9" />
    <path d={folderFront} fill="#ffcd4a" />
    <circle cx="17.2" cy="16.6" r="4.6" fill="#34c759" stroke="#fff" strokeWidth="1.1" />
    <path d="M17.2 14.4v4.4M15 16.6h4.4" stroke="#fff" strokeWidth="1.6" {...S} />
  </>,
  palette: <>
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.7 1.6-1.5 0-.5-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5C21 6.5 17 3 12 3z" fill="#f6dcb0" stroke="#b8862f" strokeWidth="1" />
    <circle cx="7.4" cy="11.2" r="1.7" fill="#ff5a4f" />
    <circle cx="9.8" cy="7" r="1.7" fill="#ffcf33" />
    <circle cx="14.6" cy="6.9" r="1.7" fill="#34c759" />
    <circle cx="17.5" cy="10.5" r="1.5" fill="#3e8bff" />
  </>,
  film: <>
    <rect x="3" y="9.2" width="18" height="11.3" rx="1.8" fill="#2b2f3a" stroke="#14161c" strokeWidth=".8" />
    <path d="M3.2 9.2l17-4.7.8 3-17 4.7z" fill="#fff" stroke="#14161c" strokeWidth=".8" {...S} />
    <path d="M6.6 7.8l2.2 2.6M10.5 6.7l2.2 2.6M14.4 5.6l2.2 2.6" stroke="#14161c" strokeWidth="1.6" />
    <path d="M10.2 13.6v4.6l4-2.3z" fill="#ff4d6d" />
  </>,
  doc: <>
    <path d="M6 2.8h8.2l4.8 4.8V19a2.2 2.2 0 0 1-2.2 2.2H6A2.2 2.2 0 0 1 3.8 19V5A2.2 2.2 0 0 1 6 2.8z" fill="#fff" stroke="#2b74e4" strokeWidth="1.1" />
    <path d="M14.2 2.8v3.6a1.2 1.2 0 0 0 1.2 1.2H19" fill="#cfe3ff" stroke="#2b74e4" strokeWidth="1.1" {...S} />
    <path d="M7.2 11h8.6M7.2 14h8.6M7.2 17h5.6" stroke="#5b9cf7" strokeWidth="1.3" {...S} />
  </>,
  file: <>
    <path d="M6 2.8h8.2l4.8 4.8V19a2.2 2.2 0 0 1-2.2 2.2H6A2.2 2.2 0 0 1 3.8 19V5A2.2 2.2 0 0 1 6 2.8z" fill="#fff" stroke="#8a9bb0" strokeWidth="1.1" />
    <path d="M14.2 2.8v3.6a1.2 1.2 0 0 0 1.2 1.2H19" fill="#e3e9f1" stroke="#8a9bb0" strokeWidth="1.1" {...S} />
    <rect x="6.6" y="12" width="9.4" height="5.8" rx="1.2" fill="#ff8a3d" />
  </>,
  house: <>
    <path d="M4.6 11v8.6a1.1 1.1 0 0 0 1.1 1.1h12.6a1.1 1.1 0 0 0 1.1-1.1V11" fill="#fff4e0" stroke="#b8862f" strokeWidth="1" />
    <path d="M12 4.4l8.3 7.1H3.7z" fill="#ff6b5e" />
    <path d="M2.6 11.7L12 3.6l9.4 8.1" fill="none" stroke="#d93a35" strokeWidth="2.3" {...S} />
    <rect x="10.1" y="14.6" width="3.8" height="6.1" rx=".6" fill="#8a5a2b" />
    <rect x="6.3" y="12.9" width="2.6" height="2.6" rx=".4" fill="#7cc4ff" />
    <rect x="15.1" y="12.9" width="2.6" height="2.6" rx=".4" fill="#7cc4ff" />
  </>,
  bot: <>
    <path d="M12 7V4.4" stroke="#5f6c7b" strokeWidth="1.4" {...S} />
    <circle cx="12" cy="3.6" r="1.6" fill="#ff4d6d" />
    <rect x="4" y="7" width="16" height="12.6" rx="4" fill="#b3c0d1" stroke="#5f6c7b" strokeWidth="1" />
    <rect x="6.3" y="9.5" width="11.4" height="6.2" rx="3" fill="#253041" />
    <circle cx="9.6" cy="12.6" r="1.35" fill="#4ff0ff" />
    <circle cx="14.4" cy="12.6" r="1.35" fill="#4ff0ff" />
    <path d="M2.6 11.6v3.4M21.4 11.6v3.4" stroke="#5f6c7b" strokeWidth="1.8" {...S} />
    <path d="M10 17.7h4" stroke="#5f6c7b" strokeWidth="1.2" {...S} />
  </>,
  plug: <>
    <path d="M9 2.8v4.4M15 2.8v4.4" stroke="#8592a1" strokeWidth="1.9" {...S} />
    <path d="M6.2 7.2h11.6v3.3a5.8 5.8 0 0 1-11.6 0z" fill="#34c759" stroke="#1f9d48" strokeWidth=".9" />
    <path d="M8.2 9.3h3" stroke="#c4f5d3" strokeWidth="1.2" {...S} />
    <path d="M10 15.9h4v2.2h-4z" fill="#1f9d48" />
    <path d="M12 18.1v1.7c0 1.2 1 1.9 2.4 1.9h3.2" fill="none" stroke="#3b4350" strokeWidth="1.7" {...S} />
  </>,
  chat: <>
    <path d="M4.5 4h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H11l-4.5 3.6V17h-2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="#3e8bff" stroke="#2560c4" strokeWidth=".9" {...S} />
    <circle cx="8" cy="10.5" r="1.25" fill="#fff" />
    <circle cx="12" cy="10.5" r="1.25" fill="#fff" />
    <circle cx="16" cy="10.5" r="1.25" fill="#fff" />
  </>,
  back: <>
    <circle cx="12" cy="12" r="9" fill="#ffd77a" stroke="#c9963e" strokeWidth="1" />
    <path d="M13.8 7.5L9.3 12l4.5 4.5" fill="none" stroke="#7a1023" strokeWidth="2.2" {...S} />
  </>,
  // sidebar
  newchat: <>
    <rect x="3" y="4" width="13.6" height="17" rx="2.2" fill="#fff" stroke="#8a9bb0" strokeWidth="1" />
    <path d="M6 9h7.6M6 12.5h5.4M6 16h3.8" stroke="#9fb3c8" strokeWidth="1.2" {...S} />
    <path d="M18.9 3.4l1.7 1.7a1.2 1.2 0 0 1 0 1.7l-8.3 8.3-3.3 1 1-3.3 8.3-8.3a1.2 1.2 0 0 1 1.7 0z" fill="#ffb02e" stroke="#c47f00" strokeWidth=".9" {...S} />
    <path d="M9.4 14.1l-1 3.3 3.3-1z" fill="#ffe0b0" stroke="#c47f00" strokeWidth=".6" {...S} />
    <path d="M17.4 4.9l2.6 2.6" stroke="#ff6b8a" strokeWidth="1.3" />
  </>,
  search: <>
    <circle cx="10.4" cy="10.4" r="6.6" fill="#cde9ff" stroke="#2b74e4" strokeWidth="2.1" />
    <path d="M7.9 8.2a3.2 3.2 0 0 1 2.6-1.3" fill="none" stroke="#fff" strokeWidth="1.6" {...S} />
    <path d="M15.4 15.4l5.2 5.2" stroke="#8a5a2b" strokeWidth="3.1" {...S} />
  </>,
  clock: <>
    <path d="M3.7 6.6a3.1 3.1 0 0 1 4.2-3.4M20.3 6.6a3.1 3.1 0 0 0-4.2-3.4" fill="none" stroke="#c9302c" strokeWidth="2" {...S} />
    <path d="M7.4 20.2l-1.3 1.5M16.6 20.2l1.3 1.5" stroke="#c9302c" strokeWidth="1.7" {...S} />
    <circle cx="12" cy="13.1" r="7.6" fill="#ff5a4f" stroke="#c9302c" strokeWidth="1" />
    <circle cx="12" cy="13.1" r="5.6" fill="#fff" />
    <path d="M12 9.7v3.4l2.4 1.6" fill="none" stroke="#2b2f3a" strokeWidth="1.6" {...S} />
  </>,
  library: <>
    <rect x="3" y="5" width="4.3" height="15" rx="1" fill="#ff5a4f" stroke="#b02a2f" strokeWidth=".8" />
    <rect x="7.7" y="3.5" width="4.3" height="16.5" rx="1" fill="#3e8bff" stroke="#2560c4" strokeWidth=".8" />
    <path d="M13.3 5.6l3.9-1.2 4.4 14.5-3.9 1.2z" fill="#34c759" stroke="#1d8a49" strokeWidth=".8" {...S} />
    <path d="M3 8.5h4.3M3 16.6h4.3M7.7 7h4.3M7.7 16.6h4.3M14.3 8.8l3.8-1.1" stroke="#fff" strokeOpacity=".8" strokeWidth=".9" />
    <path d="M2.4 20.6h19.2" stroke="#b8862f" strokeWidth="1.3" {...S} />
  </>,
  // account menu, drawer
  gear: <>
    <path d={GEAR} fill="#9aa6b6" stroke="#5b6675" strokeWidth="1" {...S} />
    <circle cx="12" cy="12" r="3.3" fill="#ffcf33" stroke="#5b6675" strokeWidth="1" />
  </>,
  help: <>
    <circle cx="12" cy="12" r="9.6" fill="#3e8bff" stroke="#2560c4" strokeWidth="1" />
    <path d="M9.4 9.4a2.7 2.7 0 1 1 3.7 2.5c-.7.3-1.1.9-1.1 1.6v.6" fill="none" stroke="#fff" strokeWidth="2" {...S} />
    <circle cx="12" cy="17.2" r="1.2" fill="#fff" />
  </>,
  monitor: <>
    <rect x="2.5" y="3.5" width="19" height="13" rx="2" fill="#2b3442" stroke="#5f6c7b" strokeWidth="1" />
    <rect x="4.2" y="5.2" width="15.6" height="9.6" rx="1" fill="#6ec1ff" />
    <path d="M4.2 12.6l4.1-3.2 3 2.4 3.5-3.3 5 4.6v.7a1 1 0 0 1-1 1H5.2a1 1 0 0 1-1-1z" fill="#34c759" />
    <path d="M9 20.6h6M12 16.5v4.1" stroke="#5f6c7b" strokeWidth="1.7" {...S} />
  </>,
  logout: <>
    <path d="M4 3.4h9.2a1 1 0 0 1 1 1v15.2a1 1 0 0 1-1 1H4z" fill="#c98a4b" stroke="#8a5a2b" strokeWidth="1" {...S} />
    <circle cx="11.4" cy="12" r="1" fill="#ffd77a" />
    <path d="M14.6 12h7M18.6 8.6L22 12l-3.4 3.4" fill="none" stroke="#e5484d" strokeWidth="2.1" {...S} />
  </>,
  // 0.1.6 „Балонче“: a golden bubble in a wine ring (the bubble at the screen edge) with three chat dots.
  bubble: <>
    <path d="M7.4 18.2L5 22l4.9-2.3z" fill="#7d1530" />
    <circle cx="12" cy="11" r="9.3" fill="#7d1530" />
    <circle cx="12" cy="11" r="7.6" fill="#f6cf6c" stroke="#e0a63a" strokeWidth=".8" />
    <circle cx="9.6" cy="8.4" r="2.4" fill="#fff3c4" />
    <circle cx="8.8" cy="11.6" r="1.05" fill="#7d1530" /><circle cx="12" cy="11.6" r="1.05" fill="#7d1530" /><circle cx="15.2" cy="11.6" r="1.05" fill="#7d1530" />
  </>,
  sliders: <>
    <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" stroke="#a3adba" strokeWidth="1.9" {...S} />
    <circle cx="9" cy="6.5" r="2.5" fill="#ff5a4f" stroke="#fff" strokeWidth="1" />
    <circle cx="15.5" cy="12" r="2.5" fill="#ffcf33" stroke="#fff" strokeWidth="1" />
    <circle cx="7.5" cy="17.5" r="2.5" fill="#3e8bff" stroke="#fff" strokeWidth="1" />
  </>,
};
// The monochrome names of Icon.jsx that have a colour art here (used by the sidebar rows).
export const COLOR_OF = { folder: "folder", clock: "clock", library: "library", plug: "plug", bot: "bot", newchat: "newchat", search: "search", folderPlus: "folderPlus", dots: "more", sliders: "sliders" };

export const COLOR_ICONS = Object.keys(ART);

export default function ColorIcon({ n, cls }) {
  const art = ART[n];
  return (
    <svg className={"ci" + (cls ? " " + cls : "")} viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-ci={art ? n : ""} shapeRendering="geometricPrecision">
      {art || null}
    </svg>
  );
}
