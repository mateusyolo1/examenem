import { createFileRoute, Link } from "@tanstack/react-router";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AREAS, useProgress, daysUntilExam, answersToday, areaStats } from "@/lib/storage";
import { QUESTION_AREA_MAP, QUESTIONS } from "@/lib/questions-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Exame ENEM" },
      {
        name: "description",
        content:
          "Acompanhe seu progresso de estudo para o ENEM: meta diária, streak, áreas de conhecimento, simulados e redação.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { progress } = useProgress();
  const dias = daysUntilExam(progress.examDate);
  const hoje = answersToday(progress);
  const meta = progress.dailyGoal || 18;
  const pct = Math.min(100, Math.round((hoje / meta) * 100));

  // Pick "focus" area = lowest accuracy with at least 1 answer; fallback to Natureza
  const stats = AREAS.map((a) => ({ ...a, ...areaStats(progress, a.id, QUESTION_AREA_MAP) }));
  const withAnswers = stats.filter((s) => s.total > 0);
  const focus =
    withAnswers.sort((a, b) => a.accuracy - b.accuracy)[0]?.short ?? "Natureza";

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <Nav />

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero */}
        <section className="animate-reveal mb-16">
          <div className="grid md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-8">
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6 text-balance leading-[0.9]">
                Faltam {dias} dias para <span className="text-primary">vencer o ENEM.</span>
              </h1>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/questoes"
                  className="bg-foreground text-background px-8 py-4 rounded-full font-bold text-sm uppercase tracking-widest hover:bg-primary transition-all"
                >
                  Continuar Estudos
                </Link>
                <Link
                  to="/simulados"
                  className="border border-border px-8 py-4 rounded-full font-bold text-sm uppercase tracking-widest hover:border-foreground transition-all"
                >
                  Ver Simulados
                </Link>
              </div>
            </div>
            <div className="md:col-span-4 bg-card border border-border p-6 rounded-2xl shadow-sm">
              <div className="flex justify-between items-end mb-4">
                <span className="text-xs font-mono uppercase text-muted-foreground">
                  Meta Diária
                </span>
                <span className="text-2xl font-extrabold tracking-tight">{pct}%</span>
              </div>
              <div className="h-3 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                Você completou {hoje} das {meta} questões planejadas para hoje. Mantenha o foco em{" "}
                <span className="text-foreground font-semibold">{focus}</span>.
              </p>
            </div>
          </div>
        </section>

        {/* Knowledge Areas */}
        <section className="animate-reveal mb-16">
          <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Áreas de Conhecimento
            </h2>
            <span className="text-xs font-mono">04 / 04</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <Link
                key={s.id}
                to="/questoes"
                search={{ area: s.id }}
                className="group border border-border p-8 hover:border-foreground transition-all bg-card"
              >
                <div className="mb-12">
                  <div className="text-xs font-mono text-muted-foreground mb-1">
                    {String(i + 1).padStart(2, "0")}.
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">{s.label}</h3>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono uppercase text-muted-foreground">
                    {s.total > 0 ? `${s.accuracy}% acertos` : "Sem dados"}
                  </span>
                  <div className="size-2 bg-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Simulado + Redação */}
        <div className="grid lg:grid-cols-2 gap-8 animate-reveal">
          {/* Simulado */}
          <Link
            to="/simulados"
            className="relative bg-foreground text-background p-10 overflow-hidden block group"
          >
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-12">
                <div>
                  <span className="bg-primary text-[10px] font-bold uppercase tracking-widest px-2 py-1">
                    Simulado Cronometrado
                  </span>
                  <h3 className="text-4xl font-extrabold tracking-tighter mt-4">
                    Simulado {QUESTIONS.length} Questões
                  </h3>
                </div>
                <div className="text-right">
                  <div className="font-mono text-3xl font-medium tracking-tighter">03:45:00</div>
                  <span className="text-[10px] uppercase font-mono opacity-60">Tempo sugerido</span>
                </div>
              </div>
              <div className="w-full py-4 border border-background/20 group-hover:bg-background group-hover:text-foreground transition-all font-bold uppercase tracking-widest text-sm text-center">
                Iniciar Prova Agora
              </div>
            </div>
            <div className="absolute bottom-0 right-0 opacity-10 pointer-events-none">
              <div className="text-[120px] font-extrabold leading-none tracking-tighter select-none translate-y-8 translate-x-4">
                STOPWATCH
              </div>
            </div>
          </Link>

          {/* Redação */}
          <Link to="/redacao" className="border border-border p-10 bg-card block group">
            <div className="flex justify-between items-start mb-8">
              <h3 className="text-3xl font-extrabold tracking-tighter">Oficina de Redação</h3>
              <div className="bg-foreground text-background px-3 py-1 rounded-sm flex items-center gap-2">
                <span className="size-1.5 bg-primary rounded-full" />
                <span className="text-[10px] font-mono uppercase">IA Ativa</span>
              </div>
            </div>
            <div className="mb-8 p-6 bg-background border-l-2 border-primary">
              <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-2">
                Tema da Semana
              </span>
              <p className="font-bold text-lg leading-tight tracking-tight">
                Caminhos para combater a insegurança alimentar no cenário brasileiro contemporâneo.
              </p>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 bg-foreground text-background py-4 font-bold uppercase tracking-widest text-sm group-hover:bg-primary transition-colors text-center">
                Enviar Texto
              </div>
              <div className="px-6 py-4 border border-border group-hover:border-foreground transition-colors flex items-center">
                <span className="text-xs font-bold uppercase">Dicas</span>
              </div>
            </div>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
