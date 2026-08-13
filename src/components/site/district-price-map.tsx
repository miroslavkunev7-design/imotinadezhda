import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { geocodePlace } from "@/lib/catalog.functions";
import { CITY_MAP_CENTER } from "@/lib/nominatim";

export type DistrictMapListing = {
  id: string;
  title: string;
  price: number;
  currency?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type QuarterLabel = { name: string };

type Props = {
  quarterName: string;
  cityName: string;
  citySlug: string;
  cityLat?: number | null;
  cityLng?: number | null;
  listings: DistrictMapListing[];
  quarters?: QuarterLabel[];
};

const MIN_ZOOM = 12;
const MAX_ZOOM = 15;
const DEFAULT_ZOOM = 14;
const QUARTER_LABEL_MAX_ZOOM = 13.4;

function compactPrice(price: number, currency?: string | null) {
  const sym = currency === "BGN" ? "лв" : "€";
  if (!Number.isFinite(price)) return sym;
  if (price >= 10_000) return `${sym}${Math.round(price / 1000)}k`;
  return `${sym}${Math.round(price).toLocaleString("bg-BG")}`;
}

function pinOffset(id: string, index: number) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const angle = ((h >>> 0) % 360) * (Math.PI / 180) + index * 0.55;
  const radius = 0.00115 + ((h >>> 8) % 900) / 1_000_000;
  return {
    lat: Math.cos(angle) * radius,
    lng: Math.sin(angle) * radius * 1.35,
  };
}

function hasCoords(lat?: number | null, lng?: number | null) {
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
}

export function DistrictPriceMap({
  quarterName,
  cityName,
  citySlug,
  cityLat,
  cityLng,
  listings,
  quarters = [],
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const geocode = useServerFn(geocodePlace);
  const listingKey = listings.map((l) => `${l.id}:${l.lat}:${l.lng}:${l.address ?? ""}:${l.price}`).join("|");
  const quarterKey = quarters.map((q) => q.name).join("|");

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    const fallback =
      hasCoords(cityLat, cityLng)
        ? { lat: cityLat as number, lng: cityLng as number }
        : (CITY_MAP_CENTER[citySlug] ?? CITY_MAP_CENTER.shumen);

    (async () => {
      const leafletMod = await import("leaflet");
      const L = leafletMod.default ?? leafletMod;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !hostRef.current) return;

      const lookedUp = await geocode({ data: { query: `${quarterName}, ${cityName}, България` } }).catch(() => null);
      if (cancelled || !hostRef.current) return;
      const center = lookedUp ?? fallback;

      map = L.map(hostRef.current, {
        center: [center.lat, center.lng],
        zoom: DEFAULT_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png", {
        maxZoom: MAX_ZOOM,
        subdomains: "abcd",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);

      const markers = [];
      for (let index = 0; index < listings.length; index++) {
        const listing = listings[index];
        let lat = listing.lat;
        let lng = listing.lng;
        if (!hasCoords(lat, lng) && listing.address?.trim()) {
          const hit = await geocode({
            data: { query: `${listing.address.trim()}, ${cityName}, България` },
          }).catch(() => null);
          if (hit) {
            lat = hit.lat;
            lng = hit.lng;
          }
        }
        if (!hasCoords(lat, lng)) {
          const off = pinOffset(listing.id, index);
          lat = center.lat + off.lat;
          lng = center.lng + off.lng;
        }
        const label = compactPrice(listing.price, listing.currency);
        const icon = L.divIcon({
          className: "nadezhda-price-pin-wrap",
          html: `<span class="nadezhda-price-pin">${escapeHtml(label)}</span>`,
          iconSize: [72, 32],
          iconAnchor: [12, 32],
        });
        const marker = L.marker([lat as number, lng as number], {
          icon,
          title: `${listing.title} — ${label}`,
          riseOnHover: true,
          keyboard: true,
        });
        const openListing = () => {
          navigate({ to: "/properties/$propertyId", params: { propertyId: listing.id } });
        };
        marker.on("click", openListing);
        marker.addTo(map!);
        marker.getElement()?.querySelector(".nadezhda-price-pin")?.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openListing();
        });
        markers.push(marker);
      }

      if (markers.length > 1) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.35), { maxZoom: MAX_ZOOM, animate: false });
      }
      requestAnimationFrame(() => map?.invalidateSize());

      const names = quarters.length ? quarters.map((q) => q.name) : [quarterName];
      const quarterMarkers: import("leaflet").Marker[] = [];
      for (const name of names) {
        if (cancelled || !map) return;
        const pos =
          name === quarterName
            ? center
            : ((await geocode({ data: { query: `${name}, ${cityName}, България` } }).catch(() => null)) ?? null);
        if (!pos) continue;
        const marker = L.marker([pos.lat, pos.lng], {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "nadezhda-quarter-label-wrap",
            html: `<span class="nadezhda-quarter-label">${escapeHtml(name)}</span>`,
            iconSize: [120, 28],
            iconAnchor: [60, 14],
          }),
        }).addTo(map);
        quarterMarkers.push(marker);
      }

      const syncQuarterLabels = () => {
        const show = (map?.getZoom() ?? DEFAULT_ZOOM) <= QUARTER_LABEL_MAX_ZOOM;
        quarterMarkers.forEach((m) => {
          const node = m.getElement();
          if (node) node.style.opacity = show ? "1" : "0";
        });
      };
      map.on("zoomend", syncQuarterLabels);
      syncQuarterLabels();
    })();

    return () => {
      cancelled = true;
      map?.remove();
      map = null;
    };
  }, [cityLat, cityLng, cityName, citySlug, geocode, listingKey, listings, navigate, quarterKey, quarterName, quarters]);

  return (
    <div className="overflow-hidden rounded-3xl border border-[#c59441] bg-[#e8e4dc] shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b border-[#eaddc4] bg-[#fdfaf5] px-4 py-3">
        <div>
          <p className="font-serif-nadezhda text-lg font-bold text-[#600f1c]">Имоти на картата — {quarterName}</p>
          <p className="text-xs text-[#3a1418]/70">Само имена на квартали. Цената отваря обявата.</p>
        </div>
        <span className="rounded-full bg-[#8B1A2B] px-3 py-1 text-xs font-semibold text-white">
          {listings.length} обяви
        </span>
      </div>
      <div ref={hostRef} className="h-[420px] w-full md:h-[520px]" />
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
