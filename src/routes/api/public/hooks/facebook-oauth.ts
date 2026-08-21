import { createFileRoute } from "@tanstack/react-router";
import { exchangeFacebookCode, readFacebookState } from "@/lib/facebook-oauth.server";

function redirectTo(path: string) {
  return new Response(null, { status: 302, headers: { Location: path } });
}

export const Route = createFileRoute("/api/public/hooks/facebook-oauth")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const err = url.searchParams.get("error_description") || url.searchParams.get("error");
        const code = url.searchParams.get("code");
        const state = readFacebookState(url.searchParams.get("state"));
        const origin = state?.origin || url.origin;

        if (err) {
          return redirectTo(`${origin}/admin/distribute?facebook=error&reason=${encodeURIComponent(err)}`);
        }
        if (!code || !state) {
          return redirectTo(`${origin}/admin/distribute?facebook=error&reason=${encodeURIComponent("Невалиден Facebook отговор")}`);
        }
        try {
          await exchangeFacebookCode(code, state.origin, state.uid);
          return redirectTo(`${origin}/admin/distribute?facebook=ok`);
        } catch (e: any) {
          return redirectTo(
            `${origin}/admin/distribute?facebook=error&reason=${encodeURIComponent(e?.message ?? "Facebook свързването се провали")}`,
          );
        }
      },
    },
  },
});
