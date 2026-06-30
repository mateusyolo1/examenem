import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import {
  AREAS,
  useProgress,
  daysUntilExam,
  answersToday,
  areaStats,
  type Area,
} from "@/lib/storage";
import { QUESTION_AREA_MAP, QUESTIONS } from "@/lib/questions-data";
import { useReviews } from "@/lib/review";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel do Aluno — Exame ENEM" },
      {
        name: "description",
        content:
          "Painel de controle do estudante: streak, meta diária, acertos, progresso por área e próximas ações de estudo para o ENEM.",
      },
    ],
  }),
  component: Dashboard,
});

// Approx 1.5 min per question — keeps everything frontend-only.
const MIN_PER_QUESTION = 1.5;

function greet(): string {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function levelFor(correct: number): { label: string; idx: number; next: number } {
  const tiers = [
    { label: "Iniciante", min: 0 },
    { label: "Aprendiz", min: 5 },
    { label: "Intermediário", min: 15 },
    { label: "Avançado", min: 30 },
    { label: "Mestre", min: 60 },
  ];
  let idx = 0;
  for (let i = 0; i < tiers.length; i++) if (correct >= tiers[i].min) idx = i;
  const next = tiers[idx + 1]?.min ?? tiers[idx].min;
  return { label: tiers[idx].label, idx, next };
}

function Dashboard() {
  const { progress } = useProgress();

  const dias = daysUntilExam(progress.examDate);
  const hoje = answersToday(progress);
  const meta = progress.dailyGoal || 18;
  const pctMeta = Math.min(100, Math.round((hoje / meta) * 100));

  const startOfDay = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const todayEntries = Object.entries(progress.answers).filter(
    ([, a]) => a.at >= startOfDay,
  );
  const acertosHoje = todayEntries.filter(([, a]) => a.correct).length;
  const errosHoje = todayEntries.length - acertosHoje;
  const accuracyHoje = todayEntries.length
    ? Math.round((acertosHoje / todayEntries.length) * 100)
    : 0;

  const allEntries = Object.entries(progress.answers);
  const totalAns = allEntries.length;
  const totalCorrect = allEntries.filter(([, a]) => a.correct).length;
  const accuracyGeral = totalAns ? Math.round((totalCorrect / totalAns) * 100) : 0;
  const minutosHoje = Math.round(hoje * MIN_PER_QUESTION);

  // Per-area stats including redação
  const areaCards = AREAS.map((a, i) => {
    const s = areaStats(progress, a.id, QUESTION_AREA_MAP);
    const total = QUESTIONS.filter((q) => q.area === a.id).length;
    const lvl = levelFor(s.correct);
    return {
      ...a,
      idx: i,
      total,
      done: s.total,
      correct: s.correct,
      errors: s.total - s.correct,
      accuracy: s.accuracy,
      progress: total ? Math.min(100, Math.round((s.total / total) * 100)) : 0,
      level: lvl.label,
      to: "/questoes" as const,
      search: { area: a.id as Area },
    };
  });

  const essaysDone = progress.essays.length;
  const essayLvl = levelFor(essaysDone * 5); // each essay weighs more
  const redacaoCard = {
    label: "Redação",
    short: "Redação",
    accuracy: essaysDone ? 100 : 0,
    correct: essaysDone,
    errors: 0,
    progress: Math.min(100, essaysDone * 20),
    level: essayLvl.label,
    done: essaysDone,
    total: 5,
  };

  // Recommendation: weakest area with answers, else first area with no progress
  const withAns = areaCards.filter((a) => a.done > 0);
  const weak = withAns.sort((a, b) => a.accuracy - b.accuracy)[0];
  const untouched = areaCards.find((a) => a.done === 0);
  const reco = weak ?? untouched ?? areaCards[0];

  // Continue from last
  const lastEntry = allEntries.sort((a, b) => b[1].at - a[1].at)[0];
  const lastArea = lastEntry ? QUESTION_AREA_MAP[lastEntry[0]] : null;
  const lastAreaLabel = lastArea
    ? AREAS.find((a) => a.id === lastArea)?.short
    : "Linguagens";

  const wrongIds = allEntries.filter(([, a]) => !a.correct).length;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <Nav />

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Header strip */}
        <section className="animate-reveal mb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-border pb-6">
            <div>
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
                {new Date().toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">
                {greet()}, estudante.
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Faltam <span className="text-foreground font-bold">{dias}</span> dias para o
                ENEM. Cada questão conta.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                to="/questoes"
                className="bg-foreground text-background px-5 py-3 rounded-sm font-bold text-xs uppercase tracking-widest hover:bg-primary transition-colors"
              >
                Estudar agora
              </Link>
              <Link
                to="/simulados"
                className="border border-border px-5 py-3 rounded-sm font-bold text-xs uppercase tracking-widest hover:border-foreground transition-colors"
              >
                Simulado
              </Link>
            </div>
          </div>
        </section>

        {/* Stats grid */}
        <section className="animate-reveal mb-10">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-border border border-border">
            <Stat label="Streak" value={`${progress.streakDays}`} unit="dias" accent />
            <Stat
              label="Meta diária"
              value={`${hoje}/${meta}`}
              unit={`${pctMeta}%`}
              bar={pctMeta}
            />
            <Stat label="Questões hoje" value={`${hoje}`} unit="resp." />
            <Stat
              label="Acertos hoje"
              value={`${acertosHoje}`}
              unit={`${errosHoje} erros`}
            />
            <Stat label="Taxa geral" value={`${accuracyGeral}%`} unit={`${totalAns} resp.`} />
            <Stat
              label="Tempo hoje"
              value={`${minutosHoje}`}
              unit="min estudados"
            />
          </div>
        </section>

        {/* Recommendation + Quick actions */}
        <section className="animate-reveal mb-10 grid lg:grid-cols-3 gap-4">
          {/* Recommendation banner */}
          <div className="lg:col-span-3 bg-foreground text-background p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
                Próxima recomendação
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tighter mt-2">
                Foque em {reco.short} —{" "}
                <span className="text-primary">
                  {reco.done > 0 ? `${reco.accuracy}% de acerto` : "área ainda não treinada"}
                </span>
              </h2>
              <p className="text-xs opacity-70 mt-1 font-mono uppercase tracking-wider">
                {hoje >= meta
                  ? "Meta cumprida. Avance com questões extras."
                  : `Faltam ${meta - hoje} questões para bater a meta de hoje.`}
              </p>
            </div>
            <Link
              to="/questoes"
              search={{ area: reco.id as Area }}
              className="bg-primary text-primary-foreground px-6 py-3 font-bold text-xs uppercase tracking-widest hover:bg-background hover:text-foreground transition-colors whitespace-nowrap"
            >
              Treinar {reco.short} →
            </Link>
          </div>

          <Action
            to="/questoes"
            kicker="Retomar"
            title="Continuar de onde parei"
            sub={
              lastEntry
                ? `Última: ${lastAreaLabel} · ${new Date(lastEntry[1].at).toLocaleDateString("pt-BR")}`
                : "Comece sua primeira questão"
            }
          />
          <Action
            to="/questoes"
            kicker={`${wrongIds} erros`}
            title="Revisar erros"
            sub={
              wrongIds > 0
                ? "Refaça as questões que você errou"
                : "Sem erros registrados — bom trabalho"
            }
          />
          <Action
            to="/simulados"
            kicker="15 min"
            title="Simulado rápido"
            sub="Mini-prova cronometrada de múltiplas áreas"
          />
        </section>

        {/* Treinar redação card (wider) */}
        <section className="animate-reveal mb-12">
          <Link
            to="/redacao"
            className="block border border-border bg-card p-8 group hover:border-foreground transition-colors"
          >
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="flex-1 min-w-[260px]">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                  Treinar redação · {essaysDone} {essaysDone === 1 ? "envio" : "envios"}
                </span>
                <h3 className="text-2xl font-extrabold tracking-tighter mt-2">
                  Caminhos para combater a insegurança alimentar no Brasil
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Tema da semana · correção orientada por critérios oficiais do ENEM.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-foreground text-background px-5 py-3 font-bold text-xs uppercase tracking-widest group-hover:bg-primary transition-colors">
                Escrever agora →
              </div>
            </div>
          </Link>
        </section>

        {/* Areas of knowledge */}
        <section className="animate-reveal">
          <div className="flex items-center justify-between mb-6 border-b border-border pb-3">
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Áreas de conhecimento
            </h2>
            <span className="text-xs font-mono text-muted-foreground">05 / 05</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border">
            {areaCards.map((a) => (
              <AreaTile
                key={a.id}
                index={a.idx + 1}
                title={a.label}
                short={a.short}
                progress={a.progress}
                correct={a.correct}
                errors={a.errors}
                done={a.done}
                total={a.total}
                level={a.level}
                to="/questoes"
                search={a.search}
              />
            ))}
            {/* Redação tile */}
            <AreaTile
              index={5}
              title="Redação"
              short="Redação"
              progress={redacaoCard.progress}
              correct={redacaoCard.correct}
              errors={0}
              done={redacaoCard.done}
              total={redacaoCard.total}
              level={redacaoCard.level}
              to="/redacao"
              isEssay
            />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  bar,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  bar?: number;
  accent?: boolean;
}) {
  return (
    <div className="bg-background p-4 md:p-5 flex flex-col justify-between min-h-[110px]">
      <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <div className="mt-3">
        <div className="flex items-baseline gap-2">
          <span
            className={`text-3xl md:text-4xl font-extrabold tracking-tighter ${
              accent ? "text-primary" : ""
            }`}
          >
            {value}
          </span>
          {unit && (
            <span className="text-[10px] font-mono uppercase text-muted-foreground">
              {unit}
            </span>
          )}
        </div>
        {typeof bar === "number" && (
          <div className="h-1 bg-border mt-2">
            <div
              className="h-full bg-foreground transition-all"
              style={{ width: `${bar}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Action({
  to,
  kicker,
  title,
  sub,
}: {
  to: "/questoes" | "/simulados" | "/redacao";
  kicker: string;
  title: string;
  sub: string;
}) {
  return (
    <Link
      to={to}
      className="border border-border bg-card p-6 group hover:border-foreground transition-colors flex flex-col justify-between min-h-[160px]"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
          {kicker}
        </span>
        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
          →
        </span>
      </div>
      <div className="mt-6">
        <h3 className="text-xl font-extrabold tracking-tighter">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>
      </div>
    </Link>
  );
}

function AreaTile({
  index,
  title,
  short,
  progress,
  correct,
  errors,
  done,
  total,
  level,
  to,
  search,
  isEssay,
}: {
  index: number;
  title: string;
  short: string;
  progress: number;
  correct: number;
  errors: number;
  done: number;
  total: number;
  level: string;
  to: "/questoes" | "/redacao";
  search?: { area: Area };
  isEssay?: boolean;
}) {
  const Wrapper = to === "/redacao" ? RedacaoLink : QuestoesLink;
  return (
    <Wrapper search={search}>
      <div className="bg-background p-6 group hover:bg-card transition-colors h-full flex flex-col">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-mono text-muted-foreground">
              {String(index).padStart(2, "0")}.
            </div>
            <h3 className="text-2xl font-extrabold tracking-tighter mt-1">{title}</h3>
          </div>
          <span className="text-[10px] font-mono uppercase px-2 py-1 border border-border text-muted-foreground">
            {level}
          </span>
        </div>

        <div className="mt-5">
          <div className="flex justify-between text-[10px] font-mono uppercase text-muted-foreground mb-1.5">
            <span>Progresso</span>
            <span>
              {done}/{total}
            </span>
          </div>
          <div className="h-1.5 bg-border">
            <div
              className="h-full bg-foreground transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-5 text-xs font-mono">
          <Metric label="Acertos" value={correct} />
          <Metric label={isEssay ? "Envios" : "Erros"} value={isEssay ? done : errors} />
          <Metric label="%" value={done ? Math.round((correct / Math.max(done, 1)) * 100) : 0} />
        </div>

        <div className="mt-auto pt-6">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest group-hover:text-primary transition-colors">
            {isEssay ? "Escrever" : `Estudar ${short}`} →
          </span>
        </div>
      </div>
    </Wrapper>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border p-2">
      <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
      <div className="text-base font-extrabold tracking-tight">{value}</div>
    </div>
  );
}

function QuestoesLink({
  search,
  children,
}: {
  search?: { area: Area };
  children: React.ReactNode;
}) {
  return (
    <Link to="/questoes" search={search} className="block">
      {children}
    </Link>
  );
}

function RedacaoLink({ children }: { children: React.ReactNode; search?: { area: Area } }) {
  return (
    <Link to="/redacao" className="block">
      {children}
    </Link>
  );
}
