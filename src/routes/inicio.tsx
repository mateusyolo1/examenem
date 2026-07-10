import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronDown,
  FileText,
  GraduationCap,
  LineChart,
  Mail,
  MapPin,
  MessageSquare,
  PenLine,
  Phone,
  Play,
  Shield,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  Youtube,
  Zap,
} from "lucide-react";
import heroImage from "@/assets/landing-hero.jpg";
import aboutImage from "@/assets/landing-about.jpg";
import methodImage from "@/assets/landing-method.jpg";
import studentImage from "@/assets/landing-student.jpg";
import avatarAna from "@/assets/avatar-ana.jpg";
import avatarLucas from "@/assets/avatar-lucas.jpg";
import avatarJulia from "@/assets/avatar-julia.jpg";

export const Route = createFileRoute("/inicio")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Exame ENEM — Plataforma oficial de preparação para o ENEM" },
      {
        name: "description",
        content:
          "Cronograma inteligente, redação corrigida por IA, simulados oficiais e tutor 24h. A plataforma que transforma sua rotina de estudos em aprovação.",
      },
      { property: "og:title", content: "Exame ENEM — Plataforma oficial de preparação para o ENEM" },
      {
        property: "og:description",
        content:
          "Cronograma inteligente, redação corrigida por IA, simulados oficiais e tutor 24h. Estude com método e passe no ENEM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

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

  const tabs = [
    {
      key: "Diagnóstico personalizado",
      title:
        "Antes do primeiro estudo, entendemos exatamente onde você está — e onde precisa chegar.",
      bullets: [
        {
          h: "Mapeamento por área do conhecimento",
          p: "Um teste inicial identifica seu nível em Linguagens, Ciências Humanas, Naturais e Matemática — sem achismo.",
        },
        {
          h: "Meta calculada a partir da sua data de prova",
          p: "O cronograma é regressivo: o algoritmo distribui conteúdos, revisões e simulados até o dia do ENEM.",
        },
        {
          h: "Ajuste contínuo",
          p: "Cada questão respondida realimenta o plano. Se você melhora em Química, o tempo migra para o que ainda falta.",
        },
      ],
    },
    {
      key: "Redação com IA",
      title:
        "Correção nota-por-nota nas 5 competências, com o mesmo rigor de um corretor treinado pelo INEP.",
      bullets: [
        {
          h: "Feedback em minutos",
          p: "Você escreve, envia e recebe a devolutiva completa com pontos fortes, falhas e sugestões de reescrita.",
        },
        {
          h: "Banco de temas atualizados",
          p: "Mais de 200 propostas seguindo o padrão do ENEM, com repertórios sociológicos, filosóficos e culturais prontos.",
        },
        {
          h: "Histórico de evolução",
          p: "Acompanhe sua nota média por competência ao longo dos meses e veja onde o esforço rendeu.",
        },
      ],
    },
    {
      key: "Simulados oficiais",
      title:
        "Prove sua nota antes do dia da prova, com provas anteriores completas e gabarito comentado.",
      bullets: [
        {
          h: "Provas oficiais desde 2009",
          p: "Todo o acervo do ENEM organizado por área, ano e habilidade da matriz de referência.",
        },
        {
          h: "TRI real, não estimada",
          p: "Sua nota é calculada usando o mesmo modelo estatístico oficial (Teoria de Resposta ao Item).",
        },
        {
          h: "Relatório por habilidade",
          p: "Descubra quais das 30 habilidades você domina e quais precisam de mais uma volta de estudo.",
        },
      ],
    },
  ];

  const services = [
    {
      icon: Calendar,
      title: "Cronograma inteligente",
      subtitle: "Planejamento adaptativo",
      desc: "Um plano diário que se recalcula sozinho conforme seu desempenho, seu tempo disponível e a data da prova.",
    },
    {
      icon: PenLine,
      title: "Redação corrigida por IA",
      subtitle: "5 competências, minutos",
      desc: "Envie sua redação e receba devolutiva completa, comentários linha a linha e sugestão de reescrita.",
    },
    {
      icon: FileText,
      title: "Simulados oficiais",
      subtitle: "Provas anteriores completas",
      desc: "Provas do ENEM desde 2009, com correção TRI e relatório detalhado por habilidade.",
    },
    {
      icon: Brain,
      title: "Revisão espaçada",
      subtitle: "Aprendizado que gruda",
      desc: "As questões que você errou voltam no momento exato em que o cérebro precisa revê-las — método científico.",
    },
    {
      icon: MessageSquare,
      title: "Tutor IA 24 horas",
      subtitle: "Dúvida na hora",
      desc: "Um tutor treinado no conteúdo do ENEM responde suas dúvidas com explicação passo a passo, a qualquer hora.",
    },
    {
      icon: Youtube,
      title: "Hub de estudos",
      subtitle: "Vídeo em conhecimento",
      desc: "Transforme aulas do YouTube em resumos, flashcards e mapas mentais navegáveis em segundos.",
    },
  ];

  const cases = [
    {
      name: "Ana Clara",
      course: "Medicina · UFMG",
      score: "820",
      metric: "Nota redação",
      avatar: avatarAna,
      quote:
        "Segui o cronograma à risca por 6 meses. A correção de redação por IA me deu o feedback que eu nunca tive em cursinho tradicional.",
    },
    {
      name: "Lucas Meireles",
      course: "Direito · USP",
      score: "940",
      metric: "Redação",
      avatar: avatarLucas,
      quote:
        "O que mudou o jogo foi o simulado com TRI. Eu chegava na prova real sabendo exatamente qual era a minha nota provável.",
    },
    {
      name: "Julia Ribeiro",
      course: "Engenharia · UNICAMP",
      score: "780",
      metric: "Média geral",
      avatar: avatarJulia,
      quote:
        "Estudei 4 meses focada no que realmente caía. O tutor 24h tirou dúvida às 2h da manhã na véspera da prova.",
    },
  ];

  const carouselMetrics = [
    { n: "+42%", label: "Aumento médio de nota", desc: "Alunos que seguiram o cronograma por 90 dias" },
    { n: "94%", label: "Aderência ao plano", desc: "Estudantes ativos após o primeiro mês" },
    { n: "8.4", label: "Nota média de redação", desc: "Depois de 20+ correções pela IA" },
    { n: "+120", label: "Pontos TRI", desc: "Evolução em Ciências da Natureza em 4 meses" },
    { n: "37%", label: "Menos tempo perdido", desc: "Comparado a rotinas sem planejamento" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ============ NAVBAR ============ */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link to="/inicio" className="flex items-center gap-2 font-extrabold text-2xl tracking-tighter uppercase shrink-0">
            <GraduationCap size={22} className="text-primary" />
            Exame.
          </Link>
          <nav className="hidden lg:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#recursos" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
              Recursos <ChevronDown size={14} />
            </a>
            <a href="#metodo" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
              Metodologia <ChevronDown size={14} />
            </a>
            <a href="#cases" className="hover:text-foreground transition-colors">
              Aprovados
            </a>
            <a href="#sobre" className="hover:text-foreground transition-colors">
              Sobre
            </a>
            <a href="#faq" className="hover:text-foreground transition-colors">
              Ajuda
            </a>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            {signedIn ? (
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
              >
                Ir para o app <ArrowRight size={14} />
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
                  Criar conta <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold uppercase tracking-widest">
                <Sparkles size={12} />
                ENEM 2026 · Matrículas abertas
              </div>
              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-0.5 text-primary">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={13} fill="currentColor" strokeWidth={0} />
                  ))}
                </div>
                <span className="font-mono">4.6/5 · +2.000 estudantes</span>
              </div>
            </div>

            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Plataforma digital de preparação · ENEM · Vestibulares
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter leading-[1.02]">
              A plataforma de estudos que a sua aprovação no ENEM precisa.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
              Cronograma inteligente, redação corrigida por IA e simulados oficiais em um só lugar.
              A gente organiza o método, você conquista a vaga.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-foreground text-background font-semibold rounded-md hover:opacity-90 transition-opacity"
              >
                Começar diagnóstico grátis
                <ArrowRight size={16} />
              </Link>
              <a
                href="#recursos"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-border text-foreground font-semibold rounded-md hover:bg-accent transition-colors"
              >
                <Play size={14} /> Conheça a plataforma
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-primary" /> Sem cartão
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-primary" /> Login com Google
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-primary" /> Cancele quando quiser
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/25 via-primary/10 to-transparent rounded-2xl blur-2xl" aria-hidden />
            <img
              src={heroImage}
              alt="Estudante focado se preparando para o ENEM"
              width={1600}
              height={1200}
              className="relative rounded-2xl border border-border shadow-2xl w-full h-auto object-cover aspect-[4/3]"
            />
            {/* Floating stat card */}
            <div className="absolute -bottom-6 -left-4 sm:left-6 bg-card border border-border rounded-xl p-4 shadow-xl max-w-[240px]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                  <TrendingUp size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-extrabold tracking-tight leading-none">+42%</div>
                  <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
                    Nota média em 90 dias
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ STATS STRIP ============ */}
      <section className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { n: "+10 mil", l: "Questões oficiais" },
            { n: "+2.000", l: "Estudantes ativos" },
            { n: "94%", l: "Aderência ao plano" },
            { n: "24/7", l: "Tutor IA disponível" },
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

      {/* ============ SERVICES / KEY RESOURCES ============ */}
      <section id="recursos" className="py-20 lg:py-28 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-16 mb-14">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-primary mb-3">
                Nossos recursos-chave
              </div>
              <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tighter leading-[1.05]">
                Tudo que você precisa para passar. Em um só lugar.
              </h2>
            </div>
            <p className="text-muted-foreground text-lg leading-relaxed self-end">
              Oferecemos um ecossistema completo para gerenciar sua rotina, aprofundar seus estudos
              e destacar seu preparo. Sem distrações, sem enrolação — apenas o que faz sua nota subir.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((f) => (
              <div
                key={f.title}
                className="group relative p-6 bg-card border border-border rounded-xl hover:border-foreground/40 transition-colors"
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary grid place-items-center mb-5">
                  <f.icon size={20} />
                </div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                  {f.subtitle}
                </div>
                <h3 className="font-bold text-lg mb-2 tracking-tight">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">{f.desc}</p>
                <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground opacity-70 group-hover:opacity-100 transition-opacity">
                  Saiba mais <ArrowUpRight size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CREDENTIALS / PARTNERSHIPS ============ */}
      <section className="py-20 lg:py-24 border-b border-border bg-secondary/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1fr_1.4fr] gap-10 items-start">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-primary mb-3">
                Compromisso institucional
              </div>
              <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tighter leading-[1.05] mb-4">
                Método alinhado à matriz oficial do INEP.
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Cada conteúdo, questão e correção segue as diretrizes da matriz de referência do
                ENEM. Nada de decoreba: você estuda o que a prova cobra.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 relative rounded-xl overflow-hidden border border-border aspect-[16/7]">
                <img
                  src={methodImage}
                  alt="Mesa de estudos organizada com laptop, caderno e materiais"
                  loading="lazy"
                  width={1024}
                  height={1024}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-foreground">
                  <Shield size={14} className="text-primary" /> Método validado pela matriz do INEP
                </div>
              </div>
              {[
                { icon: Award, title: "Matriz oficial do ENEM", desc: "Cobertura das 120 habilidades das 4 áreas do conhecimento." },
                { icon: Shield, title: "Correção TRI real", desc: "Simulados corrigidos com o mesmo modelo estatístico do INEP." },
                { icon: Users, title: "+2.000 estudantes", desc: "Uma comunidade de vestibulandos ativa em todo o Brasil." },
                { icon: Star, title: "4.6/5 em avaliação", desc: "Média de satisfação em pesquisas mensais com nossos alunos." },
              ].map((p) => (
                <div key={p.title} className="p-5 bg-background border border-border rounded-xl">
                  <p.icon size={22} className="text-primary mb-3" />
                  <div className="font-bold tracking-tight mb-1">{p.title}</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ METHODOLOGY TABS ============ */}
      <section id="metodo" className="py-20 lg:py-28 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <div className="text-xs font-mono uppercase tracking-widest text-primary mb-3">
              Metodologia
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tighter leading-[1.05]">
              A expertise certificada da Exame que faz a diferença.
            </h2>
          </div>

          <div className="grid lg:grid-cols-[280px_1fr] gap-6 lg:gap-12">
            {/* Tabs list */}
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible -mx-4 px-4 lg:mx-0 lg:px-0 pb-2 lg:pb-0">
              {tabs.map((t, i) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(i)}
                  className={`text-left px-4 py-4 rounded-xl border transition-all shrink-0 lg:shrink w-[220px] lg:w-full ${
                    activeTab === i
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card border-border text-foreground hover:border-foreground/40"
                  }`}
                >
                  <div className="text-[11px] font-mono uppercase tracking-widest opacity-70">
                    0{i + 1}
                  </div>
                  <div className="font-bold tracking-tight mt-1">{t.key}</div>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-6 lg:p-10 bg-card border border-border rounded-2xl">
              <p className="text-xl lg:text-2xl font-bold tracking-tight leading-snug mb-8">
                {tabs[activeTab].title}
              </p>
              <div className="grid md:grid-cols-3 gap-6">
                {tabs[activeTab].bullets.map((b) => (
                  <div key={b.h}>
                    <CheckCircle2 size={20} className="text-primary mb-3" />
                    <div className="font-bold tracking-tight mb-1.5">{b.h}</div>
                    <div className="text-sm text-muted-foreground leading-relaxed">{b.p}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CASES ============ */}
      <section id="cases" className="py-20 lg:py-28 border-b border-border bg-secondary/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="max-w-2xl">
              <div className="text-xs font-mono uppercase tracking-widest text-primary mb-3">
                Aprovados Exame
              </div>
              <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tighter leading-[1.05]">
                Histórias reais de quem estudou com método.
              </h2>
            </div>
            <a href="#" className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:opacity-70 transition-opacity">
              Ver todos os aprovados <ArrowUpRight size={14} />
            </a>
          </div>

          <div className="grid lg:grid-cols-[1fr_2fr] gap-4">
            <div className="relative rounded-2xl overflow-hidden border border-border min-h-[320px] lg:min-h-0">
              <img
                src={studentImage}
                alt="Estudante aprovada em universidade pública"
                loading="lazy"
                width={1024}
                height={1024}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-background">
                <div className="text-[11px] font-mono uppercase tracking-widest text-background/70 mb-2">
                  Aprovada · Turma 2025
                </div>
                <div className="text-2xl font-extrabold tracking-tighter leading-tight">
                  "Cheguei na prova sabendo exatamente qual seria minha nota."
                </div>
                <div className="text-sm text-background/80 mt-2">Beatriz L. · Medicina · UFRJ</div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {cases.map((c) => (
                <article key={c.name} className="p-6 bg-background border border-border rounded-2xl flex flex-col">
                  <div className="flex items-baseline gap-2 mb-6">
                    <div className="text-4xl font-extrabold tracking-tighter text-primary">{c.score}</div>
                    <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                      {c.metric}
                    </div>
                  </div>
                  <blockquote className="text-foreground leading-relaxed flex-1">
                    "{c.quote}"
                  </blockquote>
                  <footer className="mt-6 pt-4 border-t border-border flex items-center gap-3">
                    <img
                      src={c.avatar}
                      alt={c.name}
                      loading="lazy"
                      width={44}
                      height={44}
                      className="w-11 h-11 rounded-full object-cover border border-border shrink-0"
                    />
                    <div>
                      <div className="font-bold text-sm tracking-tight">{c.name}</div>
                      <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-0.5">
                        {c.course}
                      </div>
                    </div>
                  </footer>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ WHY US ============ */}
      <section className="py-20 lg:py-28 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-14">
            <div className="text-xs font-mono uppercase tracking-widest text-primary mb-3">
              Por que a Exame?
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tighter leading-[1.05] mb-4">
              A diferença de estudar com uma plataforma feita por quem entende o ENEM.
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Não somos um cursinho digital. Somos uma plataforma de método:
              tecnologia, dados e conteúdo trabalhando juntos pela sua nota.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: TrendingUp,
                title: "Resultado comprovado",
                desc: "Alunos que seguem o cronograma por 90 dias sobem em média 42% na nota do simulado. Números medidos, não prometidos.",
              },
              {
                icon: Zap,
                title: "Tecnologia de ponta",
                desc: "IA proprietária para correção de redação, tutor com contexto do ENEM e algoritmo de revisão espaçada baseado em ciência cognitiva.",
              },
              {
                icon: LineChart,
                title: "Transparência de dados",
                desc: "Você vê exatamente onde está e para onde vai. Métricas claras por área, habilidade e competência — sem relatório enrolado.",
              },
            ].map((f) => (
              <div key={f.title} className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary grid place-items-center">
                  <f.icon size={22} />
                </div>
                <h3 className="text-xl font-bold tracking-tight">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ RESULTS CAROUSEL ============ */}
      <section className="py-20 lg:py-28 border-b border-border bg-foreground text-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <div className="text-xs font-mono uppercase tracking-widest text-background/60 mb-3">
              Resultados que a Exame gerou
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tighter leading-[1.05]">
              Onde fizemos a diferença na jornada de quem estuda com a gente.
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {carouselMetrics.map((m) => (
              <div key={m.label} className="p-5 border border-background/15 rounded-xl">
                <div className="text-3xl font-extrabold tracking-tighter text-primary mb-2">
                  {m.n}
                </div>
                <div className="text-sm font-bold tracking-tight mb-1">{m.label}</div>
                <div className="text-xs text-background/60 leading-relaxed">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ ABOUT ============ */}
      <section id="sobre" className="py-20 lg:py-28 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1fr_1.2fr] gap-12 items-center">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-primary mb-3">
              Sobre a Exame
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tighter leading-[1.05] mb-6">
              O sucesso, feito da forma certa, passa por <span className="text-primary">método</span>.
            </h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                Como Exame, garantimos que o preparo do vestibulando esteja presente de forma
                consistente em todos os pontos de contato do estudo — do <span className="text-foreground font-semibold">cronograma diário</span> à
                <span className="text-foreground font-semibold"> correção de redação</span>, dos simulados oficiais ao <span className="text-foreground font-semibold">tutor 24h</span>.
              </p>
              <p>
                Nossa expertise em tecnologias modernas — IA aplicada à educação, análise TRI e
                revisão espaçada — é o que nos distingue de cursinhos comuns e oferece uma
                vantagem competitiva real para o seu ENEM.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-8 max-w-md">
              <div>
                <div className="text-3xl font-extrabold tracking-tighter">+2.000</div>
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-1">
                  Estudantes ativos
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold tracking-tighter">4.6/5</div>
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-1">
                  Nota de satisfação
                </div>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-bl from-primary/20 to-transparent rounded-2xl blur-2xl" aria-hidden />
            <img
              src={aboutImage}
              alt="Estudantes brasileiros estudando juntos em biblioteca universitária"
              loading="lazy"
              width={1024}
              height={1024}
              className="relative rounded-2xl border border-border shadow-xl w-full h-auto object-cover aspect-[5/4]"
            />
          </div>
        </div>
      </section>

      {/* ============ 3 STEPS + CTA ============ */}
      <section className="py-20 lg:py-28 border-b border-border bg-secondary/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-14">
            <div className="text-xs font-mono uppercase tracking-widest text-primary mb-3">
              Em apenas 3 passos
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tighter leading-[1.05]">
              Comece hoje sua jornada rumo à aprovação.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              { n: "01", icon: Target, title: "Diagnóstico", desc: "Você conta a data da prova e seu nível. A gente monta o cronograma sob medida." },
              { n: "02", icon: BookOpen, title: "Execução", desc: "Estude com o hub, resolva questões, envie redações e converse com o tutor IA." },
              { n: "03", icon: LineChart, title: "Progresso", desc: "Acompanhe métricas por área, mantenha o ritmo e chegue pronto na prova." },
            ].map((s) => (
              <div key={s.n} className="p-6 bg-background border border-border rounded-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-xs font-mono text-muted-foreground tracking-widest">{s.n}</span>
                  <div className="h-px flex-1 bg-border" />
                  <s.icon size={20} className="text-primary" />
                </div>
                <h3 className="text-xl font-bold tracking-tight mb-2">{s.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="p-8 lg:p-12 bg-foreground text-background rounded-2xl grid lg:grid-cols-[1.4fr_1fr] gap-8 items-center">
            <div>
              <h3 className="text-2xl lg:text-3xl font-extrabold tracking-tighter leading-tight mb-3">
                Conquiste sua vaga com a confiança de quem estudou com método.
              </h3>
              <p className="text-background/70 leading-relaxed">
                Passar no ENEM não exige só esforço, exige a estratégia certa. A Exame combina
                tecnologia e conteúdo para colocar você diante da sua aprovação — cuidando de todo
                o caminho, do primeiro simulado até o dia da prova.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-primary text-primary-foreground font-semibold rounded-md hover:opacity-90 transition-opacity"
              >
                Criar minha conta grátis <ArrowRight size={16} />
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center justify-center gap-2 px-6 py-4 border border-background/20 text-background font-semibold rounded-md hover:bg-background/10 transition-colors"
              >
                Já tenho conta · Entrar
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAQ / CONTACT MINI ============ */}
      <section id="faq" className="py-20 lg:py-28 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1fr_1.2fr] gap-12">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-primary mb-3">
              Perguntas frequentes
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tighter leading-[1.05] mb-4">
              As dúvidas mais comuns antes de começar.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Não encontrou o que procurava? Fale com nossa equipe pelo{" "}
              <a href="mailto:contato@exameenem.com.br" className="text-foreground underline underline-offset-2">
                contato@exameenem.com.br
              </a>
              .
            </p>
          </div>
          <div className="divide-y divide-border border-y border-border">
            {[
              { q: "A plataforma é realmente gratuita para começar?", a: "Sim. Você cria sua conta, faz o diagnóstico e recebe seu cronograma sem precisar de cartão. Planos pagos liberam recursos avançados." },
              { q: "A correção de redação é feita por professor ou por IA?", a: "Por IA proprietária treinada nos critérios oficiais do INEP. Você recebe devolutiva completa em minutos, com nota por competência." },
              { q: "Os simulados usam correção TRI real?", a: "Sim. Usamos o mesmo modelo estatístico do ENEM (Teoria de Resposta ao Item), então a nota reflete o que você tiraria na prova real." },
              { q: "Preciso instalar algum aplicativo?", a: "Não. A Exame roda direto no navegador do computador ou celular. Basta acessar e estudar." },
            ].map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none">
                  <span className="font-bold tracking-tight text-lg">{item.q}</span>
                  <ChevronDown size={20} className="shrink-0 text-muted-foreground group-open:rotate-180 transition-transform" />
                </summary>
                <p className="mt-3 text-muted-foreground leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-secondary/60 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10 mb-12">
            <div className="max-w-sm">
              <div className="flex items-center gap-2 font-extrabold text-2xl tracking-tighter uppercase mb-4">
                <GraduationCap size={22} className="text-primary" />
                Exame.
              </div>
              <p className="text-muted-foreground leading-relaxed mb-6">
                A Exame impulsiona a preparação sustentável para o ENEM de estudantes dedicados e
                orientados a resultado.
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-primary" /> contato@exameenem.com.br
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-primary" /> Seg – Sex · 09:00 às 18:00
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-primary" /> São Paulo, Brasil
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-foreground mb-4">
                Plataforma
              </div>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="#recursos" className="hover:text-foreground transition-colors">Cronograma inteligente</a></li>
                <li><a href="#recursos" className="hover:text-foreground transition-colors">Redação com IA</a></li>
                <li><a href="#recursos" className="hover:text-foreground transition-colors">Simulados oficiais</a></li>
                <li><a href="#recursos" className="hover:text-foreground transition-colors">Tutor 24h</a></li>
                <li><a href="#recursos" className="hover:text-foreground transition-colors">Hub de estudos</a></li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-foreground mb-4">
                Instituição
              </div>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="#sobre" className="hover:text-foreground transition-colors">Sobre a Exame</a></li>
                <li><a href="#metodo" className="hover:text-foreground transition-colors">Metodologia</a></li>
                <li><a href="#cases" className="hover:text-foreground transition-colors">Aprovados</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Carreiras</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Imprensa</a></li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-foreground mb-4">
                Suporte
              </div>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="#faq" className="hover:text-foreground transition-colors">Central de ajuda</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contato</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Política de privacidade</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Termos de uso</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Cookies</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              © {new Date().getFullYear()} Exame ENEM · Plataforma de preparação para o ENEM
            </div>
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Feito para quem vai passar.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
