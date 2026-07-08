import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Target } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SUBJECTS, SUBJECT_AREAS, type Subject } from "@/lib/subjects";
import { useSubjectStats, statFor } from "@/lib/subject-stats";
import { getTodayFocusTopics } from "@/lib/cronograma.functions";

export const Route = createFileRoute("/_authenticated/materias")({
  head: () => ({
    meta: [
      { title: "Matérias e Assuntos — Exame ENEM" },
      {
        name: "description",
        content:
          "Explore todas as matérias e assuntos do ENEM organizados por área: dificuldade, progresso, acertos e erros por tópico.",
      },
    ],
  }),
  component: MateriasPage,
});

type AreaFilter = (typeof SUBJECT_AREAS)[number]["id"] | "todas";

function matchesFocus(subject: Subject, topics: string[]): boolean {
  if (!topics.length) return false;
  const hay = `${subject.id} ${subject.name}`.toLowerCase();
  return topics.some((t) => {
    const needle = String(t).toLowerCase().trim();
    if (!needle) return false;
    return hay.includes(needle) || needle.includes(subject.id.toLowerCase());
  });
}

function MateriasPage() {
  const [filter, setFilter] = useState<AreaFilter>("todas");
  const [focusOnly, setFocusOnly] = useState(false);
  const { stats } = useSubjectStats();
  const fetchFocus = useServerFn(getTodayFocusTopics);
  const { data: focusData } = useQuery({
    queryKey: ["cronograma", "focus-topics", "today"],
    queryFn: () => fetchFocus(),
    staleTime: 60_000,
  });
  const focusTopics = focusData?.topics ?? [];
  const hasFocus = focusTopics.length > 0;

  const areaFiltered = useMemo(
    () => (filter === "todas" ? SUBJECTS : SUBJECTS.filter((s) => s.area === filter)),
    [filter],
  );
  const visible = useMemo(
    () => (focusOnly && hasFocus ? areaFiltered.filter((s) => matchesFocus(s, focusTopics)) : areaFiltered),
    [areaFiltered, focusOnly, hasFocus, focusTopics],
  );

  const grouped = SUBJECT_AREAS.map((a) => ({
    ...a,
    subjects: visible.filter((s) => s.area === a.id),
  })).filter((g) => g.subjects.length > 0);


  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Nav />

      <main className="max-w-7xl mx-auto px-6 py-10">
        <section className="mb-8 border-b border-border pb-6">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Catálogo de estudo
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">
            Matérias & Assuntos do ENEM
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Todo o conteúdo cobrado na prova, dividido por área. Filtre, monitore seu
            progresso por tópico e ataque pontos fracos.
          </p>
        </section>

        {hasFocus && (
          <section className="mb-8 rounded-2xl border border-blue-500/40 bg-blue-500/5 p-5">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Target size={20} />
              </div>
              <div className="flex-1 min-w-[220px]">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                  Recomendação do Professor
                </div>
                <div className="text-base font-bold mt-1">
                  Foque hoje nestes assuntos que você errou na Lousa:
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {focusTopics.map((t) => (
                    <span
                      key={t}
                      className="text-xs font-semibold px-2 py-1 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setFocusOnly((v) => !v)}
                className={
                  "text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-lg border transition-colors shrink-0 " +
                  (focusOnly
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-blue-500/40 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10")
                }
              >
                {focusOnly ? "Mostrar tudo" : "Só foco"}
              </button>
            </div>
          </section>
        )}

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          <FilterPill active={filter === "todas"} onClick={() => setFilter("todas")}>
            Todas ({SUBJECTS.length})
          </FilterPill>
          {SUBJECT_AREAS.map((a) => {
            const n = SUBJECTS.filter((s) => s.area === a.id).length;
            return (
              <FilterPill
                key={a.id}
                active={filter === a.id}
                onClick={() => setFilter(a.id)}
              >
                {a.short} ({n})
              </FilterPill>
            );
          })}
        </div>

        {grouped.map((g) => (
          <section key={g.id} className="mb-12">
            <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
              <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
                {g.label}
              </h2>
              <span className="text-xs font-mono text-muted-foreground">
                {String(g.subjects.length).padStart(2, "0")} assuntos
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border">
              {g.subjects.map((s) => (
                <SubjectCard
                  key={s.id}
                  subject={s}
                  stat={statFor(stats, s.id)}
                  isFocus={matchesFocus(s, focusTopics)}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      <Footer />
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-bold uppercase tracking-widest px-4 py-2 border transition-colors ${
        active
          ? "bg-foreground text-background border-foreground"
          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SubjectCard({
  subject,
  stat,
  isFocus,
}: {
  subject: Subject;
  stat: { correct: number; errors: number };
  isFocus?: boolean;
}) {
  const done = stat.correct + stat.errors;
  const progress = Math.min(
    100,
    Math.round((done / Math.max(subject.totalQuestions, 1)) * 100),
  );
  const accuracy = done ? Math.round((stat.correct / done) * 100) : 0;

  const diffColor =
    subject.difficulty === "Fácil"
      ? "text-primary border-primary/40"
      : subject.difficulty === "Médio"
        ? "text-foreground border-border"
        : "text-destructive border-destructive/40";

  const isRedacao = subject.area === "redacao";

  return (
    <div
      className={
        "bg-background p-6 flex flex-col min-h-[260px] relative " +
        (isFocus ? "ring-2 ring-blue-500/60 ring-inset" : "")
      }
    >
      {isFocus && (
        <span className="absolute top-2 right-2 text-[9px] font-mono uppercase tracking-widest px-2 py-1 rounded bg-blue-500 text-white flex items-center gap-1">
          <Target size={10} /> Foco
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-extrabold tracking-tight leading-tight">
          {subject.name}
        </h3>
        <span
          className={`text-[10px] font-mono uppercase px-2 py-1 border whitespace-nowrap ${diffColor}`}
        >
          {subject.difficulty}
        </span>
      </div>


      <div className="mt-5">
        <div className="flex justify-between text-[10px] font-mono uppercase text-muted-foreground mb-1.5">
          <span>Progresso</span>
          <span>
            {done}/{subject.totalQuestions}
          </span>
        </div>
        <div className="h-1.5 bg-border">
          <div
            className="h-full bg-foreground transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-5">
        <Metric label="Total" value={subject.totalQuestions} />
        <Metric label="Acertos" value={stat.correct} accent />
        <Metric label="Erros" value={stat.errors} />
      </div>

      <div className="mt-2 text-[10px] font-mono uppercase text-muted-foreground">
        Taxa: <span className="text-foreground font-bold">{accuracy}%</span>
      </div>

      <div className="mt-auto pt-6">
        <Link
          to={isRedacao ? "/redacao" : "/questoes"}
          search={isRedacao ? undefined : { area: subject.area }}
          className="inline-flex items-center justify-center w-full bg-foreground text-background py-3 font-bold text-xs uppercase tracking-widest hover:bg-primary transition-colors"
        >
          Estudar →
        </Link>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="border border-border p-2">
      <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
      <div
        className={`text-base font-extrabold tracking-tight ${
          accent ? "text-primary" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
