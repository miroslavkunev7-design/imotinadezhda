/**
 * Renderer — given a block instance, render the live React element.
 * Used both by the builder canvas and the public RenderDesign component.
 */
import type { BlockInstance } from "./blocks";

function splitPipe(s: string | undefined): string[] {
  if (!s) return [];
  return s.split("|").map((x) => x.trim()).filter(Boolean);
}
function splitDouble(s: string | undefined): string[] {
  if (!s) return [];
  return s.split("||").map((x) => x.trim()).filter(Boolean);
}

export function renderBlock(b: BlockInstance): React.ReactNode {
  const p = b.props || {};
  switch (b.type) {
    // ---------- navbars ----------
    case "navbar.simple":
    case "navbar.split":
      return (
        <nav
          style={{ background: p.bg, color: p.fg }}
          className="w-full border-b border-black/10 px-6 py-4"
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6">
            <div className="text-lg font-semibold" style={{ color: p.accent }}>
              {p.brand}
            </div>
            <div className="flex flex-wrap items-center gap-5 text-sm">
              {splitPipe(p.links).map((l) => (
                <span key={l}>{l}</span>
              ))}
              {b.type === "navbar.split" && p.ctaLabel && (
                <button
                  style={{ background: p.accent, color: p.bg }}
                  className="rounded-md px-3 py-1.5 text-sm font-medium"
                >
                  {p.ctaLabel}
                </button>
              )}
            </div>
          </div>
        </nav>
      );
    case "navbar.centered":
    case "navbar.dark":
      return (
        <nav
          style={{ background: p.bg, color: p.fg }}
          className="w-full px-6 py-5"
        >
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3">
            <div className="text-xl font-bold tracking-wider" style={{ color: p.accent }}>
              {p.brand}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-5 text-sm">
              {splitPipe(p.links).map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </div>
        </nav>
      );
    case "navbar.transparent":
      return (
        <nav className="w-full px-6 py-4" style={{ color: p.fg }}>
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="text-lg font-semibold" style={{ color: p.accent }}>
              {p.brand}
            </div>
            <div className="flex gap-5 text-sm">
              {splitPipe(p.links).map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </div>
        </nav>
      );

    // ---------- heroes ----------
    case "hero.center":
      return (
        <section
          style={{
            background: p.bgImage
              ? `linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)), url(${p.bgImage}) center/cover`
              : p.bg,
            color: p.fg,
            minHeight: `${p.height || 600}px`,
          }}
          className="flex w-full items-center justify-center px-6 py-20 text-center"
        >
          <div className="mx-auto max-w-3xl">
            {p.eyebrow && (
              <div className="mb-4 text-sm tracking-[0.3em]" style={{ color: p.accent }}>
                {p.eyebrow}
              </div>
            )}
            <h1 className="text-4xl font-bold leading-tight md:text-6xl">{p.title}</h1>
            {p.subtitle && <p className="mt-4 text-lg opacity-90">{p.subtitle}</p>}
            {p.ctaLabel && (
              <a
                href={p.ctaHref || "#"}
                style={{ background: p.accent, color: p.bg }}
                className="mt-8 inline-block rounded-md px-6 py-3 font-semibold"
              >
                {p.ctaLabel}
              </a>
            )}
          </div>
        </section>
      );
    case "hero.split":
      return (
        <section style={{ background: p.bg, color: p.fg }} className="w-full">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-16 md:grid-cols-2">
            <div className="flex flex-col justify-center">
              <h1 className="text-3xl font-bold md:text-5xl">{p.title}</h1>
              <p className="mt-4 opacity-80">{p.subtitle}</p>
              {p.ctaLabel && (
                <a
                  href={p.ctaHref || "#"}
                  style={{ background: p.accent, color: "#fff" }}
                  className="mt-6 inline-block w-fit rounded-md px-5 py-2.5 font-semibold"
                >
                  {p.ctaLabel}
                </a>
              )}
            </div>
            <div className="overflow-hidden rounded-lg bg-black/5">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-64 w-full items-center justify-center text-sm opacity-50">
                  (снимка)
                </div>
              )}
            </div>
          </div>
        </section>
      );
    case "hero.minimal":
      return (
        <section
          style={{ background: p.bg, color: p.fg }}
          className="flex w-full flex-col items-center px-6 py-24 text-center"
        >
          <h1 className="text-4xl font-bold md:text-6xl">{p.title}</h1>
          <p className="mt-3 opacity-70">{p.subtitle}</p>
        </section>
      );
    case "hero.video":
      return (
        <section
          style={{
            background: `linear-gradient(135deg, ${p.bg}, #000)`,
            color: p.fg,
          }}
          className="flex w-full items-center justify-center px-6 py-24 text-center"
        >
          <div>
            <h1 className="text-4xl font-bold md:text-6xl">{p.title}</h1>
            <p className="mt-3 opacity-80">{p.subtitle}</p>
            {p.ctaLabel && (
              <a
                href={p.ctaHref || "#"}
                style={{ background: p.accent, color: p.bg }}
                className="mt-6 inline-block rounded-md px-6 py-3 font-semibold"
              >
                {p.ctaLabel}
              </a>
            )}
          </div>
        </section>
      );

    // ---------- buttons ----------
    case "button.solid":
    case "button.outline":
    case "button.ghost":
    case "button.gradient":
    case "button.pill":
    case "button.square":
    case "button.icon":
    case "button.large": {
      const isOutline = b.type === "button.outline";
      const isGhost = b.type === "button.ghost";
      const isGradient = b.type === "button.gradient";
      const style: React.CSSProperties = {
        background: isOutline || isGhost
          ? "transparent"
          : isGradient
            ? `linear-gradient(135deg, ${p.bg}, ${shiftColor(p.bg)})`
            : p.bg,
        color: isOutline || isGhost ? p.bg : p.fg,
        border: isOutline ? `2px solid ${p.bg}` : "none",
        borderRadius: `${p.radius ?? 8}px`,
        fontSize: `${p.size ?? 14}px`,
      };
      return (
        <div className="flex w-full justify-center py-6">
          <a
            href={p.href || "#"}
            style={style}
            className="inline-flex items-center gap-2 px-6 py-3 font-semibold transition hover:opacity-90"
          >
            {b.type === "button.icon" && <span>✨</span>}
            {p.label}
          </a>
        </div>
      );
    }

    // ---------- sections ----------
    case "section.text":
      return (
        <section style={{ background: p.bg, color: p.fg }} className="w-full px-6 py-16">
          <div
            className="mx-auto max-w-3xl"
            style={{ textAlign: (p.align as any) || "left" }}
          >
            <h2 className="text-2xl font-bold md:text-4xl">{p.title}</h2>
            <p className="mt-4 whitespace-pre-line opacity-90">{p.body}</p>
          </div>
        </section>
      );
    case "section.features": {
      const feats = [p.f1, p.f2, p.f3].map((f) => splitPipe(f));
      return (
        <section style={{ background: p.bg, color: p.fg }} className="w-full px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-bold md:text-4xl">{p.title}</h2>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
              {feats.map(([title, body], i) => (
                <div key={i} className="rounded-lg border border-black/10 p-6">
                  <div className="text-lg font-semibold" style={{ color: p.accent }}>
                    {title}
                  </div>
                  <div className="mt-2 text-sm opacity-80">{body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }
    case "section.stats": {
      const groups = splitDouble(p.stats).map((g) => splitPipe(g));
      return (
        <section style={{ background: p.bg, color: p.fg }} className="w-full px-6 py-16">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 md:grid-cols-4">
            {groups.map(([num, label], i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold md:text-5xl" style={{ color: p.accent }}>
                  {num}
                </div>
                <div className="mt-1 text-sm opacity-80">{label}</div>
              </div>
            ))}
          </div>
        </section>
      );
    }
    case "section.cta":
      return (
        <section
          style={{ background: p.bg, color: p.fg }}
          className="w-full px-6 py-16 text-center"
        >
          <h2 className="text-2xl font-bold md:text-4xl">{p.title}</h2>
          <p className="mx-auto mt-3 max-w-2xl opacity-90">{p.subtitle}</p>
          {p.ctaLabel && (
            <a
              href={p.ctaHref || "#"}
              style={{ background: p.accent, color: "#fff" }}
              className="mt-6 inline-block rounded-md px-6 py-3 font-semibold"
            >
              {p.ctaLabel}
            </a>
          )}
        </section>
      );

    // ---------- cards ----------
    case "cards.three": {
      const cards = [p.c1, p.c2, p.c3].map((c) => splitPipe(c));
      return (
        <section style={{ background: p.bg, color: p.fg }} className="w-full px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-bold md:text-4xl">{p.title}</h2>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
              {cards.map(([city, desc, price], i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm"
                >
                  <div className="h-40 bg-gradient-to-br from-amber-100 to-amber-50" />
                  <div className="p-4">
                    <div className="text-sm font-bold" style={{ color: p.accent }}>
                      {city}
                    </div>
                    <div className="text-sm opacity-80">{desc}</div>
                    <div className="mt-2 font-semibold">{price}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    // ---------- form ----------
    case "form.contact":
      return (
        <section style={{ background: p.bg, color: p.fg }} className="w-full px-6 py-16">
          <div className="mx-auto max-w-md">
            <h2 className="text-center text-2xl font-bold md:text-3xl">{p.title}</h2>
            <form className="mt-6 flex flex-col gap-3">
              <input
                placeholder="Име"
                className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black"
              />
              <input
                placeholder="Email"
                className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black"
              />
              <textarea
                placeholder="Съобщение"
                rows={4}
                className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black"
              />
              <button
                type="button"
                style={{ background: p.accent, color: "#fff" }}
                className="rounded-md px-4 py-2 font-semibold"
              >
                {p.ctaLabel}
              </button>
            </form>
          </div>
        </section>
      );

    // ---------- gallery ----------
    case "gallery.grid": {
      const imgs = splitDouble(p.images);
      return (
        <section style={{ background: p.bg, color: p.fg }} className="w-full px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-bold md:text-4xl">{p.title}</h2>
            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
              {imgs.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="h-48 w-full rounded-md object-cover"
                />
              ))}
            </div>
          </div>
        </section>
      );
    }

    // ---------- footers ----------
    case "footer.simple":
      return (
        <footer
          style={{ background: p.bg, color: p.fg }}
          className="w-full px-6 py-8 text-center text-sm"
        >
          <div className="font-semibold">{p.brand}</div>
          <div className="mt-1 opacity-70">{p.tagline}</div>
        </footer>
      );
    case "footer.columns": {
      const cols = [p.col1, p.col2, p.col3].map((c) => splitPipe(c));
      return (
        <footer style={{ background: p.bg, color: p.fg }} className="w-full px-6 py-12">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-4">
            <div className="text-lg font-bold" style={{ color: p.accent }}>
              {p.brand}
            </div>
            {cols.map(([title, items], i) => (
              <div key={i}>
                <div className="text-sm font-semibold uppercase tracking-wider" style={{ color: p.accent }}>
                  {title}
                </div>
                <div className="mt-2 text-sm opacity-80">{items}</div>
              </div>
            ))}
          </div>
        </footer>
      );
    }

    default:
      return (
        <div className="border border-dashed border-red-400 bg-red-50 p-4 text-sm text-red-700">
          Неизвестен блок: {b.type}
        </div>
      );
  }
}

function shiftColor(hex: string): string {
  // crude lighten/darken for gradient end
  if (!hex || !hex.startsWith("#") || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = (v: number) => Math.min(255, Math.max(0, v + 30));
  return `#${f(r).toString(16).padStart(2, "0")}${f(g).toString(16).padStart(2, "0")}${f(b).toString(16).padStart(2, "0")}`;
}
