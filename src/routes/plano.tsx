import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AREAS, useProgress, type Area } from "@/lib/storage";
import {
  WEEKDAYS,
  useStudyPlan,
  type StudyPlanConfig,
  type Focus,
  type StudyTask,
  type TaskType,
  resolvedStatus,
  weekDates,
  dateLabel,
  areaLabel,
  typeLabel,
} from "@/lib/study-plan";

export const Route = createFileRoute("/plano")({
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

const TYPE_BADGE: Record<TaskType, string> = {
  teoria: "border-blue-500/40 text-blue-600 dark:text-blue-400",
  questoes: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  revisao: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  simulado: "border-purple-500/40 text-purple-600 dark:text-purple-400",
  redacao: "border-pink-500/40 text-pink-600 dark:text-pink-400",
};

function Plano() {
  const { plan, savePlan, clearPlan, toggleDone } = useStudyPlan();
  const { progress } = useProgress();
  const [editing, setEditing] = useState(false);

  if (!plan || editing) {
    return (
      <Shell>
        <PlanForm
          initial={plan?.config}
          defaultExamDate={progress.examDate}
          onCancel={plan ? () => setEditing(false) : undefined}
          onSubmit={(cfg) => {
            savePlan(cfg);
            setEditing(false);
          }}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <PlanView
        plan={plan}
        onToggleDone={toggleDone}
        onEdit={() => setEditing(true)}
        onClear={() => {
          if (confirm("Apagar o plano atual?")) clearPlan();
        }}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <Nav />
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        <header className="mb-8 border-b border-border pb-6">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Plano de Estudos
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">
            Seu cronograma pessoal até a prova.
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Geramos tarefas diárias balanceadas com teoria, questões, revisões, simulados e redação.
          </p>
        </header>
        {children}
      </main>
      <Footer />
    </div>
  );
}

function PlanForm({
  initial,
  defaultExamDate,
  onSubmit,
  onCancel,
}: {
  initial?: StudyPlanConfig;
  defaultExamDate: string;
  onSubmit: (cfg: StudyPlanConfig) => void;
  onCancel?: () => void;
}) {
  const [examDate, setExamDate] = useState<string>(
    initial?.examDate
      ? isoDateInput(new Date(initial.examDate))
      : isoDateInput(new Date(defaultExamDate)),
  );
  const [hoursPerDay, setHoursPerDay] = useState<number>(initial?.hoursPerDay ?? 2);
  const [weekdays, setWeekdays] = useState<number[]>(
    initial?.weekdays ?? [1, 2, 3, 4, 5, 6],
  );
  const [hardAreas, setHardAreas] = useState<Area[]>(initial?.hardAreas ?? []);
  const [targetScore, setTargetScore] = useState<number>(initial?.targetScore ?? 700);
  const [focus, setFocus] = useState<Focus>(initial?.focus ?? "balanced");

  function toggleDay(d: number) {
    setWeekdays((w) =>
      w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort((a, b) => a - b),
    );
  }
  function toggleHard(a: Area) {
    setHardAreas((h) => (h.includes(a) ? h.filter((x) => x !== a) : [...h, a]));
  }

  const canSubmit =
    weekdays.length > 0 && hoursPerDay > 0 && hoursPerDay <= 12 && !!examDate;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({
          examDate: new Date(examDate + "T00:00:00").toISOString(),
          hoursPerDay,
          weekdays,
          hardAreas,
          targetScore,
          focus,
        });
      }}
      className="space-y-8"
    >
      <Field label="Data da prova">
        <input
          type="date"
          value={examDate}
          min={isoDateInput(new Date())}
          onChange={(e) => setExamDate(e.target.value)}
          required
          className="w-full md:w-64 px-3 py-2 border border-border bg-background text-sm"
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
          className="w-full md:w-96"
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
                className={
                  "px-3 py-2 text-xs font-mono uppercase tracking-widest border transition-all " +
                  (active
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:border-foreground")
                }
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Áreas mais difíceis (peso extra)">
        <div className="grid sm:grid-cols-2 gap-2">
          {AREAS.map((a) => {
            const active = hardAreas.includes(a.id);
            return (
              <button
                type="button"
                key={a.id}
                onClick={() => toggleHard(a.id)}
                className={
                  "text-left p-3 border transition-all " +
                  (active
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:border-foreground")
                }
              >
                <div className="text-sm font-bold">{a.label}</div>
                <div
                  className={
                    "text-[10px] mt-0.5 font-mono uppercase " +
                    (active ? "text-background/70" : "text-muted-foreground")
                  }
                >
                  {active ? "Foco extra" : "Toque para marcar"}
                </div>
              </button>
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
          className="w-full md:w-96"
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
                className={
                  "px-4 py-2 text-xs font-bold uppercase tracking-widest border transition-all " +
                  (active
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:border-foreground")
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="flex gap-3 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-6 py-3 bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-primary transition-all disabled:opacity-30"
        >
          Gerar plano
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 border border-border font-bold text-xs uppercase tracking-widest hover:border-foreground"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function PlanView({
  plan,
  onToggleDone,
  onEdit,
  onClear,
}: {
  plan: NonNullable<ReturnType<typeof useStudyPlan>["plan"]>;
  onToggleDone: (id: string) => void;
  onEdit: () => void;
  onClear: () => void;
}) {
  const today = new Date();
  const [weekStart, setWeekStart] = useState(0); // weeks offset from current

  const dates = useMemo(() => {
    const base = new Date(today);
    base.setDate(base.getDate() + weekStart * 7);
    return weekDates(base);
  }, [weekStart, today]);

  const total = plan.tasks.length;
  const done = plan.tasks.filter((t) => t.status === "concluida").length;
  const late = plan.tasks.filter((t) => resolvedStatus(t) === "atrasada").length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Summary */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
        <Stat label="Tarefas totais" value={`${total}`} />
        <Stat label="Concluídas" value={`${done}`} unit={`${pct}%`} bar={pct} />
        <Stat label="Atrasadas" value={`${late}`} />
        <Stat
          label="Meta de nota"
          value={`${plan.config.targetScore}`}
          unit={`${plan.config.hoursPerDay}h/dia`}
        />
      </section>

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setWeekStart((w) => w - 1)}
            className="px-3 py-2 border border-border text-xs font-mono uppercase tracking-widest hover:border-foreground"
          >
            ← Semana anterior
          </button>
          <button
            onClick={() => setWeekStart(0)}
            className="px-3 py-2 border border-border text-xs font-mono uppercase tracking-widest hover:border-foreground"
          >
            Esta semana
          </button>
          <button
            onClick={() => setWeekStart((w) => w + 1)}
            className="px-3 py-2 border border-border text-xs font-mono uppercase tracking-widest hover:border-foreground"
          >
            Próxima semana →
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="px-3 py-2 border border-border text-xs font-mono uppercase tracking-widest hover:border-foreground"
          >
            Regerar
          </button>
          <button
            onClick={onClear}
            className="px-3 py-2 border border-border text-xs font-mono uppercase tracking-widest hover:border-destructive hover:text-destructive"
          >
            Apagar
          </button>
        </div>
      </div>

      {/* Weekly grid */}
      <section className="grid md:grid-cols-2 xl:grid-cols-7 gap-3">
        {dates.map((iso) => {
          const dayTasks = plan.tasks.filter((t) => t.date === iso);
          const isToday = iso === isoDateInput(new Date());
          return (
            <div
              key={iso}
              className={
                "border bg-card p-3 flex flex-col " +
                (isToday ? "border-foreground" : "border-border")
              }
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  {dateLabel(iso)}
                </span>
                {isToday && (
                  <span className="text-[9px] font-mono uppercase bg-foreground text-background px-1.5 py-0.5">
                    Hoje
                  </span>
                )}
              </div>
              {dayTasks.length === 0 ? (
                <div className="text-[11px] text-muted-foreground italic">Descanso</div>
              ) : (
                <div className="space-y-2">
                  {dayTasks.map((t) => (
                    <TaskCard key={t.id} task={t} onToggle={() => onToggleDone(t.id)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function TaskCard({ task, onToggle }: { task: StudyTask; onToggle: () => void }) {
  const status = resolvedStatus(task);
  const done = status === "concluida";
  const late = status === "atrasada";
  const cta = ctaFor(task);
  return (
    <div
      className={
        "border p-2 text-xs space-y-1 transition-all " +
        (done
          ? "border-emerald-500/40 bg-emerald-500/5 opacity-70"
          : late
            ? "border-destructive/40 bg-destructive/5"
            : "border-border bg-background")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={
            "text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 border " +
            TYPE_BADGE[task.type]
          }
        >
          {typeLabel(task.type)}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground">
          {task.minutes}min
        </span>
      </div>
      <div className={"font-bold leading-tight " + (done ? "line-through" : "")}>
        {task.title}
      </div>
      <div className="text-[10px] text-muted-foreground">{areaLabel(task.area)}</div>
      <div className="flex items-center justify-between pt-1">
        {cta ? (
          <Link
            to={cta.to}
            className="text-[10px] font-mono uppercase tracking-widest text-primary hover:underline"
          >
            {cta.label} →
          </Link>
        ) : (
          <span />
        )}
        <button
          onClick={onToggle}
          className="text-[10px] font-mono uppercase tracking-widest border border-border px-2 py-1 hover:border-foreground"
        >
          {done ? "Desfazer" : "Concluir"}
        </button>
      </div>
      {late && !done && (
        <div className="text-[9px] font-mono uppercase text-destructive">Atrasada</div>
      )}
    </div>
  );
}

function ctaFor(t: StudyTask): { to: "/questoes" | "/simulados" | "/redacao" | "/revisar" | "/tutor"; label: string } | null {
  switch (t.type) {
    case "questoes":
      return { to: "/questoes", label: "Praticar" };
    case "simulado":
      return { to: "/simulados", label: "Iniciar" };
    case "redacao":
      return { to: "/redacao", label: "Escrever" };
    case "revisao":
      return { to: "/revisar", label: "Revisar" };
    case "teoria":
      return { to: "/tutor", label: "Estudar" };
    default:
      return null;
  }
}

function Stat({
  label,
  value,
  unit,
  bar,
}: {
  label: string;
  value: string;
  unit?: string;
  bar?: number;
}) {
  return (
    <div className="bg-background p-4 flex flex-col justify-between min-h-[110px]">
      <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <div className="mt-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold tracking-tighter">{value}</span>
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
