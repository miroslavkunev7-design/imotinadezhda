import {
  Archive,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderOpen,
  ImagePlus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { CrmModalShell } from "./CrmModalShell";
import {
  ingestFolderFiles,
  ingestOpisDocument,
  isImageFile,
  isVideoFile,
  MAX_PHOTOS,
  MAX_VIDEOS,
} from "./folder-ingest";
import {
  AGENCY_PUBLIC_PHONE,
  IMOTI_CONSTRUCTION_OPTIONS,
  IMOTI_TYPE_OPTIONS,
  type ImotiDeal,
  type ImotiListingStatus,
  type ImotiProperty,
} from "./imoti-types";
import {
  buildLocalOfficialDescription,
  extractPhones,
  replacePhonesForPublic,
  resolveCityFromQuarter,
  scrubExactAddress,
} from "./opis-parse";
import { processGalleryForPublish } from "./process-media";

const CITY_OPTIONS = ["Шумен", "София", "Пловдив", "Варна", "Бургас", "Стара Загора", "Русе", ""];

/** Linked portals — empty until Spec connectors land */
const LINKED_PORTALS: Array<{ id: string; label: string }> = [];

type Step = "chooser" | "form";

type FormState = {
  deal: ImotiDeal;
  typeLabel: string;
  title: string;
  city: string;
  quarter: string;
  streetAddress: string;
  blockEntrance: string;
  mapPin: string;
  landmark: string;
  officialPrice: string;
  ownerPrice: string;
  currency: "EUR" | "BGN" | "USD";
  commission: string;
  areaBuilt: string;
  areaClean: string;
  areaTotal: string;
  rooms: string;
  bedrooms: string;
  baths: string;
  floor: string;
  totalFloors: string;
  year: string;
  condition: string;
  parking: string;
  heating: string;
  construction: string;
  exposure: string;
  terraces: string;
  view: string;
  elevator: string;
  basement: string;
  attic: string;
  descriptionPublic: string;
  descriptionOwner: string;
  ownerName: string;
  ownerPhones: string;
  ownerNotes: string;
  exclusive: boolean;
  responsibleBroker: string;
};

const EMPTY: FormState = {
  deal: "sale",
  typeLabel: "двустаен",
  title: "",
  city: "Шумен",
  quarter: "",
  streetAddress: "",
  blockEntrance: "",
  mapPin: "",
  landmark: "",
  officialPrice: "",
  ownerPrice: "",
  currency: "EUR",
  commission: "",
  areaBuilt: "",
  areaClean: "",
  areaTotal: "",
  rooms: "",
  bedrooms: "",
  baths: "",
  floor: "",
  totalFloors: "",
  year: String(new Date().getFullYear()),
  condition: "",
  parking: "",
  heating: "",
  construction: "тухла",
  exposure: "",
  terraces: "",
  view: "",
  elevator: "",
  basement: "",
  attic: "",
  descriptionPublic: "",
  descriptionOwner: "",
  ownerName: "",
  ownerPhones: "",
  ownerNotes: "",
  exclusive: false,
  responsibleBroker: "Мирослав Канев",
};

function roomsFromLabel(label: string | null | undefined): string {
  if (!label) return "";
  const l = label.toLowerCase();
  if (l.includes("гарсон") || l.includes("студио")) return "1";
  if (l.includes("едностаен") || l.includes("1+1")) return "1";
  if (l.includes("двустаен")) return "2";
  if (l.includes("тристаен")) return "3";
  if (l.includes("четиристаен")) return "4";
  if (l.includes("многостаен")) return "5";
  return "";
}

export function ImotiUploadModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (property: ImotiProperty, notice?: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [step, setStep] = useState<Step>("chooser");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [photos, setPhotos] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [scatterOpen, setScatterOpen] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setPhotos([]);
    setVideos([]);
    setError(null);
    setInfo(null);
    setStep("chooser");
    setExpanded(true);
    setAiMenuOpen(false);
    setScatterOpen(false);
    setBusy(false);
  }, [open]);

  const set =
    (key: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value =
        e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
      setForm((f) => ({ ...f, [key]: value as never }));
    };

  const applyParsed = (parsed: NonNullable<Awaited<ReturnType<typeof ingestFolderFiles>>["parsed"]>) => {
    setForm((f) => {
      const city = parsed.city || resolveCityFromQuarter(parsed.quarter, f.city) || f.city;
      const phones = [...new Set([...(f.ownerPhones ? f.ownerPhones.split(/[,;\s]+/) : []), ...parsed.phones].filter(Boolean))];
      return {
        ...f,
        descriptionOwner: parsed.personalDescription || f.descriptionOwner,
        ownerPrice:
          parsed.ownerPrice != null ? String(parsed.ownerPrice) : f.ownerPrice,
        ownerPhones: phones.join(", "),
        areaTotal: parsed.areaSqm != null ? String(parsed.areaSqm) : f.areaTotal,
        areaBuilt: parsed.areaSqm != null && !f.areaBuilt ? String(parsed.areaSqm) : f.areaBuilt,
        floor: parsed.floor ?? f.floor,
        totalFloors:
          parsed.totalFloors != null ? String(parsed.totalFloors) : f.totalFloors,
        typeLabel: parsed.roomsLabel
          ? (IMOTI_TYPE_OPTIONS.find((t) => t === parsed.roomsLabel) ??
            parsed.roomsLabel ??
            f.typeLabel)
          : f.typeLabel,
        rooms: roomsFromLabel(parsed.roomsLabel) || f.rooms,
        construction: (parsed.construction as FormState["construction"]) || f.construction,
        heating: parsed.heating ?? f.heating,
        condition: parsed.condition ?? f.condition,
        city,
        quarter: parsed.quarter ?? f.quarter,
      };
    });
  };

  const onFolderPicked = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const result = await ingestFolderFiles(files);
      const msgs = [...result.messages];
      setForm((f) => ({
        ...f,
        title: f.title || result.folderName,
        officialPrice:
          result.officialPrice != null ? String(result.officialPrice) : f.officialPrice,
        currency: result.currency,
      }));
      if (result.parsed) applyParsed(result.parsed);
      else if (result.opisText) {
        setForm((f) => ({ ...f, descriptionOwner: result.opisText }));
      }

      const imgUrls = result.images.map((f) => URL.createObjectURL(f));
      const vidUrls = result.videos.map((f) => URL.createObjectURL(f));
      setPhotos((prev) => {
        const room = MAX_PHOTOS - prev.length;
        if (imgUrls.length > room && room >= 0) {
          msgs.push(`Приети са ${room} допълнителни снимки (лимит ${MAX_PHOTOS}).`);
        }
        return [...prev, ...imgUrls.slice(0, Math.max(0, room))];
      });
      setVideos((prev) => {
        const room = MAX_VIDEOS - prev.length;
        return [...prev, ...vidUrls.slice(0, Math.max(0, room))];
      });
      setInfo(msgs.length ? msgs.join(" ") : `Папка „${result.folderName}“ е заредена.`);
      setStep("form");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при четене на папката.");
    } finally {
      setBusy(false);
      setAiMenuOpen(false);
    }
  };

  const onDocPicked = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { opisText, parsed } = await ingestOpisDocument(file);
      applyParsed(parsed);
      if (!parsed.personalDescription && opisText) {
        setForm((f) => ({ ...f, descriptionOwner: opisText }));
      }
      setInfo(`Документ „${file.name}“ е анализиран.`);
      setStep("form");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при четене на документа.");
    } finally {
      setBusy(false);
      setAiMenuOpen(false);
    }
  };

  const onPickMedia = (files: FileList | null) => {
    if (!files?.length) return;
    const imgs = Array.from(files).filter(isImageFile);
    const vids = Array.from(files).filter(isVideoFile);
    const msgs: string[] = [];

    setPhotos((prev) => {
      const room = MAX_PHOTOS - prev.length;
      if (room <= 0) {
        msgs.push(`Максимум ${MAX_PHOTOS} снимки.`);
        return prev;
      }
      if (imgs.length > room) msgs.push(`Приети са ${room} от ${imgs.length} снимки (лимит ${MAX_PHOTOS}).`);
      return [...prev, ...imgs.slice(0, room).map((f) => URL.createObjectURL(f))];
    });
    setVideos((prev) => {
      const room = MAX_VIDEOS - prev.length;
      if (room <= 0) {
        if (vids.length) msgs.push(`Максимум ${MAX_VIDEOS} видеа.`);
        return prev;
      }
      if (vids.length > room) msgs.push(`Приети са ${room} от ${vids.length} видеа (лимит ${MAX_VIDEOS}).`);
      return [...prev, ...vids.slice(0, room).map((f) => URL.createObjectURL(f))];
    });
    if (msgs.length) setError(msgs.join(" "));
    else setError(null);
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      if (removed?.startsWith("blob:")) URL.revokeObjectURL(removed);
      return next;
    });
  };

  const movePhoto = (idx: number, dir: -1 | 1) => {
    setPhotos((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(j, 0, item);
      return next;
    });
  };

  const generateAiDescription = () => {
    const area = Number(form.areaTotal || form.areaBuilt || form.areaClean) || null;
    const text = buildLocalOfficialDescription({
      typeLabel: form.typeLabel,
      areaSqm: area,
      floor: form.floor || null,
      city: form.city || null,
      quarter: form.quarter || null,
      personalDescription: form.descriptionOwner,
    });
    const phones = extractPhones(form.descriptionOwner);
    setForm((f) => ({
      ...f,
      descriptionPublic: text,
      ownerPhones: [...new Set([...(f.ownerPhones ? f.ownerPhones.split(/[,;\s]+/) : []), ...phones].filter(Boolean))].join(", "),
    }));
    setInfo(
      `Официалното описание е генерирано. Телефоните са заменени с ${AGENCY_PUBLIC_PHONE}; точен адрес е премахнат.`,
    );
  };

  const buildProperty = async (
    listingStatus: ImotiListingStatus,
  ): Promise<{ property: ImotiProperty; notice?: string } | null> => {
    const area =
      Number(form.areaTotal) || Number(form.areaBuilt) || Number(form.areaClean) || 0;
    const official = Number(form.officialPrice);
    const owner = form.ownerPrice ? Number(form.ownerPrice) : null;

    if (!form.quarter.trim() && listingStatus === "published") {
      setError("Въведи квартал преди публикуване.");
      return null;
    }
    if (listingStatus === "published" && (!official || Number.isNaN(official))) {
      setError("Официалната цена е задължителна за публикуване.");
      return null;
    }
    if (listingStatus === "published" && !form.descriptionPublic.trim()) {
      setError("Официалното описание е задължително за публикуване.");
      return null;
    }
    if (!photos.length && listingStatus === "published") {
      setError("Качи поне 1 снимка преди публикуване.");
      return null;
    }

    setBusy(true);
    try {
      const gallery =
        listingStatus === "published"
          ? await processGalleryForPublish(photos, form.exclusive)
          : photos;

      const pricePerSqm =
        official && area ? Math.round((official / area) * 100) / 100 : null;

      const title =
        form.title.trim() ||
        [form.typeLabel, form.quarter || form.city].filter(Boolean).join(" · ") ||
        "Нов имот";

      const publicDescription = scrubExactAddress(
        replacePhonesForPublic(form.descriptionPublic.trim()),
      );

      const property: ImotiProperty = {
        id: `local-${Date.now()}`,
        title,
        deal: form.deal,
        typeLabel: form.typeLabel,
        city: form.city,
        quarter: form.quarter.trim(),
        price: Number.isFinite(official) ? official : owner && Number.isFinite(owner) ? 0 : 0,
        currency: form.currency,
        priceSuffix: form.deal === "rent" ? "/ месец" : undefined,
        areaSqm: area || 0,
        areaBuiltSqm: form.areaBuilt ? Number(form.areaBuilt) : null,
        areaCleanSqm: form.areaClean ? Number(form.areaClean) : null,
        areaTotalSqm: form.areaTotal ? Number(form.areaTotal) : null,
        rooms: Number(form.rooms) || Number(roomsFromLabel(form.typeLabel)) || 1,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        baths: Number(form.baths) || 1,
        floor: form.floor.trim() || "—",
        totalFloors: form.totalFloors ? Number(form.totalFloors) : null,
        year: Number(form.year) || new Date().getFullYear(),
        condition: form.condition || "—",
        coverUrl: gallery[0] || photos[0] || "/crm-home-locked/catalog-hero.jpg",
        gallery: gallery.length ? gallery : photos,
        videos,
        description: publicDescription,
        descriptionOwner: form.descriptionOwner.trim() || undefined,
        ownerPrice: owner != null && Number.isFinite(owner) ? owner : null,
        commission: form.commission.trim() || undefined,
        exclusive: form.exclusive,
        streetAddress: form.streetAddress.trim() || undefined,
        blockEntrance: form.blockEntrance.trim() || undefined,
        mapPin: form.mapPin.trim() || undefined,
        landmark: form.landmark.trim() || undefined,
        ownerName: form.ownerName.trim() || undefined,
        ownerPhones: form.ownerPhones
          .split(/[,;]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        ownerNotes: form.ownerNotes.trim() || undefined,
        listingStatus,
        responsibleBroker: form.responsibleBroker.trim() || undefined,
        createdAt: Date.now(),
        features: [
          { label: "Тип", value: form.typeLabel },
          { label: "Площ", value: area ? `${area} m²` : "—" },
          { label: "Стаи", value: form.rooms || "—" },
          { label: "Бани", value: form.baths || "—" },
          { label: "Етаж", value: form.floor || "—" },
          { label: "Година", value: form.year },
          { label: "Паркинг", value: form.parking || "—" },
          { label: "Отопление", value: form.heating || "—" },
          { label: "Строителство", value: form.construction },
          { label: "Състояние", value: form.condition || "—" },
          { label: "Изложение", value: form.exposure || "—" },
          ...(pricePerSqm != null
            ? [{ label: "Цена/м²", value: `${pricePerSqm} ${form.currency}` }]
            : []),
          ...(form.exclusive ? [{ label: "Ексклузив", value: "Да" }] : []),
        ],
      };

      const notice =
        listingStatus === "published"
          ? "Имотът е записан в архива и маркиран за публичния сайт (локален преглед — за реален publish е нужен admin вход)."
          : "Имотът е записан само в архива.";

      return { property, notice };
    } finally {
      setBusy(false);
    }
  };

  const submit = async (listingStatus: ImotiListingStatus) => {
    setError(null);
    const built = await buildProperty(listingStatus);
    if (!built) return;
    onSave(built.property, built.notice);
    onClose();
  };

  const pricePerSqmPreview = (() => {
    const p = Number(form.officialPrice);
    const a = Number(form.areaTotal || form.areaBuilt || form.areaClean);
    if (!p || !a) return "";
    return `${Math.round((p / a) * 100) / 100} ${form.currency}`;
  })();

  return (
    <CrmModalShell
      open={open}
      title="Добави имот"
      expanded={expanded}
      onToggleExpand={() => setExpanded((v) => !v)}
      onClose={onClose}
      zIndex={75}
    >
      <div className="crm-imoti-upload">
        <div className="crm-imoti-upload__hero" aria-hidden>
          <div className="crm-imoti-upload__hero-veil" />
          <h2>Добави имот</h2>
          <p>Ръчно или AI качване · папка / опис · архив и публикуване</p>
        </div>

        {step === "chooser" ? (
          <div className="crm-imoti-upload__chooser">
            <button
              type="button"
              className="crm-imoti-upload__chooser-btn"
              onClick={() => setStep("form")}
            >
              <FileText size={22} />
              <strong>Ръчно добавяне</strong>
              <span>Пълна форма с всички графи</span>
            </button>

            <div className="crm-imoti-upload__chooser-ai">
              <button
                type="button"
                className="crm-imoti-upload__chooser-btn crm-imoti-upload__chooser-btn--ai"
                onClick={() => setAiMenuOpen((v) => !v)}
                aria-expanded={aiMenuOpen}
              >
                <Sparkles size={22} />
                <strong>AI качване на имот</strong>
                <span>Папка или документ с опис</span>
                <ChevronDown size={16} className={aiMenuOpen ? "is-open" : undefined} />
              </button>
              {aiMenuOpen ? (
                <div className="crm-imoti-upload__ai-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => folderInputRef.current?.click()}
                    disabled={busy}
                  >
                    <FolderOpen size={16} /> Прикачи папка
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => docInputRef.current?.click()}
                    disabled={busy}
                  >
                    <Upload size={16} /> Прикачи документ
                  </button>
                </div>
              ) : null}
            </div>

          </div>
        ) : (
          <>
            <div className="crm-imoti-upload__top-actions">
              <button type="button" className="crm-imoti-ghost" onClick={() => setStep("chooser")}>
                ← Назад
              </button>
              <button
                type="button"
                className="crm-imoti-ghost"
                onClick={() => folderInputRef.current?.click()}
                disabled={busy}
              >
                <FolderOpen size={14} /> Добави папка
              </button>
              <button
                type="button"
                className="crm-imoti-ghost"
                onClick={() => docInputRef.current?.click()}
                disabled={busy}
              >
                <FileText size={14} /> Добави опис
              </button>
              <button
                type="button"
                className="crm-imoti-primary"
                onClick={generateAiDescription}
                disabled={busy}
              >
                <Sparkles size={14} /> Генерирай AI описание
              </button>
            </div>

            <section className="crm-imoti-upload__section">
              <h3>Основни</h3>
              <div className="crm-imoti-upload__grid">
                <label className="crm-imoti-field">
                  Тип сделка
                  <select value={form.deal} onChange={set("deal")}>
                    <option value="sale">Продава се</option>
                    <option value="rent">Отдава се под наем</option>
                  </select>
                </label>
                <label className="crm-imoti-field">
                  Тип имот
                  <select value={form.typeLabel} onChange={set("typeLabel")}>
                    {IMOTI_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="crm-imoti-field">
                  Вид строителство
                  <select value={form.construction} onChange={set("construction")}>
                    {IMOTI_CONSTRUCTION_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="crm-imoti-field">
                  Състояние
                  <input value={form.condition} onChange={set("condition")} />
                </label>
                <label className="crm-imoti-field">
                  Година на строителство
                  <input type="number" value={form.year} onChange={set("year")} />
                </label>
                <label className="crm-imoti-field crm-imoti-field--wide">
                  Заглавие
                  <input value={form.title} onChange={set("title")} placeholder="Автоматично от папка / тип" />
                </label>
              </div>
            </section>

            <section className="crm-imoti-upload__section">
              <h3>Локация</h3>
              <div className="crm-imoti-upload__grid">
                <label className="crm-imoti-field">
                  Град
                  <select value={form.city} onChange={set("city")}>
                    {CITY_OPTIONS.filter(Boolean).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="">—</option>
                  </select>
                </label>
                <label className="crm-imoti-field">
                  Квартал
                  <input value={form.quarter} onChange={set("quarter")} />
                </label>
              </div>
              <p className="crm-imoti-upload__personal-tag">лично</p>
              <div className="crm-imoti-upload__grid crm-imoti-upload__grid--personal">
                <label className="crm-imoti-field crm-imoti-field--wide">
                  Улица и номер
                  <input value={form.streetAddress} onChange={set("streetAddress")} />
                </label>
                <label className="crm-imoti-field">
                  Блок / вход
                  <input value={form.blockEntrance} onChange={set("blockEntrance")} />
                </label>
                <label className="crm-imoti-field">
                  Точка на картата
                  <input value={form.mapPin} onChange={set("mapPin")} />
                </label>
                <label className="crm-imoti-field">
                  Ориентир
                  <input value={form.landmark} onChange={set("landmark")} />
                </label>
              </div>
            </section>

            <section className="crm-imoti-upload__section">
              <h3>Параметри</h3>
              <div className="crm-imoti-upload__grid">
                <label className="crm-imoti-field">
                  Застроена м²
                  <input type="number" value={form.areaBuilt} onChange={set("areaBuilt")} />
                </label>
                <label className="crm-imoti-field">
                  Чиста м²
                  <input type="number" value={form.areaClean} onChange={set("areaClean")} />
                </label>
                <label className="crm-imoti-field">
                  Обща м²
                  <input type="number" value={form.areaTotal} onChange={set("areaTotal")} />
                </label>
                <label className="crm-imoti-field">
                  Етаж
                  <input value={form.floor} onChange={set("floor")} placeholder="3/5" />
                </label>
                <label className="crm-imoti-field">
                  Общо етажи
                  <input type="number" value={form.totalFloors} onChange={set("totalFloors")} />
                </label>
                <label className="crm-imoti-field">
                  Брой стаи
                  <input type="number" value={form.rooms} onChange={set("rooms")} />
                </label>
                <label className="crm-imoti-field">
                  Спални
                  <input type="number" value={form.bedrooms} onChange={set("bedrooms")} />
                </label>
                <label className="crm-imoti-field">
                  Бани / тоалетни
                  <input type="number" value={form.baths} onChange={set("baths")} />
                </label>
                <label className="crm-imoti-field">
                  Тераси
                  <input value={form.terraces} onChange={set("terraces")} />
                </label>
                <label className="crm-imoti-field">
                  Изложение
                  <input value={form.exposure} onChange={set("exposure")} />
                </label>
                <label className="crm-imoti-field">
                  Гледка
                  <input value={form.view} onChange={set("view")} />
                </label>
                <label className="crm-imoti-field">
                  Отопление
                  <input value={form.heating} onChange={set("heating")} />
                </label>
                <label className="crm-imoti-field">
                  Асансьор
                  <input value={form.elevator} onChange={set("elevator")} />
                </label>
                <label className="crm-imoti-field">
                  Паркинг / гараж
                  <input value={form.parking} onChange={set("parking")} />
                </label>
                <label className="crm-imoti-field">
                  Мазе
                  <input value={form.basement} onChange={set("basement")} />
                </label>
                <label className="crm-imoti-field">
                  Таван
                  <input value={form.attic} onChange={set("attic")} />
                </label>
              </div>
            </section>

            <section className="crm-imoti-upload__section">
              <h3>Цени</h3>
              <div className="crm-imoti-upload__grid">
                <label className="crm-imoti-field">
                  Официална цена (сайт)
                  <input type="number" value={form.officialPrice} onChange={set("officialPrice")} />
                </label>
                <label className="crm-imoti-field">
                  Валута
                  <select value={form.currency} onChange={set("currency")}>
                    <option value="EUR">EUR</option>
                    <option value="BGN">BGN</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
                <label className="crm-imoti-field">
                  Цена на кв.м
                  <input value={pricePerSqmPreview} readOnly placeholder="автоматично" />
                </label>
              </div>
              <p className="crm-imoti-upload__personal-tag">лично</p>
              <div className="crm-imoti-upload__grid crm-imoti-upload__grid--personal">
                <label className="crm-imoti-field">
                  Цена към собственика
                  <input type="number" value={form.ownerPrice} onChange={set("ownerPrice")} />
                </label>
                <label className="crm-imoti-field">
                  Комисионна
                  <input value={form.commission} onChange={set("commission")} />
                </label>
              </div>
            </section>

            <section className="crm-imoti-upload__section">
              <h3>Описания</h3>
              <label className="crm-imoti-field crm-imoti-field--block">
                Официално описание (за сайта)
                <textarea
                  rows={4}
                  value={form.descriptionPublic}
                  onChange={set("descriptionPublic")}
                  placeholder="Генерирай с AI или попълни ръчно…"
                />
              </label>
              <p className="crm-imoti-upload__personal-tag">лично</p>
              <label className="crm-imoti-field crm-imoti-field--block">
                Лично описание (опис, телефони, бележки)
                <textarea
                  rows={4}
                  value={form.descriptionOwner}
                  onChange={set("descriptionOwner")}
                />
              </label>
            </section>

            <section className="crm-imoti-upload__section">
              <h3>
                Собственик <span className="crm-imoti-upload__personal-tag">лично</span>
              </h3>
              <div className="crm-imoti-upload__grid crm-imoti-upload__grid--personal">
                <label className="crm-imoti-field">
                  Име
                  <input value={form.ownerName} onChange={set("ownerName")} />
                </label>
                <label className="crm-imoti-field">
                  Телефони
                  <input
                    value={form.ownerPhones}
                    onChange={set("ownerPhones")}
                    placeholder="0888…, 089…"
                  />
                </label>
                <label className="crm-imoti-field crm-imoti-field--wide">
                  Бележки
                  <input value={form.ownerNotes} onChange={set("ownerNotes")} />
                </label>
                <label className="crm-imoti-field">
                  Отговорен брокер
                  <input value={form.responsibleBroker} onChange={set("responsibleBroker")} />
                </label>
              </div>
            </section>

            <section className="crm-imoti-upload__section">
              <h3>Медия</h3>
              <div className="crm-imoti-upload__photos">
                <div className="crm-imoti-upload__photos-head">
                  <strong>
                    <ImagePlus size={16} /> Снимки · {photos.length}/{MAX_PHOTOS} · видеа{" "}
                    {videos.length}/{MAX_VIDEOS}
                  </strong>
                  <label className="crm-imoti-primary crm-imoti-primary--file">
                    <Upload size={14} /> Качи файлове
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      hidden
                      onChange={(e) => {
                        onPickMedia(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <label className="crm-imoti-upload__exclusive">
                  <input
                    type="checkbox"
                    checked={form.exclusive}
                    onChange={set("exclusive")}
                  />
                  Ексклузив (без замъгляване на прозорци)
                </label>
                {photos.length ? (
                  <div className="crm-imoti-upload__thumbs">
                    {photos.map((src, i) => (
                      <div key={`${src}-${i}`} className="crm-imoti-upload__thumb">
                        <img src={src} alt="" />
                        {i === 0 ? <span className="crm-imoti-upload__cover-badge">Корица</span> : null}
                        <div className="crm-imoti-upload__thumb-actions">
                          <button type="button" aria-label="Нагоре" onClick={() => movePhoto(i, -1)}>
                            <ChevronUp size={12} />
                          </button>
                          <button type="button" aria-label="Надолу" onClick={() => movePhoto(i, 1)}>
                            <ChevronDown size={12} />
                          </button>
                          <button type="button" aria-label="Премахни" onClick={() => removePhoto(i)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="crm-imoti-upload__hint">
                    Първата снимка става фоново изображение на картата. До {MAX_PHOTOS} снимки /{" "}
                    {MAX_VIDEOS} видеа.
                  </p>
                )}
              </div>
            </section>

            {info ? <p className="crm-imoti-upload__info">{info}</p> : null}
            {error ? <p className="crm-imoti-upload__error">{error}</p> : null}

            <div className="crm-imoti-upload__actions crm-imoti-upload__actions--publish">
              <button
                type="button"
                className="crm-imoti-ghost"
                disabled={busy}
                onClick={() => void submit("archive")}
              >
                <Archive size={14} /> В архив
              </button>

              <div className="crm-imoti-upload__scatter">
                <button
                  type="button"
                  className="crm-imoti-ghost"
                  disabled={busy}
                  onClick={() => setScatterOpen((v) => !v)}
                >
                  Разпръсни във всички сайтове
                  <ChevronDown size={14} />
                </button>
                {scatterOpen ? (
                  <div className="crm-imoti-upload__ai-menu" role="menu">
                    {LINKED_PORTALS.length === 0 ? (
                      <p className="crm-imoti-upload__hint">Няма свързани сайтове.</p>
                    ) : (
                      LINKED_PORTALS.map((p) => (
                        <button key={p.id} type="button" role="menuitem">
                          {p.label}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                className="crm-imoti-primary"
                disabled={busy}
                onClick={() => void submit("published")}
              >
                Публикувай на публичния сайт
              </button>
            </div>
          </>
        )}

        {busy ? <p className="crm-imoti-upload__info">Обработва се…</p> : null}
        {step === "chooser" && error ? <p className="crm-imoti-upload__error">{error}</p> : null}
        {step === "chooser" && info ? <p className="crm-imoti-upload__info">{info}</p> : null}

        <input
          ref={folderInputRef}
          type="file"
          hidden
          // @ts-expect-error webkitdirectory is non-standard but supported
          webkitdirectory=""
          directory=""
          multiple
          onChange={(e) => {
            void onFolderPicked(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={docInputRef}
          type="file"
          hidden
          accept=".doc,.docx,.txt,.rtf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => {
            void onDocPicked(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </CrmModalShell>
  );
}
