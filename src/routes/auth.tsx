import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — Exame ENEM" },
      {
        name: "description",
        content: "Entre com Google para salvar seu progresso, plano de estudos e redações na nuvem.",
      },
    ],
  }),
  component: AuthPage,
});

function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const target = safeNext(next);
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        window.location.replace(target);
      } else {
        setChecking(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        window.location.replace(target);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate, next]);

  const signIn = async () => {
    setLoading(true);
    try {
      const { lovable } = await import("@/integrations/lovable");
      const target = safeNext(next);
      // Always return to /auth so onAuthStateChange can hydrate the session
      // before navigating. Returning to "/" directly caused a white screen on
      // published sites because the _authenticated gate ran getUser() before
      // Supabase parsed the OAuth tokens from the URL hash.
      const redirectUri = `${window.location.origin}/auth?next=${encodeURIComponent(target)}`;
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: redirectUri,
      });
      if (result.error) {
        toast.error("Não foi possível entrar", {
          description: result.error.message ?? "Tente novamente.",
        });
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      // Session set — onAuthStateChange will navigate.
    } catch (e) {
      toast.error("Erro ao entrar", {
        description: e instanceof Error ? e.message : String(e),
      });
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-sm text-muted-foreground font-mono uppercase tracking-widest">Carregando…</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-block font-extrabold text-4xl tracking-tighter uppercase">Exame.</div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Estude para o ENEM com o seu progresso na nuvem.
          </h1>
          <p className="text-sm text-muted-foreground">
            Entre com Google para sincronizar respostas, plano de estudos e redações entre dispositivos.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
          <button
            type="button"
            onClick={signIn}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-3 bg-foreground text-background font-semibold text-sm py-3 rounded-md hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <GoogleIcon />
            {loading ? "Abrindo…" : "Continuar com Google"}
          </button>
          <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
            Ao continuar, você concorda em salvar seu progresso de estudo na sua conta.
          </p>
        </div>

        <div className="text-center text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          Sem cadastro por email · Somente Google
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <Link to="/inicio" className="hover:text-foreground">Sobre</Link>
          <span className="opacity-30">·</span>
          <Link to="/precos" className="hover:text-foreground">Preços</Link>
          <span className="opacity-30">·</span>
          <Link to="/termos" className="hover:text-foreground">Termos</Link>
          <span className="opacity-30">·</span>
          <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
          <span className="opacity-30">·</span>
          <Link to="/reembolso" className="hover:text-foreground">Reembolso</Link>
        </nav>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 34.9 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8L6.2 33C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.2 5.2C41.4 35.5 44 30.1 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
