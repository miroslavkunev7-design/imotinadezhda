export function LockedLogo({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      className="crm-locked-logo-link"
      aria-label="Начало — CRM"
      onClick={onClick}
    >
      <img
        src="/crm-home-locked/logo-mark-white.png"
        alt="Недвижими имоти Надежда"
        className="crm-locked-logo"
        width={260}
        height={106}
        decoding="async"
        draggable={false}
      />
    </button>
  );
}
