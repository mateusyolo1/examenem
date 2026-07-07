import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SUBJECTS, SUBJECT_AREAS, type Subject } from "@/lib/subjects";
import { useSubjectStats, statFor } from "@/lib/subject-stats";

export const Route = createFileRoute("/materias")({
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

function MateriasPage() {
  const [filter, setFilter] = useState<AreaFilter>("todas");
  const { stats } = useSubjectStats();

  const visible =
    filter === "todas" ? SUBJECTS : SUBJECTS.filter((s) => s.area === filter);

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
                <SubjectCard key={s.id} subject={s} stat={statFor(stats, s.id)} />
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
}: {
  subject: Subject;
  stat: { correct: number; errors: number };
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
    <div className="bg-background p-6 flex flex-col min-h-[260px]">
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
