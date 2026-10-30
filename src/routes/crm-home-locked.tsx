import { createFileRoute } from "@tanstack/react-router";
import { CrmHomeLockedPage } from "@/components/crm-home-locked/CrmHomeLockedPage";

export const Route = createFileRoute("/crm-home-locked")({
  component: CrmHomeLockedPage,
  head: () => ({
    meta: [
      { title: "CRM Начало · Locked Clone · Имоти Надежда" },
      {
        name: "description",
        content: "Заключен 1:1 клонинг на CRM началната страница — светла и тъмна тема.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
});
