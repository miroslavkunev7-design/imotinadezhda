export function LockedLogo({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      className="crm-locked-logo-link"
      aria-label="Начало — CRM"
      onClick={onClick}
    >
      <img
        src="/crm-home-locked/logo-houses-outline.svg"
        alt="Недвижими имоти Надежда"
        className="crm-locked-logo"
        width={380}
        height={190}
        decoding="async"
        draggable={false}
      />
    </button>
  );
}
