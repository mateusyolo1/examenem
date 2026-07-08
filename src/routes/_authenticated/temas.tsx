import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import {
  CATEGORIAS,
  CATEGORY_COLORS,
  ESSAY_THEMES,
  type EssayCategory,
  type EssayTheme,
} from "@/lib/essay-themes";
import { generateEssayPlan, type EssayPlan } from "@/lib/essay-plan.functions";

const searchSchema = z.object({
  cat: z.string().optional(),
  open: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/temas")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Temas de Redação ENEM — Banco de propostas" },
      {
        name: "description",
        content:
          "Banco de temas de redação para o ENEM com textos motivadores, repertórios, argumentos e propostas de intervenção.",
      },
    ],
  }),
  component: TemasPage,
});

function TemasPage() {
  const { cat } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const activeCat = (cat ?? "Todos") as EssayCategory | "Todos";
  const filtered =
    activeCat === "Todos"
      ? ESSAY_THEMES
      : ESSAY_THEMES.filter((t) => t.categoria === activeCat);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Nav />
      <main className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-8 border-b border-border pb-6">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Banco de Temas
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">
            Temas de Redação.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            Propostas inspiradas no ENEM, com textos motivadores, repertórios e
            sugestões de argumentos e intervenção.
          </p>
        </header>

        {/* Categorias */}
        <div className="flex flex-wrap gap-2 mb-8">
          <CategoryChip
            label="Todos"
            active={activeCat === "Todos"}
            onClick={() => navigate({ search: {} })}
          />
          {CATEGORIAS.map((c) => (
            <CategoryChip
              key={c}
              label={c}
              color={CATEGORY_COLORS[c].bg}
              active={activeCat === c}
              onClick={() => navigate({ search: { cat: c } })}
            />
          ))}
        </div>

        <div className="grid gap-6">
          {filtered.map((t) => (
            <ThemeCard key={t.id} theme={t} />
          ))}
          {filtered.length === 0 && (
            <div className="text-sm text-muted-foreground font-mono">
              Nenhum tema nesta categoria ainda.
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={
        active && color
          ? { backgroundColor: color, borderColor: color, color: "#fff" }
          : color
            ? { borderColor: color, color }
            : undefined
      }
      className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest border transition-all ${
        active
          ? color
            ? ""
            : "bg-foreground text-background border-foreground"
          : color
            ? "hover:brightness-110"
            : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function ThemeCard({ theme }: { theme: EssayTheme }) {
  const [showRep, setShowRep] = useState(false);
  const [plan, setPlan] = useState<EssayPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const submitPlan = useServerFn(generateEssayPlan);

  async function handlePlan() {
    setPlanError(null);
    setLoadingPlan(true);
    try {
      const res = await submitPlan({
        data: { tema: theme.titulo, eixo: theme.eixo },
      });
      setPlan(res.plan as EssayPlan);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("429"))
        setPlanError("Muitas requisições. Tente novamente em instantes.");
      else if (msg.includes("402"))
        setPlanError("Créditos de IA esgotados. Adicione créditos ao workspace.");
      else setPlanError("Não foi possível gerar o plano agora.");
    } finally {
      setLoadingPlan(false);
    }
  }

  return (
    <article className="border border-border bg-card">
      <header className="p-6 border-b border-border">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
              {theme.categoria}
            </span>
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight mt-2 leading-tight">
              {theme.titulo}
            </h2>
            <p className="text-xs font-mono uppercase text-muted-foreground mt-2">
              Eixo · {theme.eixo}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/redacao"
              search={{ tema: theme.id }}
              className="px-4 py-2.5 bg-foreground text-background font-bold text-[11px] uppercase tracking-widest hover:bg-primary transition-all"
            >
              Escrever sobre este tema
            </Link>
            <button
              onClick={() => setShowRep((v) => !v)}
              className="px-4 py-2.5 border border-border font-bold text-[11px] uppercase tracking-widest hover:border-foreground transition-all"
            >
              {showRep ? "Ocultar repertórios" : "Ver repertórios"}
            </button>
            <button
              onClick={handlePlan}
              disabled={loadingPlan}
              className="px-4 py-2.5 border border-primary text-primary font-bold text-[11px] uppercase tracking-widest hover:bg-primary hover:text-background transition-all disabled:opacity-40"
            >
              {loadingPlan ? "Gerando..." : "Gerar plano de redação"}
            </button>
          </div>
        </div>
      </header>

      <div className="p-6 grid md:grid-cols-2 gap-6">
        <section>
          <SectionTitle>Textos motivadores</SectionTitle>
          <div className="space-y-3">
            {theme.textosMotivadores.map((m, i) => (
              <div key={i} className="border-l-2 border-primary pl-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                  {m.fonte}
                </div>
                <p className="text-sm leading-relaxed">{m.trecho}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle>Ideias para introdução</SectionTitle>
          <ul className="space-y-2 text-sm">
            {theme.ideiasIntroducao.map((i, k) => (
              <li key={k} className="flex gap-2">
                <span className="text-primary font-mono">→</span>
                <span>{i}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionTitle>Possíveis argumentos</SectionTitle>
          <ul className="space-y-2 text-sm">
            {theme.argumentos.map((a, k) => (
              <li key={k} className="flex gap-2">
                <span className="text-primary font-mono">{k + 1}.</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionTitle>Propostas de intervenção</SectionTitle>
          <ul className="space-y-2 text-sm">
            {theme.propostasIntervencao.map((p, k) => (
              <li key={k} className="flex gap-2">
                <span className="text-primary font-mono">★</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {showRep && (
        <section className="px-6 pb-6">
          <SectionTitle>Repertórios sugeridos</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {theme.repertorios.map((r, k) => (
              <span
                key={k}
                className="px-3 py-1.5 text-xs border border-border bg-background font-medium"
              >
                {r}
              </span>
            ))}
          </div>
        </section>
      )}

      {planError && (
        <div className="mx-6 mb-6 p-3 border border-destructive bg-destructive/10 text-destructive text-xs font-mono">
          {planError}
        </div>
      )}

      {plan && <PlanView plan={plan} />}
    </article>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-2 mb-3">
      {children}
    </h3>
  );
}

function PlanView({ plan }: { plan: EssayPlan }) {
  if (plan.raw) {
    return (
      <section className="mx-6 mb-6 p-4 border border-border bg-background">
        <SectionTitle>Plano de redação (bruto)</SectionTitle>
        <pre className="text-xs whitespace-pre-wrap font-mono">{plan.raw}</pre>
      </section>
    );
  }
  return (
    <section className="mx-6 mb-6 p-5 border border-primary/40 bg-primary/5">
      <SectionTitle>Plano de redação gerado</SectionTitle>
      <div className="space-y-4 text-sm">
        <Block label="Tese">{plan.tese}</Block>
        <Block label="Introdução">{plan.introducao}</Block>
        <Block label={`Argumento 1 — ${plan.argumento1?.topico ?? ""}`}>
          <p>{plan.argumento1?.desenvolvimento}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Repertório: {plan.argumento1?.repertorio}
          </p>
        </Block>
        <Block label={`Argumento 2 — ${plan.argumento2?.topico ?? ""}`}>
          <p>{plan.argumento2?.desenvolvimento}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Repertório: {plan.argumento2?.repertorio}
          </p>
        </Block>
        <Block label="Conclusão">{plan.conclusao}</Block>
        <Block label="Proposta de intervenção">
          <ul className="space-y-1 text-xs">
            <li><b>Agente:</b> {plan.propostaIntervencao?.agente}</li>
            <li><b>Ação:</b> {plan.propostaIntervencao?.acao}</li>
            <li><b>Meio:</b> {plan.propostaIntervencao?.meio}</li>
            <li><b>Finalidade:</b> {plan.propostaIntervencao?.finalidade}</li>
            <li><b>Detalhamento:</b> {plan.propostaIntervencao?.detalhamento}</li>
          </ul>
        </Block>
      </div>
    </section>
  );
}

function Block({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-primary mb-1">
        {label}
      </div>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
