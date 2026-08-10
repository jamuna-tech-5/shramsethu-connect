import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data?: AuthorizationDetails | null; error?: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data?: AuthorizationDetails | null; error?: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data?: AuthorizationDetails | null; error?: { message: string } | null }>;
};

type AuthorizationDetails = {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the Supabase client reads its session from localStorage.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data ?? null;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">Authorization request could not be loaded</h1>
        <p className="mt-2 text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "this app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <Logo size={34} withWordmark />
        <h1 className="mt-6 text-xl font-bold tracking-tight">Connect {clientName} to your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {clientName} is asking to use ShramSethu as you. It will be able to read your profile, GigScore,
          documents and income records through the app's tools.
        </p>
        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <Button disabled={busy} onClick={() => decide(true)} className="flex-1 rounded-xl gradient-primary text-white">
            Approve
          </Button>
          <Button disabled={busy} variant="outline" onClick={() => decide(false)} className="flex-1 rounded-xl">
            Deny
          </Button>
        </div>
      </div>
    </main>
  );
}
