import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import {
  listEnemExams,
  listSimuladoSessions,
  syncEnemExams,
  startSimuladoReal,
  getSimuladoQuestions,
  submitSimuladoAnswer,
  finishSimuladoReal,
} from "@/lib/enem.functions";
import { toast } from "sonner";
import { RefreshCw, Play, Clock, Trophy } from "lucide-react";

const simuladosSearchSchema = z.object({
  area: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/simulados-reais")({
  validateSearch: zodValidator(simuladosSearchSchema),
  head: () => ({
    meta: [
      { title: "Simulados Reais do ENEM — Exame ENEM" },
      {
        name: "description",
        content:
          "Faça simulados com questões oficiais do ENEM (2009-2024), prova completa ou por área, com cronômetro e nota TRI aproximada.",
      },
    ],
  }),
  component: SimuladosReaisPage,
});

const AREA_OPTS: Array<{ id: "linguagens" | "humanas" | "natureza" | "matematica"; label: string }> = [
  { id: "linguagens", label: "Linguagens" },
  { id: "humanas", label: "Humanas" },
  { id: "natureza", label: "Natureza" },
  { id: "matematica", label: "Matemática" },
];

function SimuladosReaisPage() {
  const [runningSessionId, setRunningSessionId] = useState<string | null>(null);
  const [resultSessionId, setResultSessionId] = useState<string | null>(null);

  if (runningSessionId) {
    return (
      <RunningSimulado
        sessionId={runningSessionId}
        onFinish={(id) => {
          setRunningSessionId(null);
          setResultSessionId(id);
        }}
        onAbort={() => setRunningSessionId(null)}
      />
    );
  }

  if (resultSessionId) {
    return <ResultView sessionId={resultSessionId} onReset={() => setResultSessionId(null)} />;
  }

  return <ChooseSimulado onStart={(id) => setRunningSessionId(id)} />;
}

// ============================================================
// Choose / Setup
// ============================================================
function ChooseSimulado({ onStart }: { onStart: (id: string) => void }) {
  const queryClient = useQueryClient();
  const listExams = useServerFn(listEnemExams);
  const listSessions = useServerFn(listSimuladoSessions);
  const sync = useServerFn(syncEnemExams);
  const start = useServerFn(startSimuladoReal);

  const { data: examsData, isLoading: loadingExams } = useQuery({
    queryKey: ["enem-exams"],
    queryFn: () => listExams(),
  });
  const { data: sessionsData } = useQuery({
    queryKey: ["simulado-sessions"],
    queryFn: () => listSessions(),
  });

  const [mode, setMode] = useState<"full_day" | "by_area">("full_day");
  const [year, setYear] = useState<number | null>(null);
  const [day, setDay] = useState<1 | 2>(1);
  const [area, setArea] = useState<"linguagens" | "humanas" | "natureza" | "matematica">("matematica");
  const [count, setCount] = useState<15 | 30 | 45>(30);

  const exams = examsData?.exams ?? [];
  const years = useMemo(() => {
    const set = new Set<number>();
    exams.forEach((e) => {
      if (e.year >= 2016 && e.year <= 2025) set.add(e.year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [exams]);

  useEffect(() => {
    if (years.length > 0 && year === null) setYear(years[0]);
  }, [years, year]);

  const syncMutation = useMutation({
    mutationFn: () => sync(),
    onSuccess: (res) => {
      toast.success(`${res.synced} provas sincronizadas.`);
      queryClient.invalidateQueries({ queryKey: ["enem-exams"] });
    },
    onError: (e) => {
      toast.error("Não foi possível sincronizar", {
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  const startMutation = useMutation({
    mutationFn: () =>
      start({
        data:
          mode === "full_day"
            ? { mode, year: year!, day }
            : { mode, area, count },
      }),
    onSuccess: (res) => {
      onStart(res.sessionId);
    },
    onError: (e) => {
      toast.error("Não foi possível iniciar", {
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Nav />
      <main id="main" className="lg:ml-64">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 pb-24 lg:pb-8">
          <header className="mb-8 border-b border-border pb-6">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
              <Link to="/simulados" className="hover:text-foreground">Simulados</Link>
              <span>/</span>
              <span>Provas Reais</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter mt-2">
              Simulados Reais do ENEM.
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl">
              Questões oficiais de provas passadas (2009-2024), direto do banco público{" "}
              <code className="text-xs">api.enem.dev</code>. Prova completa ou treino por área.
            </p>
          </header>

          {exams.length === 0 && !loadingExams && (
            <div className="border border-dashed border-border rounded-md p-8 text-center bg-card mb-8">
              <p className="text-sm text-muted-foreground mb-4">
                Ainda não sincronizamos as provas oficiais. Isso é rápido e só precisa ser feito uma vez.
              </p>
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background text-xs font-bold uppercase tracking-widest disabled:opacity-50"
              >
                <RefreshCw size={14} className={syncMutation.isPending ? "animate-spin" : ""} />
                {syncMutation.isPending ? "Sincronizando…" : "Sincronizar provas oficiais"}
              </button>
            </div>
          )}

          {exams.length > 0 && (
            <>
              {/* Mode tabs */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setMode("full_day")}
                  className={
                    "px-4 py-2 text-xs font-bold uppercase tracking-widest border transition-colors " +
                    (mode === "full_day"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground")
                  }
                >
                  Prova Completa
                </button>
                <button
                  onClick={() => setMode("by_area")}
                  className={
                    "px-4 py-2 text-xs font-bold uppercase tracking-widest border transition-colors " +
                    (mode === "by_area"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground")
                  }
                >
                  Por Área
                </button>
              </div>

              <div className="border border-border bg-card rounded-md p-6 mb-8">
                {mode === "full_day" ? (
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
                        Ano
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {years.map((y) => (
                          <button
                            key={y}
                            onClick={() => setYear(y)}
                            className={
                              "px-3 py-1.5 text-xs font-mono border transition-colors " +
                              (year === y
                                ? "border-foreground bg-foreground text-background"
                                : "border-border text-muted-foreground hover:border-foreground")
                            }
                          >
                            {y}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
                        Dia
                      </label>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {([1, 2] as const).map((d) => (
                          <button
                            key={d}
                            onClick={() => setDay(d)}
                            className={
                              "text-left p-4 border transition-colors " +
                              (day === d
                                ? "border-foreground bg-accent"
                                : "border-border hover:border-foreground")
                            }
                          >
                            <div className="text-xs font-mono uppercase text-muted-foreground">
                              {d === 1 ? "1º dia" : "2º dia"}
                            </div>
                            <div className="text-sm font-bold mt-1">
                              {d === 1 ? "Linguagens + Humanas" : "Natureza + Matemática"}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              90 questões · {d === 1 ? "5h30" : "5h"}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
                        Área
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {AREA_OPTS.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => setArea(a.id)}
                            className={
                              "px-3 py-2.5 text-sm font-medium border transition-colors " +
                              (area === a.id
                                ? "border-foreground bg-foreground text-background"
                                : "border-border text-muted-foreground hover:border-foreground")
                            }
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
                        Quantidade
                      </label>
                      <div className="flex gap-2">
                        {([15, 30, 45] as const).map((n) => (
                          <button
                            key={n}
                            onClick={() => setCount(n)}
                            className={
                              "px-4 py-2 text-xs font-bold border transition-colors " +
                              (count === n
                                ? "border-foreground bg-foreground text-background"
                                : "border-border text-muted-foreground hover:border-foreground")
                            }
                          >
                            {n} questões
                          </button>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 font-mono">
                        Tempo: {Math.round(count * 2)} min · Retiradas aleatoriamente das provas oficiais
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending || (mode === "full_day" && !year)}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-foreground text-background text-xs font-bold uppercase tracking-widest disabled:opacity-50"
                >
                  <Play size={14} />
                  {startMutation.isPending ? "Preparando…" : "Iniciar simulado"}
                </button>
              </div>
            </>
          )}

          {sessionsData && sessionsData.sessions.length > 0 && (
            <section>
              <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-4 mb-4">
                Histórico
              </h2>
              <div className="space-y-2">
                {sessionsData.sessions.map((s) => {
                  const done = s.finished_at !== null;
                  const pct = s.correct_count != null && s.total_questions
                    ? Math.round((s.correct_count / s.total_questions) * 100)
                    : 0;
                  return (
                    <div
                      key={s.id}
                      className="flex flex-wrap justify-between items-center border border-border p-3 md:p-4 bg-card gap-3"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">
                          {s.mode === "full_day"
                            ? `ENEM ${s.year} — ${s.day}º dia`
                            : `Treino ${s.area}`}
                        </span>
                        <span className="text-[11px] font-mono uppercase text-muted-foreground">
                          {new Date(s.started_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      {done ? (
                        <div className="flex items-center gap-3 text-sm font-mono">
                          <span className="font-bold">
                            {s.correct_count}/{s.total_questions}{" "}
                            <span className="text-primary">({pct}%)</span>
                          </span>
                          {s.score_tri != null && (
                            <span className="text-xs text-muted-foreground">
                              TRI ~{Math.round(Number(s.score_tri))}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-mono uppercase text-amber-600 dark:text-amber-400">
                          Em andamento
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ============================================================
// Running simulado
// ============================================================
function RunningSimulado({
  sessionId,
  onFinish,
  onAbort,
}: {
  sessionId: string;
  onFinish: (id: string) => void;
  onAbort: () => void;
}) {
  const getQuestions = useServerFn(getSimuladoQuestions);
  const submitAnswer = useServerFn(submitSimuladoAnswer);
  const finish = useServerFn(finishSimuladoReal);

  const { data, isLoading } = useQuery({
    queryKey: ["simulado-questions", sessionId],
    queryFn: () => getQuestions({ data: { sessionId } }),
  });

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const startedAtRef = useRef<number>(Date.now());
  const [confirmFinish, setConfirmFinish] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (data?.session.duration_minutes) {
      setTimeLeft(data.session.duration_minutes * 60);
    }
  }, [data?.session.duration_minutes]);

  useEffect(() => {
    if (!data || submittedRef.current) return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          void handleFinish(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function handleAnswer(questionId: string, letter: string) {
    setAnswers((p) => ({ ...p, [questionId]: letter }));
    try {
      await submitAnswer({ data: { sessionId, questionId, selected: letter } });
    } catch (e) {
      console.error(e);
    }
  }

  async function handleFinish(force: boolean) {
    if (submittedRef.current) return;
    const questions = data?.questions ?? [];
    const unanswered = questions.filter((q) => !answers[q.id]).length;
    if (!force && unanswered > 0) {
      setConfirmFinish(true);
      return;
    }
    submittedRef.current = true;
    setConfirmFinish(false);
    try {
      const spent = Math.round((Date.now() - startedAtRef.current) / 1000);
      await finish({ data: { sessionId, timeSpentSeconds: spent } });
      onFinish(sessionId);
    } catch (e) {
      submittedRef.current = false;
      toast.error("Erro ao finalizar", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background grid place-items-center">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Carregando questões…
        </div>
      </div>
    );
  }

  const questions = data.questions;
  const q = questions[index];
  const answered = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Nav />
      <main className="lg:ml-64 max-w-5xl mx-auto px-4 md:px-6 py-6 pb-24 lg:pb-6">
        <div className="sticky top-0 lg:top-6 z-40 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-background/95 backdrop-blur-md border-b border-border mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-mono uppercase text-muted-foreground">
              ENEM {data.session.year} · Dia {data.session.day ?? "—"} · {answered}/{questions.length}
            </span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg md:text-2xl font-extrabold tracking-tighter text-primary flex items-center gap-1.5">
                <Clock size={16} />
                {fmt(timeLeft)}
              </span>
              <button
                onClick={() => handleFinish(false)}
                className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest bg-foreground text-background rounded"
              >
                Finalizar
              </button>
              <button
                onClick={onAbort}
                className="text-[11px] font-mono uppercase text-muted-foreground hover:text-destructive"
              >
                Sair
              </button>
            </div>
          </div>
        </div>

        {/* Question navigator */}
        <div className="mb-6 flex flex-wrap gap-1">
          {questions.map((qq, i) => {
            const isCur = i === index;
            const isAns = !!answers[qq.id];
            return (
              <button
                key={qq.id}
                onClick={() => setIndex(i)}
                className={
                  "w-8 h-8 text-[11px] font-mono font-bold border transition-all " +
                  (isCur
                    ? "border-foreground bg-foreground text-background"
                    : isAns
                      ? "border-primary/60 bg-primary/10"
                      : "border-border text-muted-foreground hover:border-foreground")
                }
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* Question */}
        {q && (
          <article className="border border-border bg-card p-5 md:p-8">
            <div className="text-xs font-mono uppercase text-muted-foreground mb-4">
              Questão {index + 1} · {q.discipline} · {q.year}
            </div>

            {q.context && (
              <div className="prose prose-sm dark:prose-invert max-w-none mb-4 whitespace-pre-wrap">
                {q.context}
              </div>
            )}

            {Array.isArray(q.files) &&
              (q.files as unknown as string[]).map((f, i) => (
                <img
                  key={i}
                  src={f}
                  alt=""
                  className="max-w-full my-3 border border-border"
                  loading="lazy"
                />
              ))}

            {q.alternative_introduction && (
              <p className="text-sm mb-4 whitespace-pre-wrap">{q.alternative_introduction}</p>
            )}

            <div className="space-y-2">
              {(q.alternatives as unknown as Array<{ letter: string; text: string | null; file: string | null }>).map(
                (alt) => {
                  const selected = answers[q.id] === alt.letter;
                  return (
                    <button
                      key={alt.letter}
                      onClick={() => handleAnswer(q.id, alt.letter)}
                      className={
                        "w-full text-left p-3 md:p-4 border transition-colors flex gap-3 " +
                        (selected
                          ? "border-foreground bg-accent"
                          : "border-border hover:border-foreground")
                      }
                    >
                      <span className="font-mono font-bold shrink-0">{alt.letter})</span>
                      <span className="text-sm">
                        {alt.text}
                        {alt.file && (
                          <img
                            src={alt.file}
                            alt=""
                            className="max-w-full mt-2 border border-border"
                            loading="lazy"
                          />
                        )}
                      </span>
                    </button>
                  );
                },
              )}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="px-3 py-2 text-xs font-mono uppercase text-muted-foreground disabled:opacity-30 hover:text-foreground"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                disabled={index === questions.length - 1}
                className="px-3 py-2 text-xs font-mono uppercase text-muted-foreground disabled:opacity-30 hover:text-foreground"
              >
                Próxima →
              </button>
            </div>
          </article>
        )}

        {confirmFinish && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[70] grid place-items-center bg-foreground/40 backdrop-blur-sm p-4"
          >
            <div className="max-w-sm w-full bg-card border border-border p-6 rounded-md">
              <h3 className="font-bold text-lg mb-2">Finalizar mesmo assim?</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Você ainda tem {questions.length - answered} questão(ões) sem resposta. Elas contarão como erradas.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmFinish(false)}
                  className="px-3 py-2 text-xs font-bold uppercase border border-border rounded"
                >
                  Voltar
                </button>
                <button
                  onClick={() => handleFinish(true)}
                  className="px-3 py-2 text-xs font-bold uppercase bg-foreground text-background rounded"
                >
                  Finalizar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================
// Result
// ============================================================
function ResultView({ sessionId, onReset }: { sessionId: string; onReset: () => void }) {
  const getQuestions = useServerFn(getSimuladoQuestions);
  const { data } = useQuery({
    queryKey: ["simulado-questions", sessionId],
    queryFn: () => getQuestions({ data: { sessionId } }),
  });

  const listSessions = useServerFn(listSimuladoSessions);
  const { data: sessionsData } = useQuery({
    queryKey: ["simulado-sessions"],
    queryFn: () => listSessions(),
  });

  const session = sessionsData?.sessions.find((s) => s.id === sessionId);

  if (!data || !session) {
    return (
      <div className="min-h-screen bg-background grid place-items-center">
        <div className="text-xs font-mono uppercase text-muted-foreground">Carregando resultado…</div>
      </div>
    );
  }

  const pct = session.total_questions
    ? Math.round(((session.correct_count ?? 0) / session.total_questions) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Nav />
      <main className="lg:ml-64 max-w-4xl mx-auto px-4 md:px-6 py-8 pb-24 lg:pb-8">
        <div className="border border-border bg-card p-6 md:p-10 mb-6">
          <Trophy size={32} className="text-primary mb-3" />
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter mb-2">
            {session.correct_count}/{session.total_questions}
          </h1>
          <p className="text-xl font-mono text-primary mb-4">{pct}% de acerto</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm border-t border-border pt-4">
            <div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Nota TRI ~</div>
              <div className="font-mono font-bold text-lg">
                {session.score_tri != null ? Math.round(Number(session.score_tri)) : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Tempo</div>
              <div className="font-mono font-bold text-lg">
                {session.time_spent_seconds ? fmt(session.time_spent_seconds) : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Prova</div>
              <div className="font-mono font-bold text-lg">
                {session.mode === "full_day"
                  ? `${session.year}/${session.day}`
                  : session.area}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onReset}
          className="w-full px-4 py-3 bg-foreground text-background text-xs font-bold uppercase tracking-widest"
        >
          Novo Simulado
        </button>
      </main>
      <Footer />
    </div>
  );
}

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
