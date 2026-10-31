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
        width={320}
        height={130}
        decoding="async"
        draggable={false}
      />
    </button>
  );
}
