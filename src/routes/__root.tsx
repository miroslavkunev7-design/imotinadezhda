import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import { CustomerChat } from "@/components/site/customer-chat";
import { useRouterState } from "@tanstack/react-router";
import { initPwa } from "@/lib/pwa";
import { enforceRememberMePolicy } from "@/lib/remember-me";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Имоти Надежда — недвижими имоти в Бургас, Варна, Шумен" },
      { name: "description", content: "Имоти Надежда — агенция за недвижими имоти. Апартаменти, къщи, парцели и офиси за продажба и под наем в Бургас, Варна, Шумен и Нови пазар." },
      { name: "keywords", content: "Имоти Надежда, недвижими имоти, имоти Бургас, имоти Варна, имоти Шумен, имоти Нови пазар, апартаменти, къщи, парцели, агенция недвижими имоти" },
      { name: "author", content: "Имоти Надежда" },
      { name: "theme-color", content: "#8B1A2B" },
      { name: "application-name", content: "Имоти Надежда" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Имоти Надежда" },
      { property: "og:site_name", content: "Имоти Надежда" },
      { property: "og:title", content: "Имоти Надежда — недвижими имоти в Бургас, Варна, Шумен" },
      { property: "og:description", content: "Агенция Имоти Надежда. Апартаменти, къщи, парцели и офиси за продажба и под наем в Бургас, Варна, Шумен и Нови пазар." },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "bg_BG" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Имоти Надежда — недвижими имоти в Бургас, Варна, Шумен" },
      { name: "twitter:description", content: "Агенция Имоти Надежда. Апартаменти, къщи, парцели и офиси за продажба и под наем в Бургас, Варна, Шумен и Нови пазар." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { rel: "icon", href: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideChat = pathname.startsWith("/admin") || pathname.startsWith("/login");
  const propertyMatch = pathname.match(/^\/properties\/([0-9a-f-]{36})/i);
  const propertyId = propertyMatch?.[1] ?? null;

  useEffect(() => {
    // Apply "remember me" policy before AuthProvider hydrates the session,
    // then wire up PWA install + service worker (no-op in iframe/preview).
    enforceRememberMePolicy().finally(() => initPwa());
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster />
        {!hideChat && <CustomerChat propertyId={propertyId} />}
      </AuthProvider>
    </QueryClientProvider>
  );
}
