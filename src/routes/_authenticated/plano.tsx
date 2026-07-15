import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { resolveStudyTopic, listStudyTopics, listTopicMastery } from "@/lib/study.functions";
import { enrichStudyPlan, getPersonalizationSignals } from "@/lib/study-plan.functions";
import { getStageInfo } from "@/lib/telemetry.functions";
import { useLastEssayTasks } from "@/lib/lesson-essay-cache";

import {
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Target,
  Clock,
  Sparkles,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  BookOpen,
  ListChecks,
  Repeat,
  PenLine,
  FileText,
  Coffee,
  ArrowRight,
  Undo2,
  Check,
  Video,
  Network,
  Layers,
  ScrollText,
  ClipboardList,
  Wrench,
  Wand2,
  Loader2,
} from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { HintCoach, type HintDef } from "@/components/HintCoach";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AREAS, useProgress, type Area } from "@/lib/storage";
import { SUBJECTS, SUBJECT_AREAS } from "@/lib/subjects";
import {
  WEEKDAYS,
  useStudyPlan,
  applyAiEnrichment,
  type StudyPlanConfig,
  type Focus,
  type Variation,
  type StudyTask,
  type TaskType,
  type TopicCatalogEntry,
  type TopicMastery,
  resolvedStatus,
  weekDates,
  areaLabel,
  typeLabel,
  rescheduleOverdue,
  countOverdue,
} from "@/lib/study-plan";
import { StageTasksSection } from "@/components/StageTasksSection";
import { DEFAULT_EXAM_ID, EXAM_OPTIONS, examDateToIso, getExamOption } from "@/lib/exams";

export const Route = createFileRoute("/_authenticated/plano")({
  head: () => ({
    meta: [
      { title: "Plano de Estudos — Exame ENEM" },
      {
        name: "description",
        content:
          "Gere automaticamente um plano de estudos personalizado para o ENEM com tarefas diárias, simulados, redações e revisões programadas.",
      },
    ],
  }),
  component: Plano,
});

function isoDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Premium soft palette per task type — surface tones for cards + dot accents.
const TYPE_STYLES: Record<
  TaskType,
  { dot: string; chip: string; ring: string; icon: typeof BookOpen }
> = {
  teoria: {
    dot: "bg-sky-500",
    chip:
      "bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-inset ring-sky-500/20",
    ring: "ring-sky-500/30",
    icon: BookOpen,
  },
  questoes: {
    dot: "bg-emerald-500",
    chip:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20",
    ring: "ring-emerald-500/30",
    icon: ListChecks,
  },
  revisao: {
    dot: "bg-amber-500",
    chip:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/25",
    ring: "ring-amber-500/30",
    icon: Repeat,
  },
  redacao: {
    dot: "bg-violet-500",
    chip:
      "bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-1 ring-inset ring-violet-500/20",
    ring: "ring-violet-500/30",
    icon: PenLine,
  },
  simulado: {
    dot: "bg-rose-500",
    chip:
      "bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-500/20",
    ring: "ring-rose-500/30",
    icon: FileText,
  },
  mapa_mental: {
    dot: "bg-fuchsia-500",
    chip:
      "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 ring-1 ring-inset ring-fuchsia-500/20",
    ring: "ring-fuchsia-500/30",
    icon: Network,
  },
  flashcards: {
    dot: "bg-cyan-500",
    chip:
      "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 ring-1 ring-inset ring-cyan-500/20",
    ring: "ring-cyan-500/30",
    icon: Layers,
  },
  resumo: {
    dot: "bg-indigo-500",
    chip:
      "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-inset ring-indigo-500/20",
    ring: "ring-indigo-500/30",
    icon: ScrollText,
  },
  prova_antiga: {
    dot: "bg-orange-500",
    chip:
      "bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-1 ring-inset ring-orange-500/25",
    ring: "ring-orange-500/30",
    icon: ClipboardList,
  },
  videoaula: {
    dot: "bg-blue-500",
    chip:
      "bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-1 ring-inset ring-blue-500/20",
    ring: "ring-blue-500/30",
    icon: Video,
  },
  projeto: {
    dot: "bg-teal-500",
    chip:
      "bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-1 ring-inset ring-teal-500/20",
    ring: "ring-teal-500/30",
    icon: Wrench,
  },
};

const PLANO_HINTS: HintDef[] = [
  {
    key: "plano.cronograma.v1",
    targetSelector: '[data-hint="plano.cronograma"]',
    title: "Cronograma inteligente de hoje",
    description:
      "Abre o cronograma do dia com vídeos, treino sob pressão, flashcards, simulado e lousa — tudo adaptado ao seu nível.",
  },
  {
    key: "plano.variacao.v1",
    targetSelector: '[data-hint="plano.variacao"]',
    title: "Variação semanal",
    description:
      "Escolha o quanto o cronograma muda de uma semana para outra: Baixa (rotina previsível), Média (equilíbrio) ou Alta (novos formatos toda semana).",
  },
];

function Plano() {
  const { plan, savePlan, clearPlan, toggleDone } = useStudyPlan();
  const { progress } = useProgress();
  const [editing, setEditing] = useState(false);
  const [askClear, setAskClear] = useState(false);

  // Catálogo de tópicos (só busca quando o form está aberto ou não há plano).
  const listTopicsFn = useServerFn(listStudyTopics);
  const needsCatalog = !plan || editing;
  const { data: topicsData } = useQuery({
    queryKey: ["study-topics"],
    queryFn: () => listTopicsFn(),
    enabled: needsCatalog,
    staleTime: 5 * 60 * 1000,
  });
  const topicCatalog: TopicCatalogEntry[] = useMemo(() => {
    const rows = (topicsData?.topics ?? []) as Array<{
      slug: string;
      area: string;
      title: string;
      subject: string | null;
      sort_order: number;
      parent_id: string | null;
    }>;
    return rows
      .filter(
        (t) =>
          t.parent_id !== null &&
          ["linguagens", "humanas", "natureza", "matematica"].includes(t.area),
      )
      .map((t) => ({
        slug: t.slug,
        area: t.area as TopicCatalogEntry["area"],
        title: t.title,
        subject: t.subject,
        sort_order: t.sort_order,
      }));
  }, [topicsData]);

  // Mastery (Abordagem 3): alimenta o gerador de plano com desempenho.
  const listMasteryFn = useServerFn(listTopicMastery);
  const { data: masteryData } = useQuery({
    queryKey: ["topic-mastery"],
    queryFn: () => listMasteryFn(),
    staleTime: 60 * 1000,
  });
  const masteryList: TopicMastery[] = useMemo(() => {
    return ((masteryData?.mastery ?? []) as TopicMastery[]).map((m) => ({
      ...m,
      area: m.area as TopicMastery["area"],
    }));
  }, [masteryData]);

  if (!plan || editing) {
    return (
      <Shell plan={plan}>
        <PlanForm
          initial={plan?.config}
          defaultExamDate={progress.examDate}
          defaultExamId={progress.examId}
          onCancel={plan ? () => setEditing(false) : undefined}
          onSubmit={(cfg) => {
            savePlan(
              cfg,
              topicCatalog.length ? topicCatalog : undefined,
              masteryList.length ? masteryList : undefined,
            );
            setEditing(false);
          }}
        />
      </Shell>
    );
  }


  return (
    <Shell plan={plan}>
      <PlanView
        plan={plan}
        mastery={masteryList}
        onToggleDone={toggleDone}
        onEdit={() => setEditing(true)}
        onClear={() => setAskClear(true)}
      />
      <ConfirmDialog
        open={askClear}
        title="Apagar plano de estudos?"
        description="Essa ação remove todas as tarefas do cronograma. Você pode gerar um novo plano depois."
        confirmLabel="Apagar plano"
        destructive
        onConfirm={() => {
          clearPlan();
          setAskClear(false);
        }}
        onCancel={() => setAskClear(false)}
      />
    </Shell>
  );

}

function Shell({
  plan,
  children,
}: {
  plan: ReturnType<typeof useStudyPlan>["plan"];
  children: React.ReactNode;
}) {
  const stageInfoFn = useServerFn(getStageInfo);
  const stageQuery = useQuery({
    queryKey: ["stage-info"],
    queryFn: () => stageInfoFn(),
    staleTime: 60_000,
  });
  const stage = stageQuery.data;
  const daysToExam = plan
    ? Math.max(
        0,
        Math.ceil(
          (new Date(plan.config.examDate).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null;
  const examLabel = plan
    ? new Date(plan.config.examDate).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;
  const examName = plan ? plan.config.examName || getExamOption(plan.config.examId).label : null;

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gradient-to-b from-muted/30 via-background to-background text-foreground">
      <Nav />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Link
          to="/cronograma"
          data-hint="plano.cronograma"
          className="mb-8 group relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 flex items-center justify-between hover:border-primary transition-colors"
        >
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-primary">Novo</div>
            <div className="text-lg font-bold mt-1">Cronograma inteligente de hoje</div>
            <div className="text-sm text-muted-foreground mt-1">
              Vídeos, Treino sob pressão, Flashcards, Simulado e Lousa (lição de casa com 24h) — tudo adaptado ao seu nível.
            </div>
          </div>
          <span className="text-primary text-2xl font-bold group-hover:translate-x-1 transition-transform">→</span>
        </Link>
        <header className="mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide ring-1 ring-inset ring-primary/20">
            <Sparkles size={12} aria-hidden />
            Plano de Estudos
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Seu cronograma pessoal até a prova
          </h1>
          <p className="mt-3 text-base text-muted-foreground max-w-2xl leading-relaxed">
            Tarefas diárias balanceadas com teoria, questões, revisões, simulados
            e redação — adaptadas ao seu tempo disponível e às suas áreas mais
            difíceis.
          </p>
          {plan && examLabel && (
            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-foreground/80">
                <CalendarDays size={14} aria-hidden className="text-primary" />
                {examName} em <strong className="font-semibold">{examLabel}</strong>
              </span>
              {daysToExam !== null && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-foreground/80">
                  <Clock size={14} aria-hidden className="text-primary" />
                  <strong className="font-semibold">{daysToExam}</strong> dias
                  restantes
                </span>
              )}
            </div>
          )}
        </header>
        {children}
      </main>
      <Footer />
      <HintCoach hints={PLANO_HINTS} />
    </div>
  );
}

function PlanForm({
  initial,
  defaultExamDate,
  defaultExamId,
  onSubmit,
  onCancel,
}: {
  initial?: StudyPlanConfig;
  defaultExamDate: string;
  defaultExamId?: string;
  onSubmit: (cfg: StudyPlanConfig) => void;
  onCancel?: () => void;
}) {
  const [examDate, setExamDate] = useState<string>(
    initial?.examDate
      ? isoDateInput(new Date(initial.examDate))
      : isoDateInput(new Date(defaultExamDate)),
  );
  const [examId, setExamId] = useState<string>(initial?.examId ?? defaultExamId ?? DEFAULT_EXAM_ID);
  const [hoursPerDay, setHoursPerDay] = useState<number>(initial?.hoursPerDay ?? 2);
  const [weekdays, setWeekdays] = useState<number[]>(
    initial?.weekdays ?? [1, 2, 3, 4, 5, 6],
  );
  const [hardAreas, setHardAreas] = useState<Area[]>(initial?.hardAreas ?? []);
  const [targetScore, setTargetScore] = useState<number>(initial?.targetScore ?? 700);
  const [focus, setFocus] = useState<Focus>(initial?.focus ?? "balanced");
  const [variation, setVariation] = useState<Variation>(initial?.variation ?? "media");
  const [subjects, setSubjects] = useState<string[]>(initial?.subjects ?? []);

  function toggleDay(d: number) {
    setWeekdays((w) =>
      w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort((a, b) => a - b),
    );
  }
  function toggleHard(a: Area) {
    setHardAreas((h) => (h.includes(a) ? h.filter((x) => x !== a) : [...h, a]));
  }
  function toggleSubject(id: string) {
    setSubjects((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const canSubmit =
    weekdays.length > 0 && hoursPerDay > 0 && hoursPerDay <= 12 && !!examDate;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({
          examDate: examDateToIso(examDate),
          examId,
          examName: getExamOption(examId).label,
          hoursPerDay,
          weekdays,
          hardAreas,
          targetScore,
          focus,
          subjects,
          variation,
        });
      }}
      className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden"
    >
      <div className="relative px-6 sm:px-8 pt-7 pb-6 border-b border-border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur text-foreground/80 text-[11px] font-semibold tracking-wide ring-1 ring-inset ring-border">
          <Sparkles size={11} className="text-primary" aria-hidden />
          Configurar plano
        </div>
        <h2 className="mt-3 text-xl sm:text-2xl font-bold tracking-tight">
          Conte como é a sua rotina
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">
          Vamos montar um cronograma semanal sob medida — com teoria, questões,
          revisões, redações e simulados distribuídos até o dia da prova.
        </p>
      </div>
      <div className="p-6 sm:p-8 space-y-8">
      <Field label="Prova que você vai estudar">
        <select
          value={examId}
          onChange={(e) => {
            const next = getExamOption(e.target.value);
            setExamId(next.id);
            if (next.id !== "custom") setExamDate(next.date);
          }}
          className="w-full md:w-80 min-h-11 px-3 rounded-lg border border-border bg-background text-sm"
        >
          {EXAM_OPTIONS.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1.5">
          {getExamOption(examId).note}
        </p>
      </Field>

      <Field label="Data da prova">
        <input
          type="date"
          value={examDate}
          min={isoDateInput(new Date())}
          onChange={(e) => setExamDate(e.target.value)}
          required
          className="w-full md:w-64 min-h-11 px-3 rounded-lg border border-border bg-background text-sm"
        />
      </Field>

      <Field label={`Horas disponíveis por dia: ${hoursPerDay}h`}>
        <input
          type="range"
          min={0.5}
          max={8}
          step={0.5}
          value={hoursPerDay}
          onChange={(e) => setHoursPerDay(Number(e.target.value))}
          className="w-full md:w-96 accent-primary"
        />
      </Field>

      <Field label="Dias da semana em que posso estudar">
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => {
            const active = weekdays.includes(d.id);
            return (
              <button
                type="button"
                key={d.id}
                onClick={() => toggleDay(d.id)}
                aria-pressed={active}
                className={
                  "min-h-11 px-4 rounded-full text-sm font-semibold border transition-all " +
                  (active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-border bg-background hover:bg-accent hover:border-foreground/30")
                }
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Áreas mais difíceis (peso extra)">
        <div className="grid sm:grid-cols-2 gap-3">
          {AREAS.map((a) => {
            const active = hardAreas.includes(a.id);
            return (
              <button
                type="button"
                key={a.id}
                onClick={() => toggleHard(a.id)}
                aria-pressed={active}
                className={
                  "text-left p-4 rounded-xl border transition-all " +
                  (active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-border bg-background hover:bg-accent hover:border-foreground/30")
                }
              >
                <div className="text-sm font-semibold">{a.label}</div>
                <div
                  className={
                    "text-xs mt-1 " +
                    (active ? "text-primary-foreground/80" : "text-muted-foreground")
                  }
                >
                  {active ? "Foco extra ativado" : "Toque para priorizar"}
                </div>
              </button>
            );
          })}
        </div>
      </Field>

      <Field
        label={
          subjects.length
            ? `Matérias específicas (${subjects.length} selecionada${subjects.length === 1 ? "" : "s"})`
            : "Matérias específicas (opcional — vazio = todas as áreas)"
        }
      >
        <p className="text-xs text-muted-foreground -mt-1 mb-3">
          Escolha exatamente o que quer estudar. Se nenhuma for selecionada, o
          plano cobre todas as áreas.
        </p>
        <div className="space-y-4">
          {SUBJECT_AREAS.filter((a) => a.id !== "redacao").map((area) => {
            const areaSubjects = SUBJECTS.filter((s) => s.area === area.id);
            const areaSelected = areaSubjects.filter((s) => subjects.includes(s.id)).length;
            const allSelected = areaSelected === areaSubjects.length;
            return (
              <div key={area.id} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {area.label}
                    {areaSelected > 0 && (
                      <span className="ml-2 text-primary normal-case tracking-normal">
                        {areaSelected}/{areaSubjects.length}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSubjects((prev) =>
                        allSelected
                          ? prev.filter((id) => !areaSubjects.some((s) => s.id === id))
                          : Array.from(new Set([...prev, ...areaSubjects.map((s) => s.id)])),
                      )
                    }
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    {allSelected ? "Limpar" : "Selecionar todas"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {areaSubjects.map((s) => {
                    const active = subjects.includes(s.id);
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => toggleSubject(s.id)}
                        aria-pressed={active}
                        className={
                          "min-h-9 px-3 rounded-full text-xs font-semibold border transition-all " +
                          (active
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "border-border bg-background hover:bg-accent hover:border-foreground/30")
                        }
                      >
                        {s.name}
                        <span
                          className={
                            "ml-1.5 text-[10px] font-mono " +
                            (active ? "text-primary-foreground/70" : "text-muted-foreground")
                          }
                        >
                          {s.difficulty[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Field>


      <Field label={`Objetivo de nota: ${targetScore}`}>
        <input
          type="range"
          min={300}
          max={1000}
          step={10}
          value={targetScore}
          onChange={(e) => setTargetScore(Number(e.target.value))}
          className="w-full md:w-96 accent-primary"
        />
      </Field>

      <Field label="Foco principal">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "balanced", label: "Equilibrado" },
              { id: "redacao", label: "Redação" },
              { id: "matematica", label: "Matemática" },
              { id: "natureza", label: "Natureza" },
              { id: "humanas", label: "Humanas" },
              { id: "linguagens", label: "Linguagens" },
            ] as { id: Focus; label: string }[]
          ).map((opt) => {
            const active = focus === opt.id;
            return (
              <button
                type="button"
                key={opt.id}
                onClick={() => setFocus(opt.id)}
                aria-pressed={active}
                className={
                  "min-h-11 px-4 rounded-full text-sm font-semibold border transition-all " +
                  (active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-border bg-background hover:bg-accent hover:border-foreground/30")
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Variação semanal (o quanto o cronograma muda de uma semana para a outra)">
        <div data-hint="plano.variacao" className="flex flex-wrap gap-2">
          {(
            [
              { id: "baixa", label: "Baixa", desc: "Rotina previsível" },
              { id: "media", label: "Média", desc: "Equilíbrio recomendado" },
              { id: "alta", label: "Alta", desc: "Novos formatos toda semana" },
            ] as { id: Variation; label: string; desc: string }[]
          ).map((opt) => {
            const active = variation === opt.id;
            return (
              <button
                type="button"
                key={opt.id}
                onClick={() => setVariation(opt.id)}
                aria-pressed={active}
                className={
                  "min-h-11 px-4 rounded-full text-sm font-semibold border transition-all text-left " +
                  (active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-border bg-background hover:bg-accent hover:border-foreground/30")
                }
              >
                {opt.label}
                <span className={"ml-2 text-[10px] font-normal " + (active ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>
      </Field>


      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={!canSubmit}
          data-tour="plano-gerar"
          className="inline-flex items-center justify-center gap-2 min-h-11 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sparkles size={16} aria-hidden />
          Gerar plano
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center min-h-11 px-6 rounded-lg border border-border bg-background text-sm font-semibold hover:bg-accent"
          >
            Cancelar
          </button>
        )}
      </div>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-3">
        {label}
      </label>
      {children}
    </div>
  );
}

function PlanView({
  plan,
  mastery,
  onToggleDone,
  onEdit,
  onClear,
}: {
  plan: NonNullable<ReturnType<typeof useStudyPlan>["plan"]>;
  mastery: TopicMastery[];
  onToggleDone: (id: string) => void;
  onEdit: () => void;
  onClear: () => void;
}) {
  const today = new Date();
  const [weekStart, setWeekStart] = useState(0);
  const enrichFn = useServerFn(enrichStudyPlan);
  const signalsFn = useServerFn(getPersonalizationSignals);
  const enrichMutation = useMutation({
    mutationFn: async () => {
      const todayIso = new Date().toISOString().slice(0, 10);
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 14);
      const horizonIso = horizon.toISOString().slice(0, 10);
      const window = plan.tasks
        .filter((t) => t.date >= todayIso && t.date <= horizonIso)
        .slice(0, 40);
      if (!window.length) throw new Error("Sem tarefas nos próximos 14 dias para enriquecer.");
      const weakTopics = mastery
        .filter((m) => m.last_score < 0.6)
        .sort((a, b) => a.last_score - b.last_score)
        .slice(0, 10)
        .map((m) => ({ title: m.topic_slug, area: m.area, score: m.last_score }));
      const signals = await signalsFn().catch(() => ({
        recentErrors: [] as string[],
        watchedVideos: [] as { title: string; channel: string | null }[],
      }));
      return enrichFn({
        data: {
          focus: plan.config.focus,
          examName: plan.config.examName || getExamOption(plan.config.examId).label,
          hoursPerDay: plan.config.hoursPerDay,
          targetScore: plan.config.targetScore,
          hardAreas: plan.config.hardAreas,
          weakTopics,
          recentErrors: signals.recentErrors,
          watchedVideos: signals.watchedVideos,
          tasks: window.map((t) => ({
            id: t.id,
            date: t.date,
            title: t.title,
            area: t.area,
            type: t.type,
            minutes: t.minutes,
            topicTitle: t.topicSlug,
          })),
        },
      });
    },

    onSuccess: (res) => {
      applyAiEnrichment(res.updates);
      toast.success(`IA reescreveu ${res.updates.length} tarefa${res.updates.length === 1 ? "" : "s"}.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dates = useMemo(() => {
    const base = new Date(today);
    base.setDate(base.getDate() + weekStart * 7);
    const all = weekDates(base);
    const active = new Set(plan.config.weekdays ?? [1, 2, 3, 4, 5, 6]);
    return all.filter((iso) => active.has(new Date(iso + "T00:00:00").getDay()));
  }, [weekStart, today, plan.config.weekdays]);


  const total = plan.tasks.length;
  const done = plan.tasks.filter((t) => t.status === "concluida").length;
  const late = plan.tasks.filter((t) => resolvedStatus(t) === "atrasada").length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const weekTasks = plan.tasks.filter((t) => dates.includes(t.date));
  const weekDone = weekTasks.filter((t) => t.status === "concluida").length;
  const weekPct = weekTasks.length
    ? Math.round((weekDone / weekTasks.length) * 100)
    : 0;

  const weekLabel =
    weekStart === 0
      ? "Esta semana"
      : weekStart < 0
        ? `${Math.abs(weekStart)} ${Math.abs(weekStart) === 1 ? "semana atrás" : "semanas atrás"}`
        : `Daqui a ${weekStart} ${weekStart === 1 ? "semana" : "semanas"}`;

  return (
    <div className="space-y-8">
      {/* Summary stats */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Stat
          icon={<CalendarCheck size={16} />}
          label="Tarefas totais"
          value={`${total}`}
          tone="neutral"
        />
        <Stat
          icon={<CheckCircle2 size={16} />}
          label="Concluídas"
          value={`${done}`}
          unit={`${pct}%`}
          bar={pct}
          tone="success"
        />
        <Stat
          icon={<AlertCircle size={16} />}
          label="Atrasadas"
          value={`${late}`}
          tone={late > 0 ? "danger" : "neutral"}
        />
        <Stat
          icon={<Target size={16} />}
          label="Meta de nota"
          value={`${plan.config.targetScore}`}
          tone="primary"
        />
        <Stat
          icon={<Clock size={16} />}
          label="Horas por dia"
          value={`${plan.config.hoursPerDay}h`}
          unit={`${plan.config.weekdays.length} dias/semana`}
          tone="primary"
        />
      </section>

      <MasteryPanel plan={plan} mastery={mastery} />



      {/* Week navigation */}
      <section className="bg-card border border-border rounded-2xl shadow-sm p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-1 bg-muted/60 rounded-full p-1 self-start">
            <button
              onClick={() => setWeekStart((w) => w - 1)}
              aria-label="Voltar uma semana"
              className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-background text-foreground/70 hover:text-foreground transition"
            >
              <ChevronLeft size={18} />
            </button>
            {[
              { offset: -1, label: "Semana anterior" },
              { offset: 0, label: "Esta semana" },
              { offset: 1, label: "Próxima semana" },
            ].map((tab) => {
              const active = weekStart === tab.offset;
              return (
                <button
                  key={tab.offset}
                  onClick={() => setWeekStart(tab.offset)}
                  aria-pressed={active}
                  className={
                    "h-9 px-3 sm:px-4 rounded-full text-xs sm:text-sm font-semibold transition whitespace-nowrap " +
                    (active
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                      : "text-foreground/70 hover:text-foreground hover:bg-background/60")
                  }
                >
                  {tab.label}
                </button>
              );
            })}
            {weekStart !== 0 && weekStart !== -1 && weekStart !== 1 && (
              <span className="h-9 px-3 inline-flex items-center text-xs font-semibold text-primary">
                {weekLabel}
              </span>
            )}
            <button
              onClick={() => setWeekStart((w) => w + 1)}
              aria-label="Avançar uma semana"
              className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-background text-foreground/70 hover:text-foreground transition"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => enrichMutation.mutate()}
              disabled={enrichMutation.isPending}
              className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg border border-primary/30 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/15 transition disabled:opacity-60"
            >
              {enrichMutation.isPending ? (
                <Loader2 size={14} aria-hidden className="animate-spin" />
              ) : (
                <Wand2 size={14} aria-hidden />
              )}
              {enrichMutation.isPending ? "Enriquecendo…" : "Enriquecer com IA"}
            </button>
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg border border-border bg-background text-sm font-semibold hover:bg-accent transition"
            >
              <RefreshCw size={14} aria-hidden />
              Regenerar
            </button>
            <button
              onClick={onClear}
              className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm font-semibold hover:bg-destructive/10 hover:border-destructive/50 transition"
            >
              <Trash2 size={14} aria-hidden />
              Apagar
            </button>
          </div>
        </div>

        {/* Week progress */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground/80">
              <strong className="font-semibold text-foreground">
                {weekDone}
              </strong>{" "}
              de{" "}
              <strong className="font-semibold text-foreground">
                {weekTasks.length}
              </strong>{" "}
              tarefas concluídas nesta semana
            </span>
            <span className="font-semibold text-foreground tabular-nums">
              {weekPct}%
            </span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${weekPct}%` }}
            />
          </div>
        </div>
      </section>
      {/* Stage-driven tasks (from learning-progress) */}
      <StageTasksSection />

      {/* Weekly rail — horizontal scroll preserves card readability */}
      <WeeklyRail>
        {dates.map((iso) => {
          const dayTasks = plan.tasks.filter((t) => t.date === iso);
          const isToday = iso === isoDateInput(new Date());
          const isPast = iso < isoDateInput(new Date());
          const dayDone = dayTasks.filter((t) => t.status === "concluida").length;
          const [wd, dm] = formatDayParts(iso);
          return (
            <article
              key={iso}
              data-today={isToday ? "true" : undefined}
              className={
                "shrink-0 w-[260px] snap-start rounded-2xl border bg-card shadow-sm flex flex-col transition-all " +
                (isToday
                  ? "border-primary/50 ring-2 ring-primary/20 shadow-md"
                  : "border-border hover:shadow-md")
              }
            >
              <header
                className={
                  "flex items-center justify-between gap-2 px-3 pt-3 pb-2 " +
                  (isToday ? "" : "")
                }
              >
                <div className="min-w-0">
                  <div
                    className={
                      "text-sm font-bold capitalize " +
                      (isToday ? "text-primary" : "text-foreground")
                    }
                  >
                    {wd}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{dm}</div>
                </div>
                {isToday ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-primary text-primary-foreground shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" />
                    Hoje
                  </span>
                ) : dayTasks.length > 0 && dayDone === dayTasks.length ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
                    <Check size={10} />
                    Feito
                  </span>
                ) : null}
              </header>

              <div className="px-3 pb-3 flex-1">
                {dayTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-6 px-3 rounded-xl bg-muted/40 border border-dashed border-border">
                    <Coffee
                      size={20}
                      aria-hidden
                      className="text-muted-foreground"
                    />
                    <p className="mt-2 text-sm font-medium text-foreground/80">
                      Dia de descanso
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Recarregue para render mais
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {dayTasks.map((t) => (
                      <li key={t.id}>
                        <TaskCard
                          task={t}
                          isPastDay={isPast}
                          onToggle={() => onToggleDone(t.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          );
        })}
      </WeeklyRail>
    </div>
  );
}

function WeeklyRail({ children }: { children: React.ReactNode }) {
  const railRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const target = rail.querySelector<HTMLElement>('[data-today="true"]');
    const el = target ?? (rail.firstElementChild as HTMLElement | null);
    if (!el) return;
    // centraliza o card do dia dentro da régua
    const left = el.offsetLeft - (rail.clientWidth - el.clientWidth) / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: "auto" });
  }, [children]);
  return (
    <section
      ref={railRef}
      className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory scroll-smooth"
    >
      {children}
    </section>
  );
}

function TaskCard({
  task,
  isPastDay,
  onToggle,
}: {
  task: StudyTask;
  isPastDay: boolean;
  onToggle: () => void;
}) {
  const status = resolvedStatus(task);
  const done = status === "concluida";
  const late = status === "atrasada";
  const style = TYPE_STYLES[task.type];
  const Icon = style.icon;

  return (
    <div
      className={
        "group rounded-xl border p-2.5 transition-all " +
        (done
          ? "border-emerald-500/30 bg-emerald-500/5"
          : late
            ? "border-destructive/30 bg-destructive/5"
            : "border-border bg-background hover:border-foreground/20 hover:shadow-sm")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide min-w-0 truncate " +
            style.chip
          }
        >
          <Icon size={10} aria-hidden />
          <span className="truncate">{typeLabel(task.type)}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
          <Clock size={11} aria-hidden />
          {task.minutes}min
        </span>
      </div>

      <h3
        className={
          "mt-2 text-sm font-semibold leading-snug text-foreground break-words " +
          (done ? "line-through text-muted-foreground" : "")
        }
      >
        {task.title}
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground capitalize truncate">
        {areaLabel(task.area)}
      </p>

      {task.note && (
        <p className="mt-2 text-[11px] leading-snug text-foreground/70 border-l-2 border-primary/40 pl-2">
          {task.note}
        </p>
      )}

      {task.aiEnriched && (
        <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
          <Wand2 size={10} aria-hidden /> Enriquecido por IA
        </span>
      )}

      {late && !done && (
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
          <AlertCircle size={11} aria-hidden /> Atrasada
        </p>
      )}


      <div className="mt-3 flex flex-col gap-1.5">
        {done ? (
          <span className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={12} aria-hidden /> Concluída
          </span>
        ) : (
          <TaskCta task={task} />
        )}
        <button
          onClick={onToggle}
          aria-label={done ? "Desfazer conclusão" : "Marcar tarefa como concluída"}
          className={
            "inline-flex items-center justify-center gap-1.5 w-full min-h-9 px-3 rounded-md text-xs font-semibold transition " +
            (done
              ? "border border-border bg-background text-foreground/70 hover:bg-accent"
              : "bg-foreground text-background hover:opacity-90")
          }
        >
          {done ? (
            <>
              <Undo2 size={12} aria-hidden />
              Desfazer
            </>
          ) : (
            <>
              <Check size={12} aria-hidden />
              Concluir
            </>
          )}
        </button>
      </div>
      {/* keep variable referenced for future highlight rules */}
      <span className="sr-only">{isPastDay ? "Dia passado" : ""}</span>
    </div>
  );
}

function formatDayParts(iso: string): [string, string] {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = dt.toLocaleDateString("pt-BR", { weekday: "long" }).replace(
    "-feira",
    "",
  );
  const dm = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return [wd, dm];
}

function ctaFor(
  t: StudyTask,
): {
  to: "/questoes" | "/simulados" | "/redacao" | "/revisar";
  label: string;
} | null {
  switch (t.type) {
    case "questoes":
      return { to: "/questoes", label: "Praticar" };
    case "prova_antiga":
      return { to: "/simulados", label: "Abrir provas" };
    case "simulado":
      return { to: "/simulados", label: "Iniciar" };
    case "redacao":
      return { to: "/redacao", label: "Escrever" };
    case "revisao":
      return { to: "/revisar", label: "Revisar" };
    case "flashcards":
      return { to: "/revisar", label: "Estudar cards" };
    default:
      return null;
  }
}

// Smart CTA — for teoria/redacao we integrate with the "Estudar" flow:
// - teoria: resolve topic (by slug or area) then open /aula/$topicId
//   with taskId so the aula auto-completes the schedule task on finish.
// - redacao: if the student has a recent essayTask cached from a lesson,
//   propose writing directly on that topic (opens /aula/$topicId/pratica).
//   Otherwise falls back to the generic /redacao route.
function TaskCta({ task }: { task: StudyTask }) {
  const navigate = useNavigate();
  const resolve = useServerFn(resolveStudyTopic);
  const lastEssays = useLastEssayTasks();

  const openLessonMutation = useMutation({
    mutationFn: async () => {
      const topic = await resolve({
        data: {
          slug: task.topicSlug,
          area: task.topicArea,
        },
      });
      return topic;
    },
    onSuccess: (topic) => {
      navigate({
        to: "/aula/$topicId",
        params: { topicId: topic.id },
        search: { taskId: task.id },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lessonTypes: StudyTask["type"][] = ["teoria", "videoaula", "mapa_mental", "resumo", "projeto"];
  if (lessonTypes.includes(task.type)) {
    const canResolve = !!(task.topicSlug || task.topicArea);
    if (!canResolve) {
      return (
        <Link
          to="/estudos"
          className="inline-flex items-center justify-center gap-1 w-full min-h-8 text-xs font-semibold text-primary hover:underline"
        >
          Estudar
          <ArrowRight size={12} aria-hidden />
        </Link>
      );
    }
    return (
      <button
        type="button"
        onClick={() => openLessonMutation.mutate()}
        disabled={openLessonMutation.isPending}
        className="inline-flex items-center justify-center gap-1 w-full min-h-8 text-xs font-semibold text-primary hover:underline disabled:opacity-60"
      >
        {openLessonMutation.isPending ? "Abrindo aula…" : "Estudar (vídeos + atividade)"}
        <ArrowRight size={12} aria-hidden />
      </button>
    );
  }

  if (task.type === "redacao") {
    // Try to reuse the most recent essayTask cached from a lesson of any
    // area — the aula's essayTask is already focused on a concrete skill.
    const candidates = Object.values(lastEssays).sort((a, b) => b.savedAt - a.savedAt);
    const recent = candidates[0];
    if (recent) {
      return (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() =>
              navigate({
                to: "/aula/$topicId/pratica",
                params: { topicId: recent.topicId },
                search: { taskId: task.id },
              })
            }
            className="inline-flex items-center justify-center gap-1 w-full min-h-8 text-xs font-semibold text-primary hover:underline text-left"
          >
            Escrever sobre "{recent.topicTitle}"
            <ArrowRight size={12} aria-hidden />
          </button>
          <Link
            to="/redacao"
            className="text-[10px] text-muted-foreground text-center hover:underline"
          >
            ou usar tema livre
          </Link>
        </div>
      );
    }
  }

  const cta = ctaFor(task);
  if (!cta) return null;
  return (
    <Link
      to={cta.to}
      className="inline-flex items-center justify-center gap-1 w-full min-h-8 text-xs font-semibold text-primary hover:underline"
    >
      {cta.label}
      <ArrowRight size={12} aria-hidden />
    </Link>
  );
}

function Stat({
  icon,
  label,
  value,
  unit,
  bar,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  bar?: number;
  tone?: "neutral" | "primary" | "success" | "danger";
}) {
  const toneStyles: Record<string, string> = {
    neutral: "bg-muted/60 text-foreground/70",
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    danger: "bg-destructive/10 text-destructive",
  };
  const barColor: Record<string, string> = {
    neutral: "bg-foreground/60",
    primary: "bg-primary",
    success: "bg-emerald-500",
    danger: "bg-destructive",
  };
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-5 flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm font-medium text-muted-foreground">
          {label}
        </span>
        <span
          aria-hidden
          className={
            "h-8 w-8 rounded-full flex items-center justify-center " +
            toneStyles[tone]
          }
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-medium text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      {typeof bar === "number" && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={"h-full rounded-full transition-all duration-500 " + barColor[tone]}
            style={{ width: `${bar}%` }}
          />
        </div>
      )}
    </div>
  );
}

function MasteryPanel({
  plan,
  mastery,
}: {
  plan: NonNullable<ReturnType<typeof useStudyPlan>["plan"]>;
  mastery: TopicMastery[];
}) {
  const overdue = countOverdue(plan);
  const mastered = mastery.filter((m) => m.mastered).length;
  const reforco = mastery.filter((m) => !m.mastered && m.last_score < 0.6).length;
  const hoje = Date.now();
  const revisoes = mastery.filter(
    (m) => new Date(m.next_review_at).getTime() <= hoje,
  ).length;

  if (overdue === 0 && mastery.length === 0) return null;

  return (
    <section className="bg-card border border-border rounded-2xl shadow-sm p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {mastery.length > 0 && (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 ring-1 ring-inset ring-emerald-500/20">
                <CheckCircle2 size={12} /> {mastered} dominados
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2.5 py-1 ring-1 ring-inset ring-amber-500/20">
                <Repeat size={12} /> {revisoes} revisões devidas
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 px-2.5 py-1 ring-1 ring-inset ring-rose-500/20">
                <AlertCircle size={12} /> {reforco} precisam reforço
              </span>
            </>
          )}
          {overdue > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-300 px-2.5 py-1 ring-1 ring-inset ring-orange-500/25">
              <Clock size={12} /> {overdue} {overdue === 1 ? "tarefa atrasada" : "tarefas atrasadas"}
            </span>
          )}
        </div>
        {overdue > 0 && (
          <button
            onClick={() => {
              rescheduleOverdue(plan);
              toast.success(
                `${overdue} ${overdue === 1 ? "tarefa reagendada" : "tarefas reagendadas"} para os próximos dias.`,
              );
            }}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-md bg-foreground text-background text-xs font-semibold px-3 py-1.5 hover:opacity-90 transition"
          >
            <CalendarDays size={14} /> Reagendar atrasadas
          </button>
        )}
      </div>
    </section>
  );
}

