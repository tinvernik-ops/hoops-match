import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// The `supabase.auth.oauth` namespace is currently in beta and not in the
// generated types. Keep a tiny local typed wrapper for the three methods.
type OAuthAuthorizationDetails = {
  client?: { name?: string; client_id?: string; redirect_uris?: string[] } | null;
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
} | null;

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthAuthorizationDetails; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
};

function oauth(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      try {
        sessionStorage.setItem("pending_oauth_consent", next);
      } catch {
        /* ignore */
      }
      throw redirect({ to: "/auth" });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) {
      window.location.href = immediate;
      throw redirect({ to: "/" });
    }
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Couldn't load this authorization request</h1>
        <p className="mt-2 text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "deny");
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(null);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(null);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";
  const scopes = (details?.scope ?? "").split(/\s+/).filter(Boolean);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🏀</div>
          <h1 className="text-display text-3xl font-bold text-primary">Connect {clientName}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            This lets <span className="font-semibold text-foreground">{clientName}</span> use Hoops as you.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-3 mb-6">
          <div className="text-sm">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">Identity</div>
            <div className="mt-1">Share your Hoops profile (username, ratings, location)</div>
          </div>
          <div className="text-sm">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">Actions</div>
            <div className="mt-1">Read your leagues, nearby hoopers, and courts</div>
          </div>
          {scopes.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Requested scopes: {scopes.join(", ")}
            </div>
          )}
          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            App permissions and backend policies still control what data is accessible.
          </p>
        </div>

        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive text-center">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={busy !== null}
            onClick={() => decide(false)}
          >
            {busy === "deny" ? <Loader2 className="animate-spin" /> : "Cancel"}
          </Button>
          <Button
            className="flex-1 font-bold"
            disabled={busy !== null}
            onClick={() => decide(true)}
          >
            {busy === "approve" ? <Loader2 className="animate-spin" /> : "Approve"}
          </Button>
        </div>
      </div>
    </main>
  );
}
