export function LockedLogo() {
  return (
    <a
      href="/"
      className="crm-locked-logo-link"
      aria-label="Към началната страница на сайта"
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
    </a>
  );
}
