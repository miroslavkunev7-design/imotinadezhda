import { ImagePlus, Trash2, Upload } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";

import { CrmModalShell } from "./CrmModalShell";
import type { ImotiDeal, ImotiProperty } from "./imoti-types";

const MAX_PHOTOS = 50;

const TYPE_OPTIONS = ["Апартамент", "Къща", "Вила", "Мезонет", "Офис", "Гараж", "Парцел"];
const CITY_OPTIONS = ["София", "Пловдив", "Варна", "Бургас", "Стара Загора", "Русе"];

type FormState = {
  deal: ImotiDeal;
  typeLabel: string;
  title: string;
  city: string;
  quarter: string;
  price: string;
  areaSqm: string;
  rooms: string;
  baths: string;
  floor: string;
  year: string;
  condition: string;
  parking: string;
  heating: string;
  construction: string;
  exposure: string;
  furnishing: string;
  descriptionPublic: string;
  descriptionOwner: string;
};

const EMPTY: FormState = {
  deal: "sale",
  typeLabel: "Апартамент",
  title: "",
  city: "София",
  quarter: "",
  price: "",
  areaSqm: "",
  rooms: "2",
  baths: "1",
  floor: "1/1",
  year: String(new Date().getFullYear()),
  condition: "Добро",
  parking: "Няма",
  heating: "Климатик",
  construction: "Тухла",
  exposure: "Юг",
  furnishing: "Необзаведен",
  descriptionPublic: "",
  descriptionOwner: "",
};

export function ImotiUploadModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (property: ImotiProperty) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setPhotos([]);
    setError(null);
    setExpanded(true);
  }, [open]);

  const set =
    (key: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  const onPickPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      setError(`Максимум ${MAX_PHOTOS} снимки.`);
      return;
    }
    const slice = Array.from(files).slice(0, remaining);
    const urls = slice.map((f) => URL.createObjectURL(f));
    setPhotos((prev) => [...prev, ...urls]);
    setError(null);
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      if (removed?.startsWith("blob:")) URL.revokeObjectURL(removed);
      return next;
    });
  };

  const submit = () => {
    if (!form.title.trim()) {
      setError("Въведи заглавие.");
      return;
    }
    if (!form.quarter.trim()) {
      setError("Въведи квартал.");
      return;
    }
    const price = Number(form.price);
    const area = Number(form.areaSqm);
    if (!price || Number.isNaN(price)) {
      setError("Въведи валидна цена.");
      return;
    }
    if (!area || Number.isNaN(area)) {
      setError("Въведи валидна площ.");
      return;
    }
    if (!photos.length) {
      setError("Качи поне 1 снимка.");
      return;
    }
    if (!form.descriptionPublic.trim()) {
      setError("Описание за сайт е задължително.");
      return;
    }

    const property: ImotiProperty = {
      id: `local-${Date.now()}`,
      title: form.title.trim(),
      deal: form.deal,
      typeLabel: form.typeLabel,
      city: form.city,
      quarter: form.quarter.trim(),
      price,
      currency: "EUR",
      priceSuffix: form.deal === "rent" ? "/ месец" : undefined,
      areaSqm: area,
      rooms: Number(form.rooms) || 1,
      baths: Number(form.baths) || 1,
      floor: form.floor.trim() || "1/1",
      year: Number(form.year) || new Date().getFullYear(),
      condition: form.condition,
      coverUrl: photos[0],
      gallery: photos,
      description: form.descriptionPublic.trim(),
      descriptionOwner: form.descriptionOwner.trim() || undefined,
      createdAt: Date.now(),
      features: [
        { label: "Тип", value: form.typeLabel },
        { label: "Площ", value: `${area} m²` },
        { label: "Стаи", value: form.rooms },
        { label: "Бани", value: form.baths },
        { label: "Етаж", value: form.floor },
        { label: "Година", value: form.year },
        { label: "Паркинг", value: form.parking },
        { label: "Отопление", value: form.heating },
        { label: "Строителство", value: form.construction },
        { label: "Състояние", value: form.condition },
        { label: "Изложение", value: form.exposure },
        { label: "Обзавеждане", value: form.furnishing },
      ],
    };
    onSave(property);
    onClose();
  };

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
          <h2>Качване на имот</h2>
          <p>До {MAX_PHOTOS} снимки · описание за сайт и лично за собственик</p>
        </div>

        <div className="crm-imoti-upload__grid">
          <label className="crm-imoti-field">
            Сделка
            <select value={form.deal} onChange={set("deal")}>
              <option value="sale">Продажба</option>
              <option value="rent">Наем</option>
            </select>
          </label>
          <label className="crm-imoti-field">
            Тип имот
            <select value={form.typeLabel} onChange={set("typeLabel")}>
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-imoti-field crm-imoti-field--wide">
            Заглавие
            <input value={form.title} onChange={set("title")} placeholder="напр. Луксозен апартамент…" />
          </label>
          <label className="crm-imoti-field">
            Град
            <select value={form.city} onChange={set("city")}>
              {CITY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-imoti-field">
            Квартал
            <input value={form.quarter} onChange={set("quarter")} placeholder="Център" />
          </label>
          <label className="crm-imoti-field">
            Цена €
            <input type="number" value={form.price} onChange={set("price")} placeholder="320000" />
          </label>
          <label className="crm-imoti-field">
            Площ m²
            <input type="number" value={form.areaSqm} onChange={set("areaSqm")} placeholder="120" />
          </label>
          <label className="crm-imoti-field">
            Стаи
            <input type="number" value={form.rooms} onChange={set("rooms")} />
          </label>
          <label className="crm-imoti-field">
            Бани
            <input type="number" value={form.baths} onChange={set("baths")} />
          </label>
          <label className="crm-imoti-field">
            Етаж
            <input value={form.floor} onChange={set("floor")} placeholder="4/6" />
          </label>
          <label className="crm-imoti-field">
            Година
            <input type="number" value={form.year} onChange={set("year")} />
          </label>
          <label className="crm-imoti-field">
            Състояние
            <input value={form.condition} onChange={set("condition")} />
          </label>
          <label className="crm-imoti-field">
            Паркинг
            <input value={form.parking} onChange={set("parking")} />
          </label>
          <label className="crm-imoti-field">
            Отопление
            <input value={form.heating} onChange={set("heating")} />
          </label>
          <label className="crm-imoti-field">
            Строителство
            <input value={form.construction} onChange={set("construction")} />
          </label>
          <label className="crm-imoti-field">
            Изложение
            <input value={form.exposure} onChange={set("exposure")} />
          </label>
          <label className="crm-imoti-field">
            Обзавеждане
            <input value={form.furnishing} onChange={set("furnishing")} />
          </label>
        </div>

        <label className="crm-imoti-field crm-imoti-field--block">
          Описание за сайт (публично)
          <textarea
            rows={4}
            value={form.descriptionPublic}
            onChange={set("descriptionPublic")}
            placeholder="Текстът се вижда в таб Основна информация…"
          />
        </label>
        <label className="crm-imoti-field crm-imoti-field--block">
          Лично описание (собственик — поверително)
          <textarea
            rows={3}
            value={form.descriptionOwner}
            onChange={set("descriptionOwner")}
            placeholder="Отива директно в таб Собственик…"
          />
        </label>

        <div className="crm-imoti-upload__photos">
          <div className="crm-imoti-upload__photos-head">
            <strong>
              <ImagePlus size={16} /> Снимки · {photos.length}/{MAX_PHOTOS}
            </strong>
            <label className="crm-imoti-primary crm-imoti-primary--file">
              <Upload size={14} /> Качи файлове
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  onPickPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {photos.length ? (
            <div className="crm-imoti-upload__thumbs">
              {photos.map((src, i) => (
                <div key={`${src}-${i}`} className="crm-imoti-upload__thumb">
                  <img src={src} alt="" />
                  <button type="button" aria-label="Премахни" onClick={() => removePhoto(i)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="crm-imoti-upload__hint">Плъзни или качи до {MAX_PHOTOS} изображения.</p>
          )}
        </div>

        {error ? <p className="crm-imoti-upload__error">{error}</p> : null}

        <div className="crm-imoti-upload__actions">
          <button type="button" className="crm-imoti-ghost" onClick={onClose}>
            Отказ
          </button>
          <button type="button" className="crm-imoti-primary" onClick={submit}>
            Запази имот
          </button>
        </div>
      </div>
    </CrmModalShell>
  );
}
