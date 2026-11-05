import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

const CRM_STATIC_PAGES: Record<string, string> = {
  "/crm": "/crm/index.html",
  "/crm/": "/crm/index.html",
  "/crm/klienti": "/crm/klienti.html",
  "/crm/klienti/": "/crm/klienti.html",
  "/crm/imoti": "/crm/imoti.html",
  "/crm/imoti/": "/crm/imoti.html",
  "/crm/brokeri": "/crm/brokeri.html",
  "/crm/brokeri/": "/crm/brokeri.html",
  "/crm/kalendar": "/crm/kalendar.html",
  "/crm/kalendar/": "/crm/kalendar.html",
  "/crm/kompanii": "/crm/kompanii.html",
  "/crm/kompanii/": "/crm/kompanii.html",
};

const CRM_REDIRECTS: Record<string, string> = {
  "/mobile/crm": "/crm",
  "/mobile/crm/": "/crm",
  "/mobile/crm/index.html": "/crm",
  "/mobile/crm/crm-nachalo.html": "/crm",
  "/mobile/crm/crm-klienti.html": "/crm/klienti",
  "/mobile/crm/crm-imoti.html": "/crm/imoti",
  "/mobile/crm/crm-brokeri.html": "/crm/brokeri",
  "/mobile/crm/crm-kalendar.html": "/crm/kalendar",
  "/mobile/crm/crm-kompanii.html": "/crm/kompanii",
  "/crm/crm-nachalo.html": "/crm",
  "/crm/crm-klienti.html": "/crm/klienti",
  "/crm/crm-imoti.html": "/crm/imoti",
  "/crm/crm-brokeri.html": "/crm/brokeri",
  "/crm/crm-kalendar.html": "/crm/kalendar",
  "/crm/crm-kompanii.html": "/crm/kompanii",
};

function crmRedirectLocation(pathname: string): string | null {
  if (CRM_REDIRECTS[pathname]) return CRM_REDIRECTS[pathname];
  if (pathname.startsWith("/mobile/crm/assets/")) {
    return `/crm/assets/${pathname.slice("/mobile/crm/assets/".length)}`;
  }
  return null;
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      const redirectTo = crmRedirectLocation(url.pathname);
      if (redirectTo) {
        url.pathname = redirectTo;
        return Response.redirect(url, 308);
      }

      const staticCrm = CRM_STATIC_PAGES[url.pathname];
      if (staticCrm && (request.method === "GET" || request.method === "HEAD")) {
        const assetUrl = new URL(staticCrm, url.origin);
        const assetRequest = new Request(assetUrl, {
          method: request.method,
          headers: request.headers,
        });
        const handler = await getServerEntry();
        return await handler.fetch(assetRequest, env, ctx);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
