import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { QUESTIONS } from "@/lib/questions-data";
import { useProgress } from "@/lib/storage";

export const Route = createFileRoute("/simulados")({
  head: () => ({
    meta: [
      { title: "Simulados Cronometrados — Exame ENEM" },
      {
        name: "description",
        content:
          "Faça simulados cronometrados nos moldes do ENEM, com gabarito imediato e histórico de notas salvo localmente.",
      },
    ],
  }),
  component: Simulados,
});

const DURATIONS = [
  { id: "rapido", label: "Rápido", min: 15, questions: 5 },
  { id: "medio", label: "Médio", min: 45, questions: 10 },
  { id: "completo", label: "Completo", min: 90, questions: QUESTIONS.length },
];

function Simulados() {
  const { progress, update } = useProgress();
  const [mode, setMode] = useState<(typeof DURATIONS)[number] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [finished, setFinished] = useState<{ score: number; total: number } | null>(null);

  const selected = useMemo(() => {
    if (!mode) return [];
    return [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, mode.questions);
  }, [mode]);

  useEffect(() => {
    if (!mode || finished) return;
    setTimeLeft(mode.min * 60);
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          submit();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function submit() {
    const score = selected.filter((q) => answers[q.id] === q.correct).length;
    setFinished({ score, total: selected.length });
    update((p) => ({
      ...p,
      simulados: [
        ...p.simulados,
        { id: crypto.randomUUID(), score, total: selected.length, at: Date.now() },
      ],
    }));
  }

  function reset() {
    setMode(null);
    setAnswers({});
    setFinished(null);
  }

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10 border-b border-border pb-6">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Simulados
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">
            Treine sob pressão.
          </h1>
        </header>

        {!mode && !finished && (
          <>
            <div className="grid md:grid-cols-3 gap-4 mb-12">
              {DURATIONS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setMode(d)}
                  className="group border border-border p-8 bg-card hover:border-foreground transition-all text-left"
                >
                  <div className="text-xs font-mono text-muted-foreground mb-1">
                    {d.questions} Questões
                  </div>
                  <h3 className="text-3xl font-extrabold tracking-tighter">{d.label}</h3>
                  <div className="mt-12 flex justify-between items-end">
                    <span className="font-mono text-xl">{d.min} min</span>
                    <span className="text-xs font-bold uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Iniciar →
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {progress.simulados.length > 0 && (
              <section>
                <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-4 mb-6">
                  Histórico
                </h2>
                <div className="space-y-2">
                  {[...progress.simulados]
                    .reverse()
                    .slice(0, 10)
                    .map((s) => {
                      const pct = Math.round((s.score / s.total) * 100);
                      return (
                        <div
                          key={s.id}
                          className="flex justify-between items-center border border-border p-4 bg-card font-mono text-sm"
                        >
                          <span className="text-muted-foreground text-xs uppercase">
                            {new Date(s.at).toLocaleString("pt-BR")}
                          </span>
                          <span className="font-bold">
                            {s.score}/{s.total}{" "}
                            <span className="text-primary">({pct}%)</span>
                          </span>
                        </div>
                      );
                    })}
                </div>
              </section>
            )}
          </>
        )}

        {mode && !finished && (
          <>
            <div className="sticky top-16 z-40 -mx-6 px-6 py-4 bg-background/90 backdrop-blur-md border-b border-border mb-8 flex justify-between items-center">
              <span className="text-xs font-mono uppercase text-muted-foreground">
                Simulado {mode.label} · {selected.length} questões
              </span>
              <span className="font-mono text-2xl font-extrabold tracking-tighter text-primary">
                {mm}:{ss}
              </span>
            </div>

            <div className="space-y-10">
              {selected.map((q, i) => (
                <article key={q.id} className="border border-border bg-card p-8">
                  <div className="text-xs font-mono uppercase text-muted-foreground mb-4">
                    Questão {i + 1} · {q.subject} · {q.year}
                  </div>
                  <p className="text-base leading-relaxed mb-6 whitespace-pre-wrap">
                    {q.statement}
                  </p>
                  <div className="space-y-2">
                    {q.alternatives.map((alt) => {
                      const isSelected = answers[q.id] === alt.key;
                      return (
                        <button
                          key={alt.key}
                          onClick={() =>
                            setAnswers((prev) => ({ ...prev, [q.id]: alt.key }))
                          }
                          className={
                            "w-full text-left p-3 border transition-all flex items-start gap-3 " +
                            (isSelected
                              ? "border-foreground bg-foreground/5"
                              : "border-border hover:border-foreground/40")
                          }
                        >
                          <span
                            className={
                              "size-6 shrink-0 flex items-center justify-center text-xs font-bold border " +
                              (isSelected
                                ? "border-foreground bg-foreground text-background"
                                : "border-border")
                            }
                          >
                            {alt.key}
                          </span>
                          <span className="pt-0.5 text-sm">{alt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-12 flex justify-between gap-4">
              <button
                onClick={reset}
                className="px-6 py-3 border border-border font-bold text-xs uppercase tracking-widest hover:border-foreground transition-all"
              >
                Desistir
              </button>
              <button
                onClick={submit}
                className="px-8 py-3 bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-primary transition-all"
              >
                Encerrar e ver resultado
              </button>
            </div>
          </>
        )}

        {finished && (
          <div className="border border-border bg-card p-12 text-center">
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Resultado
            </span>
            <div className="text-7xl md:text-8xl font-extrabold tracking-tighter my-6 text-primary">
              {finished.score}/{finished.total}
            </div>
            <p className="text-muted-foreground mb-8">
              {Math.round((finished.score / finished.total) * 100)}% de acertos. Salvo no histórico
              local.
            </p>
            <button
              onClick={reset}
              className="px-8 py-3 bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-primary transition-all"
            >
              Voltar
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
