import {
  Building2,
  Calculator,
  ChevronLeft,
  FileText,
  FolderOpen,
  Landmark,
  Scale,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { calcNotaryFees, money } from "@/lib/mortgage-calc";
import { getLiveRate, monthlyPayment, type IncomeOrigin } from "@/lib/mortgage-rates";

import type { ImotiProperty } from "./imoti-types";

const BANKS: { name: string; color: string; dark?: boolean }[] = [
  { name: "Банка ДСК", color: "#0b3d2e" },
  { name: "ОББ", color: "#0b4fa0" },
  { name: "УниКредит Булбанк", color: "#c11007" },
  { name: "Fibank", color: "#16356e" },
  { name: "Пощенска банка", color: "#f4c500", dark: true },
  { name: "Алианц Банк", color: "#003781" },
  { name: "ЦКБ", color: "#0e7a6d" },
  { name: "TBI Bank", color: "#e07b2a" },
  { name: "Инвестбанк", color: "#1f5fbf" },
];

const TEMPLATES = [
  "Заявление за ипотечен кредит",
  "Декларация за семейно и имотно състояние",
  "Съгласие за ЦКР и GDPR",
  "Декларация ЗМИП",
  "Нотариален акт / предварителен договор за имота",
];

type DetailTab = "board" | "form" | "templates";

export function ImotiBankModal({
  open,
  property,
  onClose,
}: {
  open: boolean;
  property: ImotiProperty | null;
  onClose: () => void;
}) {
  const [bank, setBank] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("board");
  const [origin, setOrigin] = useState<IncomeOrigin>("bg");
  const [years, setYears] = useState("25");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [payment, setPayment] = useState<number | null>(null);
  const [notary, setNotary] = useState<ReturnType<typeof calcNotaryFees> | null>(null);
  const [formNote, setFormNote] = useState("");

  useEffect(() => {
    if (!open || !property) return;
    setBank(null);
    setTab("board");
    setOrigin("bg");
    setYears("25");
    setAmount(String(Math.round(property.price * 0.8)));
    setPrice(String(property.price));
    setPayment(null);
    setNotary(null);
    setFormNote("");
  }, [open, property]);

  const today = useMemo(() => new Date(), []);
  const bankMeta = BANKS.find((b) => b.name === bank) ?? null;
  const liveBg = getLiveRate(bank, "bg", today);
  const liveForeign = getLiveRate(bank, "foreign", today);
  const live = origin === "foreign" ? liveForeign : liveBg;

  if (!open || !property) return null;

  const city = property.city;

  const calcPayment = () => {
    const a = Number(amount);
    const y = Number(years);
    if (!a || !y) return;
    setPayment(monthlyPayment(a, live.rate, y));
  };

  const calcNotary = () => {
    const p = Number(price);
    if (!p) return;
    setNotary(
      calcNotaryFees({
        price: p,
        loanAmount: Number(amount) || undefined,
        currency: "EUR",
        withMortgage: Number(amount) > 0,
      }),
    );
  };

  return (
    <div className="crm-imoti-bank-overlay" role="dialog" aria-modal="true" aria-label="Банка">
      <div className="crm-imoti-bank-modal">
        {!bank ? (
          <>
            <header className="crm-imoti-bank-modal__head">
              <div className="crm-imoti-bank-modal__head-row">
                <div>
                  <strong>
                    <Landmark size={16} /> Банки в {city}
                  </strong>
                  <p>
                    Ипотека за {property.title} · € {property.price.toLocaleString("bg-BG")}
                  </p>
                </div>
                <button type="button" className="crm-imoti-icon-btn" aria-label="Затвори" onClick={onClose}>
                  <X size={16} />
                </button>
              </div>
            </header>
            <div className="crm-imoti-bank-modal__body">
              <p className="crm-imoti-bank-modal__hint">
                Избери банка — лихвата е по обявените ставки за деня. След избор отваряш табло,
                графи и папка с образци.
              </p>
              <div className="crm-imoti-bank-grid">
                {BANKS.map((b) => {
                  const rate = getLiveRate(b.name, "bg", today).rate;
                  return (
                    <button
                      key={b.name}
                      type="button"
                      className="crm-imoti-bank-card"
                      onClick={() => {
                        setBank(b.name);
                        setTab("board");
                        setPayment(null);
                        setNotary(null);
                      }}
                    >
                      <div className="crm-imoti-bank-card__bar">
                        <Building2 size={13} />
                        <span>{b.name}</span>
                      </div>
                      <div
                        className="crm-imoti-bank-card__face"
                        style={{
                          backgroundColor: b.color,
                          color: b.dark ? "#3d2f00" : "#fff",
                        }}
                      >
                        <span className="crm-imoti-bank-card__city">Клон {city}</span>
                        <strong>{b.name}</strong>
                        <em>лихва {rate.toFixed(2)}%</em>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <header className="crm-imoti-bank-modal__head">
              <div className="crm-imoti-bank-modal__head-row">
                <button type="button" className="crm-imoti-ghost" onClick={() => setBank(null)}>
                  <ChevronLeft size={14} /> Банките
                </button>
                <button type="button" className="crm-imoti-icon-btn" aria-label="Затвори" onClick={onClose}>
                  <X size={16} />
                </button>
              </div>
              <div
                className="crm-imoti-bank-banner"
                style={{
                  backgroundColor: bankMeta?.color ?? "#7a1226",
                  color: bankMeta?.dark ? "#3d2f00" : "#fff",
                }}
              >
                <span>Клон {city}</span>
                <strong>{bank}</strong>
                <em>
                  {city} — клон {bank}
                </em>
              </div>
              <div className="crm-imoti-bank-tabs" role="tablist">
                {(
                  [
                    ["board", "Табло", Calculator],
                    ["form", "Графи за ипотечен кредит", FileText],
                    ["templates", "Папка с образци", FolderOpen],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    className={tab === key ? "is-on" : undefined}
                    onClick={() => setTab(key)}
                  >
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>
            </header>

            <div className="crm-imoti-bank-modal__body">
              {tab === "board" ? (
                <div className="crm-imoti-bank-board">
                  <h3>Табло — калкулатор и листчета</h3>
                  <div className="crm-imoti-bank-origin">
                    <button
                      type="button"
                      className={origin === "bg" ? "is-on" : undefined}
                      onClick={() => setOrigin("bg")}
                    >
                      Пълна отг. {liveBg.rate.toFixed(2)}%
                    </button>
                    <button
                      type="button"
                      className={origin === "foreign" ? "is-on" : undefined}
                      onClick={() => setOrigin("foreign")}
                    >
                      Доходи от чужбина {liveForeign.rate.toFixed(2)}%
                    </button>
                  </div>
                  <div className="crm-imoti-bank-fields">
                    <label>
                      Сума (EUR)
                      <input
                        value={amount}
                        inputMode="decimal"
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </label>
                    <label>
                      Срок: {years || "—"} г.
                      <input
                        value={years}
                        inputMode="numeric"
                        onChange={(e) => setYears(e.target.value)}
                      />
                    </label>
                    <label>
                      Цена имот (EUR)
                      <input
                        value={price}
                        inputMode="decimal"
                        onChange={(e) => setPrice(e.target.value)}
                      />
                    </label>
                    <label>
                      Лихва
                      <div className="crm-imoti-bank-rate">{live.rate.toFixed(2)}%</div>
                    </label>
                  </div>
                  <div className="crm-imoti-bank-actions">
                    <button type="button" className="crm-imoti-primary" onClick={calcPayment}>
                      <Calculator size={14} /> Изчисли вноска
                    </button>
                    <button type="button" className="crm-imoti-ghost" onClick={calcNotary}>
                      <Scale size={14} /> Изчисли нотариус
                    </button>
                  </div>
                  {payment !== null ? (
                    <div className="crm-imoti-bank-result crm-imoti-bank-result--ok">
                      Месечна вноска: {money(payment, "EUR")} при {live.rate.toFixed(2)}% за {years}{" "}
                      г.
                    </div>
                  ) : null}
                  {notary ? (
                    <div className="crm-imoti-bank-result">
                      {notary.lines.map((l) => (
                        <div key={l.key} className="crm-imoti-bank-result__row">
                          <span>{l.label}</span>
                          <strong>{money(l.amount, "EUR")}</strong>
                        </div>
                      ))}
                      <div className="crm-imoti-bank-result__row crm-imoti-bank-result__row--total">
                        <span>Общо</span>
                        <strong>{money(notary.total, "EUR")}</strong>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === "form" ? (
                <div className="crm-imoti-bank-board">
                  <h3>Графи за ипотечен кредит — {bank}</h3>
                  <p className="crm-imoti-bank-modal__hint">
                    Демо полета за досие към {property.title}. Данните остават локално в тази сесия.
                  </p>
                  <div className="crm-imoti-bank-fields crm-imoti-bank-fields--stack">
                    <label>
                      Бележка към банката
                      <textarea
                        rows={4}
                        value={formNote}
                        onChange={(e) => setFormNote(e.target.value)}
                        placeholder="Работен доход, работодател, особености…"
                      />
                    </label>
                  </div>
                  <ul className="crm-imoti-bank-docs">
                    <li>Имот: {property.title}</li>
                    <li>
                      Град / квартал: {property.city}, {property.quarter}
                    </li>
                    <li>Цена: € {property.price.toLocaleString("bg-BG")}</li>
                    <li>
                      Кредит (80%): € {Math.round(property.price * 0.8).toLocaleString("bg-BG")}
                    </li>
                  </ul>
                </div>
              ) : null}

              {tab === "templates" ? (
                <div className="crm-imoti-bank-board">
                  <h3>
                    <FolderOpen size={16} /> Папка с образци — {bank}
                  </h3>
                  <ul className="crm-imoti-bank-docs">
                    {TEMPLATES.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
