export function BrokerBadge({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className="crm-locked-broker"
      aria-label="Профил Мирослав Канев"
      onClick={onOpen}
    >
      <img
        src="/crm-home-locked/avatar-miroslav.jpg"
        alt=""
        className="crm-locked-avatar"
        width={60}
        height={60}
        decoding="async"
      />
      <div className="crm-locked-broker__meta">
        <span className="crm-locked-broker__name">Мирослав Канев</span>
        <span className="crm-locked-name-line" aria-hidden />
      </div>
    </button>
  );
}
