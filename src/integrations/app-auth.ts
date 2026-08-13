import { supabase } from "@/integrations/supabase/client";

type OAuthProvider = "google" | "apple" | "azure";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export async function signInWithOAuth(provider: OAuthProvider, opts?: SignInOptions) {
  const redirectTo = opts?.redirect_uri ?? `${window.location.origin}/admin`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider === "azure" ? "azure" : provider,
    options: {
      redirectTo,
      queryParams: opts?.extraParams,
    },
  });
  if (error) return { error, redirected: false as const };
  if (data?.url) {
    window.location.assign(data.url);
    return { redirected: true as const, error: undefined };
  }
  return { redirected: false as const, error: undefined };
}
