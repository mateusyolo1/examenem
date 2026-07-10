import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  FileText,
  LineChart,
  PenLine,
  Sparkles,
  Target,
  Youtube,
  Zap,
} from "lucide-react";
import heroImage from "@/assets/landing-hero.jpg";

export const Route = createFileRoute("/inicio")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Exame ENEM — Sua aprovação começa aqui" },
      {
        name: "description",
        content:
          "Plataforma completa de estudos para o ENEM: cronograma inteligente, redação com IA, questões, simulados e revisão espaçada. Comece grátis.",
      },
      { property: "og:title", content: "Exame ENEM — Sua aprovação começa aqui" },
      {
        property: "og:description",
        content:
          "Cronograma inteligente, redação corrigida por IA, milhares de questões e simulados reais. Estude com método e passe no ENEM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSignedIn(!!data.session);
    });
    return () => {
      mounted = false;
    };
  }, []);



  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link to="/inicio" className="font-extrabold text-2xl tracking-tighter uppercase">
            Exame.
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#recursos" className="hover:text-foreground transition-colors">
              Recursos
            </a>
            <a href="#metodo" className="hover:text-foreground transition-colors">
              Método
            </a>
            <a href="#depoimentos" className="hover:text-foreground transition-colors">
              Resultados
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {signedIn ? (
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
              >
                Ir para o app
                <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="hidden sm:inline-flex items-center px-3 py-2 text-sm font-medium text-foreground hover:bg-accent rounded-md transition-colors"
                >
                  Entrar
                </Link>
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
                >
                  Criar conta
                  <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold uppercase tracking-widest">
              <Sparkles size={12} />
              ENEM 2026 · Vagas Abertas
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter leading-[1.05]">
              Sua aprovação no ENEM começa com <span className="text-primary">método</span>, não com sorte.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
              Cronograma inteligente, redação corrigida por IA, milhares de questões oficiais e revisão espaçada.
              Tudo em um único lugar, adaptado ao seu ritmo.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-foreground text-background font-semibold rounded-md hover:opacity-90 transition-opacity"
              >
                Começar grátis agora
                <ArrowRight size={16} />
              </Link>
              <a
                href="#recursos"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-border text-foreground font-semibold rounded-md hover:bg-accent transition-colors"
              >
                Ver recursos
              </a>
            </div>
            <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-primary" />
                Sem cartão
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-primary" />
                Login com Google
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-primary" />
                Cancele quando quiser
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 to-transparent rounded-2xl blur-2xl" aria-hidden />
            <img
              src={heroImage}
              alt="Estudante focado se preparando para o ENEM com laptop e caderno"
              width={1600}
              height={1200}
              className="relative rounded-2xl border border-border shadow-2xl w-full h-auto object-cover aspect-[4/3]"
            />
          </div>
        </div>
      </section>

      {/* Social proof / stats */}
      <section className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { n: "+10 mil", l: "Questões oficiais" },
            { n: "IA", l: "Corretora de redação" },
            { n: "24/7", l: "Tutor disponível" },
            { n: "100%", l: "Alinhado à matriz" },
          ].map((s) => (
            <div key={s.l} className="text-center lg:text-left">
              <div className="text-3xl lg:text-4xl font-extrabold tracking-tighter text-foreground">
                {s.n}
              </div>
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-1">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="py-20 lg:py-28 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-16">
            <div className="text-xs font-mono uppercase tracking-widest text-primary mb-3">
              Recursos
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tighter mb-4">
              Um ecossistema completo para a sua aprovação.
            </h2>
            <p className="text-muted-foreground text-lg">
              Cada ferramenta foi construída sob medida para o ENEM. Sem distrações, sem enrolação.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Calendar,
                title: "Cronograma Inteligente",
                desc: "Plano diário adaptado à data da sua prova, com metas e revisões automáticas.",
              },
              {
                icon: Youtube,
                title: "Hub de Estudos",
                desc: "Transforme vídeos do YouTube em resumos, flashcards e mapas mentais.",
              },
              {
                icon: PenLine,
                title: "Redação com IA",
                desc: "Envie sua redação e receba correção nota-por-nota nas 5 competências.",
              },
              {
                icon: FileText,
                title: "Simulados Reais",
                desc: "Provas oficiais anteriores do ENEM com gabarito comentado.",
              },
              {
                icon: Brain,
                title: "Revisão Espaçada",
                desc: "Erre uma vez, revise no momento certo. Aprendizado que gruda.",
              },
              {
                icon: Zap,
                title: "Tutor IA 24h",
                desc: "Dúvida às 3 da manhã? O tutor responde com explicações passo a passo.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="p-6 bg-card border border-border rounded-xl hover:border-foreground/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-md bg-primary/10 text-primary grid place-items-center mb-4">
                  <f.icon size={20} />
                </div>
                <h3 className="font-bold text-lg mb-2 tracking-tight">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Method */}
      <section id="metodo" className="py-20 lg:py-28 border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-16">
            <div className="text-xs font-mono uppercase tracking-widest text-primary mb-3">
              Método
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tighter mb-4">
              Três passos. Uma aprovação.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                n: "01",
                icon: Target,
                title: "Diagnóstico",
                desc: "Você conta a data da sua prova e seu nível. Montamos o cronograma ideal.",
              },
              {
                n: "02",
                icon: BookOpen,
                title: "Execução",
                desc: "Estude com o hub, resolva questões, envie redações e converse com o tutor.",
              },
              {
                n: "03",
                icon: LineChart,
                title: "Progresso",
                desc: "Acompanhe métricas por área, mantenha o streak e chegue pronto na prova.",
              },
            ].map((s) => (
              <div key={s.n} className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground tracking-widest">
                    {s.n}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                  <s.icon size={20} className="text-primary" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">{s.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="depoimentos" className="py-20 lg:py-28 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-16">
            <div className="text-xs font-mono uppercase tracking-widest text-primary mb-3">
              Quem estuda com a gente
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tighter mb-4">
              Resultado de quem escolheu método.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                q: "O cronograma me tirou da procrastinação. Sabia exatamente o que fazer todo dia.",
                a: "Ana C.",
                r: "Medicina · UFMG",
              },
              {
                q: "A correção de redação em minutos foi o que me fez tirar 940. Feedback direto ao ponto.",
                a: "Lucas M.",
                r: "Direito · USP",
              },
              {
                q: "Sem enrolação. Estudei 4 meses focado no que importava e passei na primeira tentativa.",
                a: "Julia R.",
                r: "Engenharia · UNICAMP",
              },
            ].map((t) => (
              <figure
                key={t.a}
                className="p-6 bg-card border border-border rounded-xl flex flex-col"
              >
                <blockquote className="text-foreground leading-relaxed flex-1">
                  “{t.q}”
                </blockquote>
                <figcaption className="mt-6 pt-4 border-t border-border">
                  <div className="font-semibold text-sm">{t.a}</div>
                  <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
                    {t.r}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tighter">
            A prova não espera. <br className="hidden sm:inline" />
            <span className="text-primary">Comece hoje.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Sua nota do ENEM é decidida nos meses que antecedem a prova. Cada dia sem método é um
            dia a menos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-foreground text-background font-semibold rounded-md hover:opacity-90 transition-opacity"
            >
              Criar minha conta grátis
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-border text-foreground font-semibold rounded-md hover:bg-accent transition-colors"
            >
              Já tenho conta · Entrar
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-extrabold text-xl tracking-tighter uppercase">Exame.</div>
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            © {new Date().getFullYear()} · Feito para quem vai passar.
          </div>
        </div>
      </footer>
    </div>
  );
}
