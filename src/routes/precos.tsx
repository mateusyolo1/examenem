import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/precos")({
  head: () => ({
    meta: [
      { title: "Preços — Exame ENEM" },
      {
        name: "description",
        content:
          "Use o Exame ENEM gratuitamente para questões, simulados e cronograma. Desbloqueie o tutor de IA e a correção de redação por R$ 25/mês.",
      },
      { property: "og:title", content: "Preços — Exame ENEM" },
      {
        property: "og:description",
        content:
          "Plano gratuito com todo o essencial. Assinatura de IA por R$ 25/mês, cancelável a qualquer momento.",
      },
      { property: "og:url", content: "https://examenem.today/precos" },
    ],
    links: [{ rel: "canonical", href: "https://examenem.today/precos" }],
  }),
  component: PrecosPage,
});

function PrecosPage() {
  const { openCheckout, loading } = usePaddleCheckout();
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async () => {
    if (subscribing) return;
    setSubscribing(true);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        const next = encodeURIComponent("/precos?checkout=1");
        window.location.href = `/auth?next=${next}`;
        return;
      }
      await openCheckout({
        priceId: "ai_access_monthly",
        customerEmail: user.email ?? undefined,
        customData: { userId: user.id },
        successUrl: `${window.location.origin}/?checkout=success`,
      });
    } finally {
      setSubscribing(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("checkout") === "1") {
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.pathname + url.search);
      handleSubscribe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
          <Link to="/inicio" className="font-extrabold text-lg tracking-tighter uppercase">
            Exame.
          </Link>
          <nav className="flex items-center gap-4 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            <Link to="/precos" className="text-foreground">Preços</Link>
            <Link to="/termos" className="hover:text-foreground">Termos</Link>
            <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
            <Link to="/reembolso" className="hover:text-foreground">Reembolso</Link>
          </nav>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
        <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Planos e preços
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
          Comece grátis. Desbloqueie a IA quando precisar.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          Todo o essencial para estudar para o ENEM sem pagar nada. Os recursos
          de inteligência artificial ficam em um plano opcional, cancelável a
          qualquer momento.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-10 grid gap-6 md:grid-cols-2">
        <PlanCard
          badge="Grátis"
          title="Estudo Base"
          price="R$ 0"
          suffix="para sempre"
          description="Todo o essencial para se preparar de forma consistente até a prova."
          features={[
            "Banco de questões do ENEM (2009–2025)",
            "Simulados por área e provas reais",
            "Cronograma personalizado até a prova",
            "Revisão de erros e progresso salvo na nuvem",
            "Mapas mentais, resumos e flashcards básicos",
          ]}
          ctaLabel="Começar grátis"
          ctaTo="/auth"
        />

        <PlanCard
          highlighted
          badge="IA · Assinatura"
          title="Exame IA"
          price="R$ 25"
          suffix="por mês"
          description="Adiciona a inteligência artificial em cima de tudo do plano gratuito."
          features={[
            "Tutor de IA ilimitado (dúvidas, aulas, resolução guiada)",
            "Correção de redação com nota por competência e feedback",
            "Planos de redação e resumos gerados por IA",
            "Flashcards e quizzes gerados automaticamente",
            "Sugestões de vídeos personalizadas ao seu nível",
          ]}
          ctaLabel={subscribing || loading ? "Abrindo checkout..." : "Assinar por R$ 25/mês"}
          onCtaClick={handleSubscribe}
          ctaDisabled={subscribing || loading}
          note="Cobrança mensal recorrente processada pela Paddle. Cancele a qualquer momento."
        />
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-14">
        <div className="rounded-xl border border-border bg-muted/30 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 shrink-0">
            <Heart className="h-5 w-5 text-rose-500" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              Doações
            </div>
            <h2 className="mt-1 text-lg font-bold">Apoie o projeto (opcional)</h2>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              Doações são voluntárias e ajudam a manter a plataforma. Elas{" "}
              <strong>não desbloqueiam</strong> os recursos de inteligência
              artificial nem ampliam limites de uso — para isso existe a
              assinatura Exame IA acima.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <h2 className="text-xl font-bold tracking-tight mb-4">Perguntas frequentes</h2>
        <div className="space-y-3">
          <Faq q="Preciso de cartão para começar?">
            Não. O plano gratuito não exige cartão — basta entrar com o Google.
          </Faq>
          <Faq q="Como cancelo a assinatura?">
            Pela sua conta ou em{" "}
            <a href="https://paddle.net" target="_blank" rel="noopener noreferrer" className="text-primary underline">paddle.net</a>.
            O acesso continua até o fim do ciclo já pago.
          </Faq>
          <Faq q="Tem garantia de reembolso?">
            Sim, 30 dias para assinaturas. Veja a{" "}
            <Link to="/reembolso" className="text-primary underline">política de reembolso</Link>.
          </Faq>
          <Faq q="Quem processa os pagamentos?">
            Paddle.com, atuando como Merchant of Record. Não armazenamos dados
            de cartão.
          </Faq>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-[11px] font-mono uppercase tracking-widest text-muted-foreground flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} yolodesign · Exame ENEM</span>
          <div className="flex gap-4">
            <Link to="/termos" className="hover:text-foreground">Termos</Link>
            <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
            <Link to="/reembolso" className="hover:text-foreground">Reembolso</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function PlanCard({
  badge,
  title,
  price,
  suffix,
  description,
  features,
  ctaLabel,
  ctaTo,
  onCtaClick,
  ctaDisabled,
  note,
  highlighted,
}: {
  badge: string;
  title: string;
  price: string;
  suffix: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaTo?: string;
  onCtaClick?: () => void;
  ctaDisabled?: boolean;
  note?: string;
  highlighted?: boolean;
}) {
  const ctaClass =
    "mt-6 inline-flex items-center justify-center min-h-11 px-6 rounded-md text-sm font-bold uppercase tracking-widest transition-opacity disabled:opacity-60 " +
    (highlighted
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : "bg-foreground text-background hover:opacity-90");
  return (
    <div
      className={
        "rounded-xl border p-6 flex flex-col " +
        (highlighted
          ? "border-primary bg-primary/[0.04] shadow-sm"
          : "border-border bg-card")
      }
    >
      <div className="flex items-center gap-2">
        {highlighted ? <Sparkles className="h-4 w-4 text-primary" aria-hidden /> : null}
        <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          {badge}
        </span>
      </div>
      <h3 className="mt-2 text-2xl font-bold tracking-tight">{title}</h3>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl font-extrabold tracking-tight">{price}</span>
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
      <ul className="mt-5 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {onCtaClick ? (
        <button
          type="button"
          onClick={onCtaClick}
          disabled={ctaDisabled}
          className={ctaClass}
        >
          {ctaLabel}
        </button>
      ) : (
        <Link to={ctaTo ?? "/auth"} className={ctaClass}>
          {ctaLabel}
        </Link>
      )}
      {note ? (
        <p className="mt-3 text-[11px] text-center text-muted-foreground leading-relaxed">
          {note}
        </p>
      ) : null}
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="rounded-lg border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm font-semibold">{q}</summary>
      <div className="mt-2 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </details>
  );
}
