    /**
    * Verified neighborhood-card image mapping.
    *
    * Keys are scoped by city and use the production quarter slugs. Unverified
    * entries remain null: no exact-location, reusable original was available, so
    * public cards must not silently fall back to a placeholder or another city.
    * Thumbnail-sized derivatives (~349px) are also null — only full-size
    * originals (Pobeda, Madika, Kolhozen pazar) are wired.
    */
    export const VERIFIED_QUARTER_IMAGES: Record<string, Record<string, string | null>> = {
    burgas: {
      "tsentr-burgas-bg": null,
      centar: null,
      "sarafovo-burgas-bg": null,
      sarafovo: null,
      "slaveykov-burgas-bg": null,
      slaveykov: null,
      "pobeda-burgas-bg": "/images/quarters/burgas/pobeda.jpg",
      pobeda: "/images/quarters/burgas/pobeda.jpg",
      "izgrev-burgas-bg": null,
      izgrev: null,
      "lazur-burgas-bg": null,
      lazur: null,
      "vzrazhdane-burgas-bg": null,
      vazrajdane: null,
      "madika-burgas-bg": "/images/quarters/burgas/madika.jpg",
      madika: "/images/quarters/burgas/madika.jpg",
      "kraymorie-burgas-bg": null,
      kraimorie: null,
    },
    varna: {
      "borovets-yug-varna-bg": null,
      "borovets-yug": null,
      "akchelar-varna-bg": null,
      akchelar: null,
      "kaysiyeva-gradina-varna-bg": null,
      "kaysiyeva-gradina": null,
      levski: null,
      "izgrev-varna-bg": null,
      izgrev: null,
      "galata-varna-bg": null,
      galata: null,
      "kolhozen-pazar-varna-bg": "/images/quarters/varna/kolhozen-pazar.jpg",
      "kolhozen-pazar": "/images/quarters/varna/kolhozen-pazar.jpg",
      "vladislavovo-varna-bg": null,
      vladislavovo: null,
      "sotira-varna-bg": null,
      sotira: null,
    },
    shumen: {
      bolnitsata: null,
      "boyan-balgaranov-1": null,
      "boyan-bulgarov": null,
      "boyan-balgaranov-2": null,
      herson: null,
      trakiya: null,
      pozharnata: null,
      grivitsa: null,
      "peti-polk": null,
      tsentar: null,
      everest: null,
      dobrudzhanski: null,
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
    