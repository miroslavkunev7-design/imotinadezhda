/**
    * Verified neighborhood-card image mapping.
    *
    * Keys are scoped by city and use the production quarter slugs. Unverified entries remain null: no exact-location, reusable original was available, so
    * public cards must not silently fall back to a placeholder or another city.
    */
    export const VERIFIED_QUARTER_IMAGES: Record<string, Record<string, string | null>> = {
    burgas: {
      "tsentr-burgas-bg": "/images/quarters/burgas/centar.jpg",
      centar: "/images/quarters/burgas/centar.jpg",
      "sarafovo-burgas-bg": "/images/quarters/burgas/sarafovo.jpg",
      sarafovo: "/images/quarters/burgas/sarafovo.jpg",
      "slaveykov-burgas-bg": "/images/quarters/burgas/slaveykov.jpg",
      slaveykov: "/images/quarters/burgas/slaveykov.jpg",
      "pobeda-burgas-bg": "/images/quarters/burgas/pobeda.jpg",
      pobeda: "/images/quarters/burgas/pobeda.jpg",
      "izgrev-burgas-bg": "/images/quarters/burgas/izgrev.jpg",
      izgrev: "/images/quarters/burgas/izgrev.jpg",
      "lazur-burgas-bg": "/images/quarters/burgas/lazur.jpg",
      lazur: "/images/quarters/burgas/lazur.jpg",
      "vzrazhdane-burgas-bg": "/images/quarters/burgas/vazrajdane.jpg",
      vazrajdane: "/images/quarters/burgas/vazrajdane.jpg",
      "madika-burgas-bg": "/images/quarters/burgas/madika.jpg",
      madika: "/images/quarters/burgas/madika.jpg",
      "kraymorie-burgas-bg": "/images/quarters/burgas/kraimorie.jpg",
      kraimorie: "/images/quarters/burgas/kraimorie.jpg",
    },
    varna: {
      "borovets-yug-varna-bg": null,
      "borovets-yug": null,
      "akchelar-varna-bg": null,
      akchelar: null,
      "kaysiyeva-gradina-varna-bg": "/images/quarters/varna/kaysiyeva-gradina.jpg",
      "kaysiyeva-gradina": "/images/quarters/varna/kaysiyeva-gradina.jpg",
      levski: "/images/quarters/varna/levski.jpg",
      "izgrev-varna-bg": "/images/quarters/varna/izgrev.jpg",
      izgrev: "/images/quarters/varna/izgrev.jpg",
      "galata-varna-bg": "/images/quarters/varna/galata.jpg",
      galata: "/images/quarters/varna/galata.jpg",
      "kolhozen-pazar-varna-bg": "/images/quarters/varna/kolhozen-pazar.jpg",
      "kolhozen-pazar": "/images/quarters/varna/kolhozen-pazar.jpg",
      "vladislavovo-varna-bg": "/images/quarters/varna/vladislavovo.jpg",
      vladislavovo: "/images/quarters/varna/vladislavovo.jpg",
      "sotira-varna-bg": null,
      sotira: null,
    },
    shumen: {
      bolnitsata: "/images/quarters/shumen/bolnicata.jpg",
      "boyan-balgaranov-1": "/images/quarters/shumen/boyan-bulgarov.jpg",
      "boyan-bulgarov": "/images/quarters/shumen/boyan-bulgarov.jpg",
      "boyan-balgaranov-2": "/images/quarters/shumen/boyan-bulgarov-2.jpg",
      herson: "/images/quarters/shumen/herson.jpg",
      trakiya: "/images/quarters/shumen/trakiya.jpg",
      pozharnata: "/images/quarters/shumen/pozharnata.jpg",
      grivitsa: "/images/quarters/shumen/grivitsa.jpg",
      "peti-polk": "/images/quarters/shumen/peti-polk.jpg",
      tsentar: "/images/quarters/shumen/centar.jpg",
      everest: "/images/quarters/shumen/everest.jpg",
      dobrudzhanski: "/images/quarters/shumen/dobrudjanski.jpg",
    },
    };

    export type QuarterImageCredit = {
      author: string;
      sourceTitle: string;
      sourceUrl: string;
      license: string;
      licenseUrl: string;
      altText: string;
      changes: string;
    };

    const pobedaCredit: QuarterImageCredit = {
      author: "Vammpi",
      sourceTitle: "Burgas Juni2012 Burgas See und Kumluka",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Burgas_Juni2012_Burgas_See_und_Kumluka.jpg",
      license: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
      altText: "Aerial panorama of Burgas Bay and Kumluka, including the Pobeda and Akatsiite neighborhoods.",
      changes: "Resized and recompressed for web; the card uses a responsive cover crop.",
    };
    const madikaCredit: QuarterImageCredit = {
      author: "gosheto",
      sourceTitle: "Шоурум Бова Бургас - panoramio",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:%D0%A8%D0%BE%D1%83%D1%80%D1%83%D0%BC_%D0%91%D0%BE%D0%B2%D0%B0_%D0%91%D1%83%D1%80%D0%B3%D0%B0%D1%81_-_panoramio.jpg",
      license: "CC BY 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
      altText: "Bova Chevrolet and Opel showroom on Bratya Prenerovi Street in Madika, Burgas.",
      changes: "Resized and recompressed for web; the card uses a responsive cover crop.",
    };
    const kolhozenCredit: QuarterImageCredit = {
      author: "Spiritia",
      sourceTitle: "Stefan Malinov plaque, Varna",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Stefan_Malinov_plaque,_Varna.jpg",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      altText: "Bust of Stefan Malinov at Kolhozen Pazar in Varna.",
      changes: "Resized and recompressed for web; the card uses a responsive cover crop.",
    };

    export const VERIFIED_QUARTER_IMAGE_CREDITS: Record<string, Record<string, QuarterImageCredit>> = {
      burgas: {
        "pobeda-burgas-bg": pobedaCredit, pobeda: pobedaCredit,
        "madika-burgas-bg": madikaCredit, madika: madikaCredit,
      },
      varna: {
        "kolhozen-pazar-varna-bg": kolhozenCredit, "kolhozen-pazar": kolhozenCredit,
      },
    };

    export function getVerifiedQuarterImageCredit(citySlug: string, quarterSlug: string): QuarterImageCredit | null {
      return VERIFIED_QUARTER_IMAGE_CREDITS[citySlug]?.[quarterSlug] ?? null;
    }
    export function getVerifiedQuarterImage(
    citySlug: string,
    quarterSlug: string,
    currentImageUrl: string | null | undefined,
    ): string | null {
    const cityMap = VERIFIED_QUARTER_IMAGES[citySlug];
    if (!cityMap || !Object.prototype.hasOwnProperty.call(cityMap, quarterSlug)) {
      return currentImageUrl ?? null;
    }
    return cityMap[quarterSlug];
    }
    