import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Typed wrapper around the beta supabase.auth.oauth namespace.
type AuthzDetails = {
  client?: { name?: string; client_id?: string };
  redirect_url?: string;
  redirect_to?: string;
};
type OauthApi = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
};
const oauth = (
  supabase.auth as unknown as { oauth: OauthApi }
).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id:
      typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get(
      "authorization_id",
    )!;
    const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen grid place-items-center bg-background p-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-lg font-bold">Não foi possível carregar</h1>
        <p className="text-sm text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData() as AuthzDetails | null;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Nenhum redirect retornado pelo servidor.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "esse aplicativo";

  return (
    <main className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 border border-border rounded-xl p-6 bg-card shadow-sm">
        <div className="space-y-2 text-center">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Autorização
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            Conectar {clientName} à sua conta Exame ENEM?
          </h1>
          <p className="text-sm text-muted-foreground">
            Ao aprovar, {clientName} poderá ler e atualizar seu plano de
            estudos em seu nome.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 text-center">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            className="px-4 py-2 rounded-md border border-border text-sm font-semibold hover:bg-muted disabled:opacity-60"
          >
            Recusar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            className="px-4 py-2 rounded-md bg-foreground text-background text-sm font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Enviando…" : "Aprovar"}
          </button>
        </div>
      </div>
    </main>
  );
}
