      <div className="absolute bottom-6 left-6 right-6">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodedQuery}`}
          target="_blank"
          rel="noopener noreferrer"
          className="nadezhda-dark-red-bg flex w-full items-center justify-center gap-3 rounded-xl border border-[#c59441] py-4 text-lg text-white shadow-xl transition hover:brightness-125"
        >
          <MapPin className="h-5 w-5 text-[#c59441]" /> Виж на картата
        </a>
      </div>
    </aside>
  );
}

type PropertyData = {
  property: {
    id: string;
    title: string;
    description?: string | null;
    price: number;
    currency?: string | null;
    area_sqm?: number | null;
    rooms?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    floor?: number | null;
    total_floors?: number | null;
    year_built?: number | null;
    property_type?: string | null;
    status?: string | null;
    address?: string | null;
    amenities?: string[] | null;
    cover_image_url?: string | null;
    is_featured?: boolean;
    cities?: { name: string; slug: string } | null;
    quarters?: { name: string; slug: string } | null;
  };
  images: Array<{ id: string; url: string; is_cover?: boolean; display_order?: number | null }>;
  broker?: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    photo_url: string | null;
  } | null;
  similar?: Array<{
    id: string;
    title: string;
    price: number;
    currency?: string | null;
    area_sqm?: number | null;
    rooms?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    cover_image_url?: string | null;
    property_type?: string | null;
    cities?: { name: string; slug: string } | null;
  }>;
};

export function PropertyPage({ data }: { data?: PropertyData } = {}) {
  if (!data) {
    return (
      <main className="luxury-page nadezhda-marble-bg flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="font-serif-nadezhda text-3xl text-[#600f1c]">Имотът не е намерен</h1>
          <Link to="/" className="mt-4 inline-block text-[#600f1c] underline">
            Към началната страница
          </Link>
        </div>
      </main>
    );
  }
  const { property, images, broker } = data;
  const similar = data.similar ?? [];
  const favs = useFavorites();
  // Resolve broker contact: fall back to the agency owner defaults when the
  // listing has no linked broker (legacy rows / direct admin uploads).
  const brokerName = broker?.full_name?.trim() || AGENCY.name;
  const brokerRole = broker ? "Брокер" : "Старши консултант";
  const brokerPhoneDisplay = broker?.phone?.trim() || AGENCY.phoneDisplay;
  const brokerPhoneTel = `+${brokerPhoneDisplay.replace(/[^\d]/g, "").replace(/^0/, "359")}`;
  const brokerEmail = broker?.email?.trim() || AGENCY.email;
  const brokerPhoto = broker?.photo_url?.trim() || "";

  const gallery = (
    images.length ? images.map((i) => i.url) : [property.cover_image_url || burgasHero]
  ).filter(Boolean) as string[];
  const cityName = property.cities?.name ?? "—";
  const citySlug = property.cities?.slug ?? "";
  const quarterName = property.quarters?.name ?? "";
  const quarterSlug = property.quarters?.slug ?? "";
  const priceStr = formatPrice(property.price, property.currency ?? "EUR");
  const pricePerSqm = property.area_sqm
    ? formatPrice(
        Math.round(Number(property.price) / Number(property.area_sqm)),
        property.currency ?? "EUR",
      ) + " / м²"
    : undefined;

  const [propVideoFailed, setPropVideoFailed] = useReactState(false);
  const propFallbackVideo = cityVideoFallbacks[citySlug];
  const propHeroVideo = propVideoFailed ? null : propFallbackVideo;
  const propHeroPoster =
    (citySlugImages as Record<string, string>)[citySlug] || property.cover_image_url || burgasHero;

  return (
    <main className="luxury-page nadezhda-marble-bg min-h-screen font-sans-nadezhda text-[#31020c]">
      <LuxuryHeader active="sale" />

      {/* HERO — city video (replaces the big top image; gallery below is untouched) */}
      <div className="relative h-[550px] w-full">
        {propHeroVideo ? (
          <AutoPlayVideo
            src={propHeroVideo}
            fallbackSrc={propFallbackVideo}
            onPermanentError={() => setPropVideoFailed(true)}
            poster={propHeroPoster}
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            src={propHeroPoster}
            alt={cityName}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent"
        />
      </div>

      {/* Floating search bar */}
      <div className="relative z-10 mx-auto -mt-12 max-w-6xl px-4">
        <DistrictSearchBar cityName={cityName} />
      </div>

      <div className="site-main-below-header mx-auto mt-12 max-w-7xl px-4 pb-24">
        {/* Breadcrumb */}
        <div className="mb-8 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <Link to="/" className="hover:text-black">
            Начало
          </Link>
          <ChevronRight className="h-3 w-3" />
          {citySlug ? (
            <Link to="/cities/$slug" params={{ slug: citySlug }} className="hover:text-black">
              {cityName}
            </Link>
          ) : (
            <span>{cityName}</span>
          )}
          {quarterName ? (
            <>
              <ChevronRight className="h-3 w-3" />
              {quarterSlug ? (
                <Link
                  to="/cities/$slug/districts/$district"
                  params={{ slug: citySlug, district: quarterSlug }}
                  className="hover:text-black"
                >
                  {quarterName}
                </Link>
              ) : (
                <span>{quarterName}</span>
              )}
            </>
          ) : null}
          <ChevronRight className="h-3 w-3" />
          <span className="line-clamp-1 font-bold text-[#600f1c]">{property.title}</span>
        </div>

        <div className="flex flex-col gap-10 lg:flex-row">
          {/* LEFT */}
          <div className="flex-1">
            <div className="mb-6">
              {property.is_featured ? (
                <span className="nadezhda-gold-bg mb-4 inline-block rounded-md px-4 py-2 text-xs font-bold tracking-wide text-black shadow">
                  ТОП ОФЕРТА
                </span>
              ) : null}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-serif-nadezhda mb-3 text-3xl font-bold text-[#600f1c] md:text-4xl">
                    {property.title}
                  </h1>
                  <div className="text-lg text-gray-600">
                    {quarterName ? `кв. ${quarterName}, ` : ""}гр. {cityName}
                  </div>
                </div>
                <div className="flex gap-6">
                  <button
                    type="button"
                    onClick={() => {
                      const added = favs.toggle(property.id);
                      toast.success(added ? "Добавено в любими" : "Премахнато от любими");
                    }}
                    className={`flex items-center gap-2 transition ${favs.has(property.id) ? "text-red-500" : "text-gray-500 hover:text-red-500"}`}
                  >
                    <Heart
                      className={`h-6 w-6 ${favs.has(property.id) ? "fill-red-500 text-red-500" : "text-[#c59441]"}`}
                    />
                    <span className="text-left text-sm">
                      {favs.has(property.id) ? "Премахни\nот любими" : "Добави\nв любими"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const url = typeof window !== "undefined" ? window.location.href : "";
                      const r = await shareProperty({
                        title: property.title,
                        url,
                        text: `${property.title} — ${cityName}`,
                      });
                      if (r === "copied") toast.success("Линкът е копиран");
                      else if (r === "failed") toast.error("Споделянето не е възможно");
                    }}
                    className="flex items-center gap-2 text-gray-500 transition hover:text-blue-500"
                  >
                    <Share2 className="h-6 w-6 text-[#c59441]" />
                    <span className="text-sm">Сподели</span>
                  </button>
                </div>
              </div>
            </div>

            {/* GALLERY — kept untouched (uses existing PropertyGallery for the property photos viewer) */}
            <div
              className="mb-10 overflow-hidden rounded-3xl border border-[#eaddc4] bg-card p-3 shadow-2xl"
              style={{ height: 620 }}
            >
              <PropertyGallery images={gallery} title={property.title} />
            </div>

            {/* Price + facts row */}
            <div className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b-2 border-gray-200 pb-8">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
                  <LandPlot className="h-5 w-5 text-[#c59441]" /> Цена
                </div>
                <div className="font-serif-nadezhda mb-2 text-4xl font-bold text-[#600f1c]">
                  {priceStr}
                </div>
                {pricePerSqm ? (
                  <div className="text-sm font-bold text-gray-500">{pricePerSqm}</div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-8 divide-x divide-gray-200 text-center">
                {[
                  property.area_sqm != null
                    ? { icon: Square, label: "Площ", value: `${property.area_sqm} м²` }
                    : null,
                  property.floor != null
                    ? {
                        icon: Building2,
                        label: "Етаж",
                        value: `${property.floor}${property.total_floors ? ` от ${property.total_floors}` : ""}`,
                      }
                    : null,
                  property.rooms != null
                    ? { icon: House, label: "Стаи", value: String(property.rooms) }
                    : null,
                  property.bedrooms != null
                    ? { icon: BedDouble, label: "Спални", value: String(property.bedrooms) }
                    : null,
                  property.bathrooms != null
                    ? { icon: Bath, label: "Бани", value: String(property.bathrooms) }
                    : null,
                  property.year_built != null
                    ? { icon: Compass, label: "Година", value: String(property.year_built) }
                    : null,
                ]
                  .filter(Boolean)
                  .map((f: any, i) => {
                    const Icon = f.icon;
                    return (
                      <div key={f.label} className={i === 0 ? "first:pl-0" : "pl-8"}>
                        <div className="mb-2 flex items-center justify-center gap-2 text-sm text-gray-500">
                          <Icon className="h-5 w-5 text-[#c59441]" /> {f.label}
                        </div>
                        <div className="text-xl font-bold">{f.value}</div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Description */}
            {property.description ? (
              <div className="rounded-3xl border border-[#eaddc4] bg-[#fdfaf5] p-8 shadow-lg md:p-10">
                <h3 className="font-serif-nadezhda mb-6 text-3xl font-bold text-[#600f1c]">
                  Описание
                </h3>
                <div className="mb-8 space-y-5 whitespace-pre-line text-lg leading-relaxed text-gray-700">
                  {property.description}
                </div>
                {property.amenities && property.amenities.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-8 sm:grid-cols-3 md:grid-cols-5">
                    {property.amenities.slice(0, 10).map((a) => (
                      <div key={a} className="flex flex-col items-center gap-3 p-4 text-center">
                        <Trees className="h-9 w-9 text-[#c59441]" />
                        <div className="text-sm font-bold leading-tight text-gray-700">{a}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* RIGHT — sticky sidebar */}
          <aside className="w-full flex-shrink-0 space-y-8 lg:w-[360px]">
            {/* Broker card */}
            <div className="nadezhda-dark-red-bg rounded-3xl border border-[#c59441] p-8 text-white shadow-2xl">
              <div className="mb-8 flex items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-[#c59441] bg-[#3a0010] shadow-lg">
                  {brokerPhoto ? (
                    <img
                      src={brokerPhoto}
                      alt={brokerName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-8 w-8 text-[#c59441]" />
                  )}
                </div>
                <div>
                  <div className="font-serif-nadezhda mb-1 text-xl font-bold text-[#ebd197]">
                    {brokerName}
                  </div>
                  <div className="text-sm text-gray-300">{brokerRole}</div>
                </div>
              </div>
              <div className="mb-6 space-y-4 text-base">
                <a
                  href={`tel:${brokerPhoneTel}`}
                  className="flex items-center gap-4 hover:text-[#f4d07d]"
                >
                  <Phone className="h-5 w-5 text-[#f4d07d]" /> {brokerPhoneDisplay}
                </a>
                <a
                  href={`mailto:${brokerEmail}`}
                  className="flex items-center gap-4 break-all hover:text-[#f4d07d]"
                >
                  <Mail className="h-5 w-5 text-[#f4d07d]" /> {brokerEmail}
                </a>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2">
                <a
                  href={`tel:${brokerPhoneTel}`}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#c59441]/60 bg-white/5 py-3 text-xs font-semibold text-white transition hover:bg-white/10"
                  aria-label="Позвъни"
                >
                  <Phone className="h-5 w-5 text-[#f4d07d]" /> Позвъни
                </a>
                <a
                  href={`https://wa.me/${brokerPhoneTel.replace(/\D/g, "")}?text=${encodeURIComponent(`Здравейте, интересувам се от имот: ${property.title}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#25D366]/70 bg-[#25D366]/15 py-3 text-xs font-semibold text-white transition hover:bg-[#25D366]/25"
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="h-5 w-5 text-[#25D366]" /> WhatsApp
                </a>
                <a
                  href={`viber://chat?number=%2B${brokerPhoneTel.replace(/\D/g, "")}`}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#7360f2]/70 bg-[#7360f2]/15 py-3 text-xs font-semibold text-white transition hover:bg-[#7360f2]/25"
                  aria-label="Viber"
                >
                  <MessageCircle className="h-5 w-5 text-[#a594ff]" /> Viber
                </a>
              </div>

              <a
                href="#inquiry"
                className="nadezhda-gold-bg mb-3 flex w-full items-center justify-center gap-3 rounded-xl py-4 text-lg font-bold text-black shadow-xl transition hover:brightness-110"
              >
                Запази час за оглед
              </a>
              <a
                href="#inquiry"
                className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-[#c59441] bg-transparent py-4 text-lg font-bold text-white transition hover:bg-white/10"
              >
                <Mail className="h-5 w-5" /> Запитване
              </a>
            </div>

            {/* Details card */}
            <div className="nadezhda-dark-red-bg rounded-3xl border border-[#c59441] p-8 text-white shadow-2xl">
              <h3 className="font-serif-nadezhda mb-6 text-2xl font-bold text-[#ebd197]">
                Детайли за имота
              </h3>
              <div className="space-y-4 text-sm">
                {[
                  property.property_type ? ["Тип имот:", property.property_type] : null,
                  property.year_built
                    ? ["Година на строителство:", String(property.year_built)]
                    : null,
                  property.floor != null
                    ? [
                        "Етаж:",
                        `${property.floor}${property.total_floors ? ` от ${property.total_floors}` : ""}`,
                      ]
                    : null,
                  property.rooms != null ? ["Стаи:", String(property.rooms)] : null,
                  property.bedrooms != null ? ["Спални:", String(property.bedrooms)] : null,
                  property.bathrooms != null ? ["Бани:", String(property.bathrooms)] : null,
                  property.area_sqm != null ? ["Площ:", `${property.area_sqm} м²`] : null,
                  property.status ? ["Статус:", property.status] : null,
                  property.address ? ["Адрес:", property.address] : null,
                ]
                  .filter(Boolean)
                  .map((row: any) => (
                    <div
                      key={row[0]}
                      className="flex justify-between border-b border-gray-600/30 pb-3"
                    >
                      <span className="text-gray-400">{row[0]}</span>
                      <span className="w-1/2 text-right font-bold leading-tight">{row[1]}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Location card */}
            <div className="nadezhda-marble-bg rounded-3xl border border-[#eaddc4] p-8 shadow-xl">
              <h3 className="font-serif-nadezhda mb-2 text-2xl font-bold text-[#600f1c]">
                Локация
              </h3>
              <div className="mb-6 text-base font-semibold text-gray-600">
                {quarterName ? `кв. ${quarterName}, ` : ""}гр. {cityName}
              </div>
              <div className="relative mb-6 h-56 overflow-hidden rounded-2xl border border-gray-300 shadow-inner">
                <iframe
                  title={`Карта — ${property.address ?? cityName}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-full w-full border-0"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(
                    [
                      property.address,
                      quarterName ? `кв. ${quarterName}` : null,
                      cityName,
                      "Bulgaria",
                    ]
                      .filter(Boolean)
                      .join(", "),
                  )}&z=14&output=embed`}
                />
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  [
                    property.address,
                    quarterName ? `кв. ${quarterName}` : null,
                    cityName,
                    "Bulgaria",
                  ]
                    .filter(Boolean)
                    .join(", "),
                )}`}
                target="_blank"
                rel="noreferrer"
                className="nadezhda-dark-red-bg flex w-full items-center justify-center gap-3 rounded-xl py-4 text-lg font-bold text-white shadow-lg transition hover:brightness-125"
              >
                <MapPin className="h-5 w-5 text-[#f4d07d]" /> Виж на картата
              </a>
            </div>
          </aside>
        </div>
      </div>

      {/* Ипотечен диапазон */}
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <MortgageRangeBand
          price={Number(property.price) || 0}
          currency={property.currency ?? "EUR"}
          propertyId={property.id}
          propertyTitle={property.title}
        />
      </section>

      {/* Запитване */}
      <section id="inquiry" className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-20">
        <div className="rounded-3xl border border-[#eaddc4] bg-[#fdfaf5] p-6 shadow-xl md:p-10">
          <h2 className="font-serif-nadezhda mb-2 text-3xl font-bold text-[#600f1c]">
            Запитване за този имот
          </h2>
          <p className="mb-6 text-base text-gray-600">
            Оставете данни за контакт и ще Ви върнем отговор още същия работен ден.
          </p>
          <InquiryForm propertyId={property.id} propertyTitle={property.title} />
        </div>
      </section>

      {/* Подобни имоти */}
      {similar.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 pb-24">
          <h2 className="font-serif-nadezhda mb-8 text-3xl font-bold text-[#600f1c]">
            Подобни имоти в {cityName}
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((s) => (
              <ListingCard
                key={s.id}
                id={s.id}
                title={s.title}
                price={formatPrice(s.price, s.currency ?? "EUR")}
                size={s.area_sqm ? `${s.area_sqm} м²` : "—"}
                beds={Number(s.bedrooms ?? s.rooms ?? 0)}
                baths={Number(s.bathrooms ?? 0)}
                image={s.cover_image_url || burgasHero}
                tag={s.property_type ?? "Имот"}
                location={s.cities?.name ?? cityName}
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function PropertyGallery({ images, title }: { images: string[]; title: string }) {
  const [idx, setIdx] = useGalleryIndex(images.length);
  const [open, setOpen] = useReactState(false);
  const [mainLoaded, setMainLoaded] = useReactState(false);
  const [fsLoaded, setFsLoaded] = useReactState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    setMainLoaded(false);
  }, [idx, images]);
  useEffect(() => {
    if (open) setFsLoaded(false);
  }, [open, idx]);
  useEffect(() => {
    if (!open) return;
    const opener = openerRef.current;
    const getFocusable = () => {
      const root = dialogRef.current;
      if (!root) return [] as HTMLElement[];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("aria-hidden"));
    };
    // Move focus into the dialog on open.
    const focusTimer = window.setTimeout(() => {
      const nodes = getFocusable();
      (nodes[0] ?? dialogRef.current)?.focus();
    }, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowLeft") setIdx((idx - 1 + images.length) % images.length);
      else if (e.key === "ArrowRight") setIdx((idx + 1) % images.length);
      else if (e.key === "Home") {
        e.preventDefault();
        setIdx(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setIdx(images.length - 1);
      } else if (e.key === "Tab") {
        const nodes = getFocusable();
        if (nodes.length === 0) {
          e.preventDefault();
          dialogRef.current?.focus();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (active === first || !dialogRef.current?.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(focusTimer);
      // Restore focus to the trigger when the dialog closes.
      opener?.focus?.();
    };
  }, [open, idx, images.length]);
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[18px] bg-black">
        <button
          ref={openerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Отвори снимката на цял екран"
          className="absolute inset-0 h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <img
            src={images[idx]}
            alt={`${title} – снимка ${idx + 1}`}
            className={cn(
              "absolute inset-0 h-full w-full object-contain transition-opacity duration-300",
              mainLoaded ? "opacity-100" : "opacity-0",
            )}
            loading="lazy"
            decoding="async"
            onLoad={() => setMainLoaded(true)}
            onError={() => setMainLoaded(true)}
          />
          {!mainLoaded ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black">
              <div
                className="h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-white"
                aria-label="Зареждане"
              />
            </div>
          ) : null}
        </button>
        {images.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Предишна снимка"
              onClick={(e) => {
                e.stopPropagation();
                setIdx((idx - 1 + images.length) % images.length);
              }}
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-[rgba(225,29,72,0.88)] text-primary-foreground shadow-lg"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Следваща снимка"
              onClick={(e) => {
                e.stopPropagation();
                setIdx((idx + 1) % images.length);
              }}
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-[rgba(225,29,72,0.88)] text-primary-foreground shadow-lg"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-[10px] bg-[rgba(53,12,18,0.85)] px-3 py-1 text-xs text-primary-foreground">
          {idx + 1} / {images.length}
        </div>
      </div>
      {images.length > 1 ? (
        <div className="grid flex-shrink-0 grid-cols-6 gap-2">
          {images.slice(0, 6).map((thumb, i) => (
            <button
              key={`${thumb}-${i}`}
              type="button"
              aria-label={`Покажи снимка ${i + 1} от ${title}`}
              aria-current={i === idx}
              onClick={() => setIdx(i)}
              className={cn(
                "overflow-hidden rounded-[8px] border",
                i === idx ? "border-primary" : "border-primary/12",
              )}
            >
              <img
                src={thumb}
                alt={`${title} – снимка ${i + 1}`}
                className="h-14 w-full object-cover md:h-16"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}
      {open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Галерия"
          tabIndex={-1}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 focus:outline-none"
          onClick={() => setOpen(false)}
        >
          <img
            src={images[idx]}
            alt={`${title} – снимка ${idx + 1}`}
            className={cn(
              "max-h-full max-w-full object-contain transition-opacity duration-300",
              fsLoaded ? "opacity-100" : "opacity-0",
            )}
            onClick={(e) => e.stopPropagation()}
            onLoad={() => setFsLoaded(true)}
            onError={() => setFsLoaded(true)}
          />
          {!fsLoaded ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className="h-12 w-12 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-label="Зареждане"
              />
            </div>
          ) : null}
          <button
            type="button"
            aria-label="Затвори"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-6 w-6" />
          </button>
          {images.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Предишна снимка"
                onClick={(e) => {
                  e.stopPropagation();
                  setIdx((idx - 1 + images.length) % images.length);
                }}
                className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label="Следваща снимка"
                onClick={(e) => {
                  e.stopPropagation();
                  setIdx((idx + 1) % images.length);
                }}
                className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-sm text-white">
                {idx + 1} / {images.length}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function useGalleryIndex(len: number): [number, (n: number) => void] {
  const [idx, setIdx] = useReactState(0);
  // Reset to 0 if the gallery shrinks below the current index (effect, not render).
  useEffect(() => {
    if (idx >= len && len > 0) setIdx(0);
  }, [idx, len]);
  return [idx, setIdx];
}

function InquiryForm({
  propertyId,
  propertyTitle,
}: {
  propertyId?: string;
  propertyTitle?: string;
}) {
  const [name, setName] = useReactState("");
  const [email, setEmail] = useReactState("");
  const [phone, setPhone] = useReactState("");
  const [message, setMessage] = useReactState(
    propertyTitle ? `Здравейте, интересувам се от "${propertyTitle}". ` : "",
  );
  const [status, setStatus] = useReactState<"idle" | "sending" | "ok" | "error">("idle");
  const [err, setErr] = useReactState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErr(null);
    try {
      const { submitInquiry } = await import("@/lib/catalog.functions");
      await submitInquiry({
        data: {
          property_id: propertyId ?? null,
          name,
          email,
          phone: phone || undefined,
          message: message || undefined,
        },
      });
      // Автоматизация №1/№2 — лийдът тръгва към CRM и получава първи контакт.
      try {
        const params = new URLSearchParams(window.location.search);
        await fetch("/api/public/leads/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: name,
            email,
            phone: phone || null,
            message: message || null,
            channel: propertyId ? "property_page" : "website",
            source: document.referrer || "imotinadezhda.bg",
            property_id: propertyId ?? null,
            utm_source: params.get("utm_source"),
            utm_medium: params.get("utm_medium"),
            utm_campaign: params.get("utm_campaign"),
            referrer: document.referrer || null,
            landing_path: window.location.pathname,
          }),
        });
      } catch {
        /* лийд-автоматизацията не блокира потвърждението към клиента */
      }
      setStatus("ok");
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (e: any) {
      setStatus("error");
      setErr(e?.message ?? "Грешка при изпращане");
    }
  };

  return (
    <aside className="marble-dark-panel space-y-4 rounded-[20px] p-5 text-primary-foreground shadow-[0_22px_45px_rgba(139,26,43,0.3)]">
      <div>
        <div className="font-display text-[1.8rem] leading-none text-primary-foreground">
          Изпрати запитване
        </div>
        <div className="mt-1 text-base text-primary/85">
          Ще се свържем с вас възможно най-бързо.
        </div>
      </div>
      {status === "ok" ? (
        <div className="rounded-[14px] bg-primary-foreground/10 p-4 text-base">
          Благодарим! Получихме запитването ви.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Име"
            className="w-full rounded-[12px] border border-primary/25 bg-background/10 px-4 py-3 text-primary-foreground placeholder:text-primary/60"
          />
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Имейл"
            className="w-full rounded-[12px] border border-primary/25 bg-background/10 px-4 py-3 text-primary-foreground placeholder:text-primary/60"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Телефон (по избор)"
            className="w-full rounded-[12px] border border-primary/25 bg-background/10 px-4 py-3 text-primary-foreground placeholder:text-primary/60"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Съобщение"
            rows={4}
            className="w-full rounded-[12px] border border-primary/25 bg-background/10 px-4 py-3 text-primary-foreground placeholder:text-primary/60"
          />
          {err ? <div className="text-sm text-destructive-foreground">{err}</div> : null}
          <Button
            type="submit"
            disabled={status === "sending"}
            className="gold-cta-button h-14 w-full rounded-[14px] text-lg"
          >
            {status === "sending" ? "Изпращане…" : "Изпрати запитване"}
          </Button>
        </form>
      )}
      <div className="space-y-2 border-t border-primary/15 pt-3 text-base">
        <div className="flex items-center gap-3">
          <Phone className="h-5 w-5 text-primary" />
          {AGENCY.phoneDisplay}
        </div>
        <div className="flex items-center gap-3 break-all">
          <Mail className="h-5 w-5 text-primary" />
          {AGENCY.email}
        </div>
      </div>
    </aside>
  );
}
