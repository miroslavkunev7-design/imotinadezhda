import {
  Building2,
  Calculator,
  ChevronLeft,
  FolderOpen,
  IdCard,
  Landmark,
  Save,
  Scale,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BANKS_CATALOG, bankMeta, type CreditBlockData } from "@/lib/banks-catalog";
import { BGN_PER_EUR, calcNotaryFees, money } from "@/lib/mortgage-calc";
import { MORTGAGE_DOC_REQS } from "@/lib/mortgage-docs";
import { getLiveRate, monthlyPayment, type IncomeOrigin } from "@/lib/mortgage-rates";

import type { ImotiProperty } from "./imoti-types";

type DetailTab = "board" | "form" | "templates";

/**
 * Банка върху информационната карта на имот (locked CRM):
 * мрежа → цветна карта → „Запази кредитен блок“.
 */
export function ImotiBankModal({
  open,
  property,
  onClose,
  onSaveCreditBlock,
}: {
  open: boolean;
  property: ImotiProperty | null;
  onClose: () => void;
  onSaveCreditBlock: (block: CreditBlockData) => void;
}) {
  const [bank, setBank] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("board");
  const [origin, setOrigin] = useState<IncomeOrigin>("bg");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [years, setYears] = useState("25");
  const [ownFunds, setOwnFunds] = useState("");
  const [income, setIncome] = useState("");
  const [employer, setEmployer] = useState("");
  const [egn, setEgn] = useState("");
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState<number | null>(null);
  const [notary, setNotary] = useState<ReturnType<typeof calcNotaryFees> | null>(null);

  useEffect(() => {
    if (!open || !property) return;
    const existing = property.creditBlock;
    setBank(null);
    setTab("board");
    setOrigin("bg");
    setPrice(String(property.price));
    setAmount(existing ? String(existing.amount) : String(Math.round(property.price * 0.8)));
    setYears(existing ? String(existing.years) : "25");
    setOwnFunds(
      existing
        ? String(existing.downPayment)
        : String(Math.round(property.price * 0.2)),
    );
    setIncome("");
    setEmployer("");
    setEgn("");
    setNote("");
    setPayment(existing?.payment ?? null);
    setNotary(null);
  }, [open, property]);

  const today = useMemo(() => new Date(), []);
  const meta = bankMeta(bank);
  const liveBg = getLiveRate(bank, "bg", today);
  const liveForeign = getLiveRate(bank, "foreign", today);
  const live = origin === "foreign" ? liveForeign : liveBg;
  const color = meta.color;
  const fg = meta.dark ? "#3d2f00" : "#ffffff";

  if (!open || !property) return null;

  const city = property.city;

  const calcPayment = () => {
    const a = Number(amount);
    const y = Number(years);
    if (!a || !y) return;
    setPayment(monthlyPayment(a, live.rate, y));
  };

  const calcNotaryLocal = () => {
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

  const saveBlock = () => {
    if (!bank) return;
    const loan = Number(amount);
    const y = Number(years) || 25;
    const down = Number(ownFunds) || Math.max(0, Number(price) - loan);
    if (!loan) return;
    const pay = payment ?? monthlyPayment(loan, live.rate, y);
    onSaveCreditBlock({
      bank,
      amount: loan,
      downPayment: down,
      years: y,
      rate: live.rate,
      payment: pay,
      savedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="crm-imoti-bank-overlay" role="dialog" aria-modal="true" aria-label="Банка">
      <div className="crm-imoti-bank-modal crm-imoti-bank-modal--wide">
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
                Избери банка — отваря се цветна карта. След „Запази кредитен блок“ блокът седи в
                информационната карта на имота.
              </p>
              <div className="crm-imoti-bank-grid">
                {BANKS_CATALOG.map((b) => {
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
                        <span className="crm-imoti-bank-card__cta">Избери банка →</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <header className="crm-imoti-bank-modal__head crm-imoti-bank-modal__head--brand" style={{ backgroundColor: color, color: fg }}>
              <div className="crm-imoti-bank-modal__head-row">
                <button type="button" className="crm-imoti-ghost crm-imoti-ghost--on-brand" onClick={() => setBank(null)}>
                  <ChevronLeft size={14} /> Банките
                </button>
                <button type="button" className="crm-imoti-icon-btn crm-imoti-icon-btn--on-brand" aria-label="Затвори" onClick={onClose}>
                  <X size={16} />
                </button>
              </div>
              <div className="crm-imoti-bank-banner crm-imoti-bank-banner--plain">
                <strong>{bank}</strong>
                {meta.slogan ? <em>{meta.slogan}</em> : null}
                <span>
                  Клон {city} · {property.title}
                </span>
              </div>
              <div className="crm-imoti-bank-tabs" role="tablist">
                {(
                  [
                    ["board", "Табло", Calculator],
                    ["form", "Графи", FolderOpen],
                    ["templates", "Образци", IdCard],
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
                <div className="crm-imoti-bank-board-layout">
                  <div className="crm-imoti-bank-board-main">
                    <div className="crm-imoti-bank-panel">
                      <h3>
                        <ShieldCheck size={16} /> Проверка на ЦКР
                      </h3>
                      <p className="crm-imoti-bank-modal__hint">
                        Прикачи лична карта за проверка на ЕГН и запис към {bank} (демо локално).
                      </p>
                      <div className="crm-imoti-bank-actions">
                        <button type="button" className="crm-imoti-primary" style={{ background: color }}>
                          <IdCard size={14} /> Прикачи лична карта
                        </button>
                        <button type="button" className="crm-imoti-ghost" style={{ borderColor: color, color }}>
                          Проверка на ЦКР
                        </button>
                      </div>
                    </div>

                    <div className="crm-imoti-bank-panel">
                      <h3>
                        <Calculator size={16} /> Графи за ипотечен кредит
                      </h3>
                      <div className="crm-imoti-bank-origin">
                        <button
                          type="button"
                          className={origin === "bg" ? "is-on" : undefined}
                          style={origin === "bg" ? { background: color, borderColor: color } : undefined}
                          onClick={() => setOrigin("bg")}
                        >
                          Пълна отг. {liveBg.rate.toFixed(2)}%
                        </button>
                        <button
                          type="button"
                          className={origin === "foreign" ? "is-on" : undefined}
                          style={origin === "foreign" ? { background: color, borderColor: color } : undefined}
                          onClick={() => setOrigin("foreign")}
                        >
                          Чужбина {liveForeign.rate.toFixed(2)}%
                        </button>
                      </div>
                      <div className="crm-imoti-bank-fields">
                        <label>
                          Цена имот (EUR)
                          <input value={price} inputMode="decimal" onChange={(e) => setPrice(e.target.value)} />
                        </label>
                        <label>
                          Желана сума (EUR)
                          <input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} />
                        </label>
                        <label>
                          Срок (години)
                          <input value={years} inputMode="numeric" onChange={(e) => setYears(e.target.value)} />
                        </label>
                        <label>
                          Собствени средства (EUR)
                          <input value={ownFunds} inputMode="decimal" onChange={(e) => setOwnFunds(e.target.value)} />
                        </label>
                        <label>
                          Месечен доход (EUR)
                          <input value={income} inputMode="decimal" onChange={(e) => setIncome(e.target.value)} />
                        </label>
                        <label>
                          Лихва
                          <div className="crm-imoti-bank-rate">{live.rate.toFixed(2)}%</div>
                        </label>
                      </div>
                      <div className="crm-imoti-bank-actions">
                        <button type="button" className="crm-imoti-primary" style={{ background: color }} onClick={calcPayment}>
                          <Calculator size={14} /> Изчисли вноска
                        </button>
                        <button type="button" className="crm-imoti-ghost" onClick={calcNotaryLocal}>
                          <Scale size={14} /> Изчисли нотариус
                        </button>
                        <button type="button" className="crm-imoti-primary" onClick={saveBlock}>
                          <Save size={14} /> Запази кредитен блок
                        </button>
                      </div>
                      {payment !== null ? (
                        <div className="crm-imoti-bank-result crm-imoti-bank-result--ok" style={{ color, borderColor: `${color}55` }}>
                          Месечна вноска: {money(payment, "EUR")} при {live.rate.toFixed(2)}% за {years} г.
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
                          <div className="crm-imoti-bank-result__row">
                            <span>Общо в лева</span>
                            <strong>{money(notary.total * BGN_PER_EUR, "BGN")}</strong>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="crm-imoti-bank-board-side">
                    <div className="crm-imoti-bank-sticky">
                      <strong>Днес — {today.toLocaleDateString("bg-BG")}</strong>
                      <p>EUR → BGN: 1 = {BGN_PER_EUR.toFixed(5)}</p>
                      <p>
                        Лихва {bank} днес: <em style={{ color }}>{liveBg.rate.toFixed(2)}%</em>
                      </p>
                      <p>
                        Чужбина: <em style={{ color }}>{liveForeign.rate.toFixed(2)}%</em>
                      </p>
                    </div>
                    <div className="crm-imoti-bank-sticky crm-imoti-bank-sticky--tilt">
                      <strong>Документи за ипотека — {meta.short ?? bank}</strong>
                      <ul className="crm-imoti-bank-docs">
                        {MORTGAGE_DOC_REQS.map((r) => (
                          <li key={r.id}>{r.label}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}

              {tab === "form" ? (
                <div className="crm-imoti-bank-board">
                  <h3>Графи за ипотечен кредит — {bank}</h3>
                  <div className="crm-imoti-bank-fields crm-imoti-bank-fields--stack">
                    <label>
                      Работодател
                      <input value={employer} onChange={(e) => setEmployer(e.target.value)} />
                    </label>
                    <label>
                      ЕГН
                      <input value={egn} onChange={(e) => setEgn(e.target.value)} />
                    </label>
                    <label>
                      Бележка към банката
                      <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
                    </label>
                  </div>
                  <button type="button" className="crm-imoti-primary" onClick={saveBlock}>
                    <Save size={14} /> Запази кредитен блок
                  </button>
                </div>
              ) : null}

              {tab === "templates" ? (
                <div className="crm-imoti-bank-board">
                  <h3>
                    <FolderOpen size={16} /> Папка с образци — {bank}
                  </h3>
                  <ul className="crm-imoti-bank-docs">
                    <li>Заявление за ипотечен кредит</li>
                    <li>Декларация за семейно и имотно състояние</li>
                    <li>Съгласие за ЦКР и GDPR</li>
                    <li>Декларация ЗМИП</li>
                    <li>Нотариален акт / предварителен договор за имота</li>
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
