/**
    * Verified neighborhood-card image mapping.
    *
    * Keys are scoped by city and use the production quarter slugs. The six null
    * entries are intentional: no verified original was available for them, so
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
      "pobeda-burgas-bg": null,
      pobeda: null,
      "izgrev-burgas-bg": "/images/quarters/burgas/izgrev.jpg",
      izgrev: "/images/quarters/burgas/izgrev.jpg",
      "lazur-burgas-bg": "/images/quarters/burgas/lazur.jpg",
      lazur: "/images/quarters/burgas/lazur.jpg",
      "vzrazhdane-burgas-bg": "/images/quarters/burgas/vazrajdane.jpg",
      vazrajdane: "/images/quarters/burgas/vazrajdane.jpg",
      "madika-burgas-bg": null,
      madika: null,
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
      "kolhozen-pazar-varna-bg": null,
      "kolhozen-pazar": null,
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
    