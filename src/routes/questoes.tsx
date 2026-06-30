import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AREAS, recordAnswer, type Area } from "@/lib/storage";
import { QUESTIONS, YEARS, questionsByArea } from "@/lib/questions-data";

const searchSchema = z.object({
  area: z.enum(["todas", "linguagens", "humanas", "natureza", "matematica"]).default("todas"),
  year: z.coerce.number().optional(),
});

export const Route = createFileRoute("/questoes")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Banco de Questões — Exame ENEM" },
      {
        name: "description",
        content:
          "Pratique questões reais do ENEM filtradas por área de conhecimento e ano de aplicação.",
      },
    ],
  }),
  component: Questoes,
});

function Questoes() {
  const { area, year } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const list = useMemo(() => questionsByArea(area, year), [area, year]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const q = list[index];

  function reset() {
    setSelected(null);
    setRevealed(false);
  }

  function confirm() {
    if (!q || !selected) return;
    recordAnswer(q.id, selected, selected === q.correct);
    setRevealed(true);
  }

  function next() {
    setIndex((i) => (i + 1) % list.length);
    reset();
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10 border-b border-border pb-6">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Banco de Questões
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">
            Treine no estilo do ENEM.
          </h1>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          <FilterChip
            label="Todas as áreas"
            active={area === "todas"}
            onClick={() => {
              navigate({ search: { area: "todas", year } });
              setIndex(0);
              reset();
            }}
          />
          {AREAS.map((a) => (
            <FilterChip
              key={a.id}
              label={a.short}
              active={area === a.id}
              onClick={() => {
                navigate({ search: { area: a.id as Area, year } });
                setIndex(0);
                reset();
              }}
            />
          ))}
          <div className="w-px bg-border mx-2" />
          <FilterChip
            label="Todos os anos"
            active={!year}
            onClick={() => {
              navigate({ search: { area, year: undefined } });
              setIndex(0);
              reset();
            }}
          />
          {YEARS.map((y) => (
            <FilterChip
              key={y}
              label={String(y)}
              active={year === y}
              onClick={() => {
                navigate({ search: { area, year: y } });
                setIndex(0);
                reset();
              }}
            />
          ))}
        </div>

        {!q ? (
          <div className="border border-border p-12 bg-card text-center">
            <p className="font-mono text-sm text-muted-foreground">
              Nenhuma questão encontrada com esses filtros.
            </p>
          </div>
        ) : (
          <article className="border border-border bg-card p-8 md:p-10">
            <div className="flex justify-between items-center mb-6 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              <span>
                {String(index + 1).padStart(2, "0")} / {String(list.length).padStart(2, "0")}
              </span>
              <span>
                {q.subject} · {q.year}
              </span>
            </div>

            <p className="text-lg md:text-xl leading-relaxed mb-8 whitespace-pre-wrap">
              {q.statement}
            </p>

            <div className="space-y-3">
              {q.alternatives.map((alt) => {
                const isSelected = selected === alt.key;
                const isCorrect = revealed && alt.key === q.correct;
                const isWrong = revealed && isSelected && alt.key !== q.correct;
                return (
                  <button
                    key={alt.key}
                    onClick={() => !revealed && setSelected(alt.key)}
                    disabled={revealed}
                    className={
                      "w-full text-left p-4 border transition-all flex items-start gap-4 " +
                      (isCorrect
                        ? "border-primary bg-primary/10"
                        : isWrong
                          ? "border-destructive bg-destructive/10"
                          : isSelected
                            ? "border-foreground bg-foreground/5"
                            : "border-border hover:border-foreground/40")
                    }
                  >
                    <span
                      className={
                        "size-7 shrink-0 flex items-center justify-center text-xs font-bold border " +
                        (isCorrect
                          ? "border-primary bg-primary text-primary-foreground"
                          : isWrong
                            ? "border-destructive bg-destructive text-destructive-foreground"
                            : isSelected
                              ? "border-foreground bg-foreground text-background"
                              : "border-border")
                      }
                    >
                      {alt.key}
                    </span>
                    <span className="pt-0.5">{alt.text}</span>
                  </button>
                );
              })}
            </div>

            {revealed && (
              <div className="mt-8 p-6 border-l-2 border-primary bg-background">
                <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-2">
                  Gabarito Comentado · Resposta correta: {q.correct}
                </span>
                <p className="text-sm leading-relaxed">{q.explanation}</p>
              </div>
            )}

            <div className="mt-8 pt-8 border-t border-border flex flex-wrap justify-between gap-3">
              <button
                onClick={next}
                className="px-6 py-3 border border-border font-bold text-xs uppercase tracking-widest hover:border-foreground transition-all"
              >
                Pular Questão
              </button>
              {!revealed ? (
                <button
                  onClick={confirm}
                  disabled={!selected}
                  className="px-8 py-3 bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Confirmar Resposta
                </button>
              ) : (
                <button
                  onClick={next}
                  className="px-8 py-3 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-widest hover:bg-foreground transition-all"
                >
                  Próxima Questão →
                </button>
              )}
            </div>
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "px-4 py-2 text-xs font-mono uppercase tracking-wider border transition-all " +
        (active
          ? "bg-foreground text-background border-foreground"
          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground")
      }
    >
      {label}
    </button>
  );
}
