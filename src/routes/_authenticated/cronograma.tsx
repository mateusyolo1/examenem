import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  PenLine,
  Timer,
  Zap,
  FileText,
  CheckCircle2,
  Lock,
  Loader2,
  ArrowRight,
  Sparkles,
  CalendarDays,
} from "lucide-react";
import { useStudyPlan } from "@/lib/study-plan";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { TodayVideosList } from "@/components/cronograma/TodayVideosList";
import { getTodayAgendaTasks } from "@/lib/study-plan.functions";
import {
  ensureTodayPlan,
  getTodayPlan,
  markSimpleActivityDone,
  generateLousa,
  submitPressureResult,
  updateStudySettings,
  PRESSURE_LEVELS,
  type ActivityKind,
} from "@/lib/cronograma.functions";

export const Route = createFileRoute("/_authenticated/cronograma")({
  head: () => ({
    meta: [
      { title: "Cronograma inteligente — Exame ENEM" },
      {
        name: "description",
        content:
          "Cronograma diário adaptativo: vídeos, treino sob pressão, flashcards, simulados e lição de casa da Lousa com correção por IA.",
      },
    ],
  }),
  component: Cronograma,
});

const ACT_META: Record<
  ActivityKind,
  { label: string; icon: typeof BookOpen; color: string; to: string | null; hint: string }
> = {
  videos: { label: "Vídeos do dia", icon: BookOpen, color: "#3b82f6", to: "/materias", hint: "Assista as aulas em vídeo" },
  treino: { label: "Treino sob pressão", icon: Timer, color: "#f59e0b", to: "/questoes", hint: "Simulado curto cronometrado" },
  flashcards: { label: "Flashcards", icon: Zap, color: "#a855f7", to: "/revisar", hint: "Termômetro de memória" },
  simulado: { label: "Simulado real ENEM", icon: FileText, color: "#ef4444", to: "/simulados-reais", hint: "Prova completa" },
  lousa: { label: "Lousa — Lição de casa", icon: PenLine, color: "#10b981", to: null, hint: "5 questões no caderno, envia amanhã" },
};

function Cronograma() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { plan } = useStudyPlan();
  const ensureFn = useServerFn(ensureTodayPlan);
  const getFn = useServerFn(getTodayPlan);
  const markDoneFn = useServerFn(markSimpleActivityDone);
  const genLousaFn = useServerFn(generateLousa);
  const pressureFn = useServerFn(submitPressureResult);
  const settingsFn = useServerFn(updateStudySettings);

  const { data: initData } = useQuery({
    queryKey: ["cron-ensure"],
    queryFn: () => ensureFn({ data: undefined }),
  });

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["cron-today"],
    queryFn: () => getFn({ data: undefined }),
    enabled: !!initData,
  });

  const todayAgendaFn = useServerFn(getTodayAgendaTasks);
  const { data: todayAgenda } = useQuery({
    queryKey: ["today-agenda"],
    queryFn: () => todayAgendaFn(),
    enabled: !!plan,
    staleTime: 30_000,
  });

  useEffect(() => {
    const t = setInterval(() => refetch(), 60_000);
    return () => clearInterval(t);
  }, [refetch]);

  const genLousaMut = useMutation({
    mutationFn: (activityId: string) => genLousaFn({ data: { activityId } }),
    onSuccess: (res) => {
      toast.success("Lousa gerada! Copie no caderno e volte em 24h.");
      qc.invalidateQueries({ queryKey: ["cron-today"] });
      navigate({ to: "/cronograma/lousa/$activityId", params: { activityId: res.activity.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markDoneMut = useMutation({
    mutationFn: (id: string) => markDoneFn({ data: { activityId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cron-today"] });
      toast.success("Atividade concluída");
    },
  });

  const pressureMut = useMutation({
    mutationFn: (v: { activityId: string; correct: number; total: number }) => pressureFn({ data: v }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["cron-today"] });
      const msg =
        r.movement === "up"
          ? `Você subiu para o nível ${r.level}!`
          : r.movement === "down"
            ? `Nível ajustado para ${r.level}.`
            : `Você ficou no nível ${r.level} (${r.pct}%).`;
      toast.success(msg);
    },
  });

  const settingsMut = useMutation({
    mutationFn: (v: number) => settingsFn({ data: { lousaPassThreshold: v } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cron-today"] });
      toast.success("Limiar atualizado");
    },
  });

  const currentPressure = useMemo(() => {
    const lvl = data?.pressureLevel ?? 1;
    return PRESSURE_LEVELS.find((l) => l.level === lvl) ?? PRESSURE_LEVELS[0];
  }, [data?.pressureLevel]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <Nav />
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10">
        <header className="mb-8 border-b border-border pb-6">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Cronograma inteligente
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">
            Hoje é seu dia de treinar.
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Vídeos todo dia, Treino sob pressão terça e quinta, Flashcards sexta, Simulado no fim de semana. A Lousa vem
            como lição de casa e leva 24h para você enviar as respostas.
          </p>
        </header>

        {!plan ? (
          <section className="border-2 border-dashed border-border rounded-2xl bg-card px-6 py-14 md:py-20 text-center flex flex-col items-center gap-5">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 text-primary">
              <Lock size={28} />
            </div>
            <div className="max-w-lg space-y-2">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tighter">
                Você ainda não tem uma Agenda montada.
              </h2>
              <p className="text-sm text-muted-foreground">
                O Cronograma só destrava depois que você gera seu plano de estudos na Agenda. Escolha seu foco, suas horas e suas metas — o resto vem pronto.
              </p>
            </div>
            <Link
              to="/plano"
              data-hint="cronograma.agenda"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
            >
              <CalendarDays size={18} />
              Ir para a Agenda
              <ArrowRight size={16} />
            </Link>

          </section>
        ) : isLoading || !data ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="animate-spin" size={16} /> Carregando plano de hoje…
          </div>
        ) : (
          <>
            {/* Pressure + settings */}
            <section className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="border border-border rounded-xl p-5 bg-card">
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Nível de pressão
                </div>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-4xl font-extrabold">{currentPressure.level}</span>
                  <span className="text-lg font-bold">{currentPressure.label}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  {currentPressure.questions} questões · {currentPressure.minutes} min
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Sequência de vitórias: {data.pressureStreak}
                </div>
              </div>
              <div className="border border-border rounded-xl p-5 bg-card">
                <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Limiar de aprovação da Lousa
                </label>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="range"
                    min={40}
                    max={90}
                    step={5}
                    defaultValue={data.lousaThreshold}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (v !== data.lousaThreshold) settingsMut.mutate(v);
                    }}
                    className="flex-1"
                  />
                  <span className="text-2xl font-extrabold min-w-[3ch] text-right">
                    {data.lousaThreshold}%
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Abaixo disso, geramos uma Lousa de reforço automática.
                </div>
              </div>
            </section>

            {/* Activities */}
            {data.days.map((day) => {
              const acts = data.activities.filter((a) => a.day_id === day.id);
              return (
                <section key={day.id} className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-xl font-bold">
                      {day.kind === "reforco" ? "Dia de reforço" : "Atividades de hoje"}
                    </h2>
                    {day.kind === "reforco" && (
                      <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        Reforço
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {acts.map((a, idx) => {
                      const meta = ACT_META[a.kind as ActivityKind];
                      const Icon = meta.icon;
                      const previousIncomplete = acts.slice(0, idx).some((p) => p.status !== "done");
                      const locked = previousIncomplete && a.status === "pending";
                      const done = a.status === "done";
                      const failed = a.status === "failed";
                      const isReforco = Boolean((a.payload as { reforco?: boolean })?.reforco);

                      return (
                        <div
                          key={a.id}
                          className={
                            "border rounded-xl p-5 flex flex-wrap gap-4 items-center transition-all " +
                            (done
                              ? "border-emerald-500/40 bg-emerald-500/5"
                              : locked
                                ? "border-border bg-muted/30 opacity-60"
                                : "border-border bg-card hover:border-foreground")
                          }
                        >
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `${meta.color}20`, color: meta.color }}
                          >
                            <Icon size={22} />
                          </div>
                          <div className="flex-1 min-w-[200px]">
                            <div className="font-bold flex items-center gap-2 flex-wrap">
                              {meta.label}
                              {isReforco && a.kind === "lousa" && (
                                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                  Reforço
                                </span>
                              )}
                              {(a.payload as { carryover?: boolean })?.carryover && (
                                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-orange-500/15 text-orange-600 dark:text-orange-400">
                                  Pendência de ontem
                                </span>
                              )}
                              {(a.payload as { source?: string })?.source === "lousa_failure" && (
                                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400">
                                  Foco recomendado
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {done
                                ? a.score != null
                                  ? `Concluída — ${Math.round(Number(a.score))}%`
                                  : "Concluída"
                                : failed
                                  ? `Precisa refazer — ${Math.round(Number(a.score ?? 0))}%`
                                  : locked
                                    ? "Termine a atividade anterior para desbloquear"
                                    : meta.hint}
                            </div>
                            {(() => {
                              const focus = (a.payload as { focus_topics?: string[] })?.focus_topics;
                              if (!focus?.length) return null;
                              return (
                                <div className="text-[11px] mt-1.5 text-blue-600 dark:text-blue-400">
                                  Foque em: {focus.join(", ")}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Action */}
                          {done ? (
                            <CheckCircle2 className="text-emerald-500" size={22} />
                          ) : locked ? (
                            <Lock size={18} className="text-muted-foreground" />
                          ) : a.kind === "lousa" ? (
                            a.generated_at ? (
                              <Link
                                to="/cronograma/lousa/$activityId"
                                params={{ activityId: a.id }}
                                className="px-4 py-2 rounded-lg bg-foreground text-background text-xs font-bold uppercase tracking-widest hover:bg-primary transition-all inline-flex items-center gap-2"
                              >
                                {failed ? "Refazer" : "Ver / Enviar"} <ArrowRight size={14} />
                              </Link>
                            ) : (
                              <button
                                onClick={() => genLousaMut.mutate(a.id)}
                                disabled={genLousaMut.isPending}
                                className="px-4 py-2 rounded-lg bg-foreground text-background text-xs font-bold uppercase tracking-widest hover:bg-primary transition-all inline-flex items-center gap-2 disabled:opacity-50"
                              >
                                {genLousaMut.isPending ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Sparkles size={14} />
                                )}
                                Gerar Lousa
                              </button>
                            )
                          ) : a.kind === "treino" ? (
                            <div className="flex gap-2">
                              <Link
                                to="/questoes"
                                search={
                                  todayAgenda?.focusTopics.questoes.length
                                    ? { topics: todayAgenda.focusTopics.questoes.join(",") }
                                    : undefined
                                }
                                className="px-4 py-2 rounded-lg border border-border text-xs font-bold uppercase tracking-widest hover:border-foreground transition-all inline-flex items-center gap-2"
                              >
                                Iniciar treino
                              </Link>
                              <QuickPressureForm
                                onSubmit={(correct, total) =>
                                  pressureMut.mutate({ activityId: a.id, correct, total })
                                }
                                total={currentPressure.questions}
                              />
                            </div>
                          ) : a.kind === "flashcards" ? (
                            <div className="flex gap-2">
                              <Link
                                to="/revisar"
                                search={
                                  todayAgenda?.focusTopics.flashcards.length
                                    ? { topics: todayAgenda.focusTopics.flashcards.join(",") }
                                    : undefined
                                }
                                className="px-4 py-2 rounded-lg border border-border text-xs font-bold uppercase tracking-widest hover:border-foreground transition-all"
                              >
                                Iniciar
                              </Link>
                              <button
                                onClick={() => markDoneMut.mutate(a.id)}
                                disabled={markDoneMut.isPending}
                                className="px-4 py-2 rounded-lg bg-foreground text-background text-xs font-bold uppercase tracking-widest hover:bg-primary transition-all disabled:opacity-50"
                              >
                                Marcar feito
                              </button>
                            </div>
                          ) : a.kind === "simulado" ? (
                            <div className="flex gap-2">
                              <Link
                                to="/simulados-reais"
                                search={
                                  todayAgenda?.simuladoArea
                                    ? { area: todayAgenda.simuladoArea }
                                    : undefined
                                }
                                className="px-4 py-2 rounded-lg border border-border text-xs font-bold uppercase tracking-widest hover:border-foreground transition-all"
                              >
                                Iniciar
                              </Link>
                              <button
                                onClick={() => markDoneMut.mutate(a.id)}
                                disabled={markDoneMut.isPending}
                                className="px-4 py-2 rounded-lg bg-foreground text-background text-xs font-bold uppercase tracking-widest hover:bg-primary transition-all disabled:opacity-50"
                              >
                                Marcar feito
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              {meta.to && (
                                <Link
                                  to={meta.to}
                                  className="px-4 py-2 rounded-lg border border-border text-xs font-bold uppercase tracking-widest hover:border-foreground transition-all"
                                >
                                  Iniciar
                                </Link>
                              )}
                              <button
                                onClick={() => markDoneMut.mutate(a.id)}
                                disabled={markDoneMut.isPending}
                                className="px-4 py-2 rounded-lg bg-foreground text-background text-xs font-bold uppercase tracking-widest hover:bg-primary transition-all disabled:opacity-50"
                              >
                                Marcar feito
                              </button>
                            </div>
                          )}

                          {a.kind === "videos" && !done && !locked && (
                            <div className="w-full">
                              <TodayVideosList />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {!acts.length && (
                      <div className="text-sm text-muted-foreground border border-dashed border-border rounded-xl p-6 text-center">
                        Nenhuma atividade para hoje. Aproveite para descansar!
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function QuickPressureForm({
  onSubmit,
  total,
}: {
  onSubmit: (correct: number, total: number) => void;
  total: number;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const correct = Number(fd.get("c"));
        if (Number.isFinite(correct) && correct >= 0 && correct <= total) onSubmit(correct, total);
      }}
      className="flex items-center gap-2"
    >
      <input
        name="c"
        type="number"
        min={0}
        max={total}
        placeholder={`acertos /${total}`}
        className="w-20 px-2 py-1.5 text-xs border border-border bg-background rounded"
      />
      <button
        type="submit"
        className="px-3 py-1.5 rounded bg-foreground text-background text-[11px] font-bold uppercase tracking-widest"
      >
        Registrar
      </button>
    </form>
  );
}
