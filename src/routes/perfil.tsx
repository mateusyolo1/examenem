import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useProgress,
  daysUntilExam,
  resetProgress,
  exportProgress,
  AREAS,
  areaStats,
} from "@/lib/storage";
import { QUESTION_AREA_MAP } from "@/lib/questions-data";
import { Nav } from "@/components/Nav";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Download,
  RotateCcw,
  Save,
  User,
  Target,
  Calendar,
  Clock,
  CheckCircle2,
  PenLine,
  FileText,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil do Aluno — Exame" },
      {
        name: "description",
        content:
          "Painel pessoal do aluno: metas, estatísticas, evolução e configurações de estudo para o ENEM.",
      },
    ],
  }),
  component: PerfilPage,
});

function PerfilPage() {
  const { progress, update } = useProgress();

  const [name, setName] = useState(progress.studentName ?? "");
  const [goal, setGoal] = useState(progress.dailyGoal);
  const [target, setTarget] = useState(progress.targetScore ?? 700);
  const [minutes, setMinutes] = useState(progress.dailyMinutes ?? 120);
  const [exam, setExam] = useState(progress.examDate.slice(0, 10));
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Sync local form when underlying progress changes (e.g. reset).
  useMemo(() => {
    setName(progress.studentName ?? "");
    setGoal(progress.dailyGoal);
    setTarget(progress.targetScore ?? 700);
    setMinutes(progress.dailyMinutes ?? 120);
    setExam(progress.examDate.slice(0, 10));
  }, [progress.studentName, progress.dailyGoal, progress.targetScore, progress.dailyMinutes, progress.examDate]);

  const stats = useMemo(() => {
    const answers = Object.values(progress.answers);
    const totalAnswers = answers.length;
    const correct = answers.filter((a) => a.correct).length;
    const accuracy = totalAnswers ? Math.round((correct / totalAnswers) * 100) : 0;

    const distinctDays = new Set(
      answers.map((a) => new Date(a.at).toDateString()),
    ).size;

    // Estimated study time: ~90s per answered question + actual simulado time + ~30min per essay
    const simSecs = progress.simulados.reduce(
      (s, x) => s + (x.spentSec ?? x.durationSec ?? 0),
      0,
    );
    const estimatedSec =
      totalAnswers * 90 + simSecs + progress.essays.length * 1800;

    const byArea = AREAS.map((a) => ({
      ...a,
      ...areaStats(progress, a.id, QUESTION_AREA_MAP),
    }));
    const withData = byArea.filter((a) => a.total > 0);
    const best = withData.length
      ? withData.reduce((a, b) => (a.accuracy >= b.accuracy ? a : b))
      : null;
    const worst = withData.length
      ? withData.reduce((a, b) => (a.accuracy <= b.accuracy ? a : b))
      : null;

    return {
      totalAnswers,
      correct,
      accuracy,
      distinctDays,
      estimatedSec,
      byArea,
      best,
      worst,
    };
  }, [progress]);

  const evolution = useMemo(() => {
    return [...progress.simulados]
      .sort((a, b) => a.at - b.at)
      .map((s) => ({
        at: s.at,
        pct: s.total ? Math.round((s.score / s.total) * 100) : 0,
        score: s.score,
        total: s.total,
      }));
  }, [progress.simulados]);

  function handleSave() {
    update((p) => ({
      ...p,
      studentName: name.trim(),
      dailyGoal: Math.max(1, Math.min(200, Math.floor(goal))),
      targetScore: Math.max(0, Math.min(1000, Math.floor(target))),
      dailyMinutes: Math.max(15, Math.min(720, Math.floor(minutes))),
      examDate: new Date(exam).toISOString(),
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function handleExport() {
    const blob = new Blob([exportProgress()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exame-perfil-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    setConfirmReset(true);
  }


  const examDays = daysUntilExam(progress.examDate);
  const displayName = progress.studentName?.trim() || "Aluno";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <Nav />
      <main id="main" className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 animate-reveal">
      {/* Header */}
      <header className="flex items-center gap-4 sm:gap-5 mb-8 sm:mb-10">
        <div className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold border border-primary/20">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Perfil
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{displayName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Meta: <span className="font-semibold text-foreground">{progress.targetScore ?? 700}</span>{" "}
            · Prova em{" "}
            <span className="font-semibold text-foreground">{examDays}</span> dias
          </p>
        </div>
      </header>

      {/* Stats grid */}
      <section aria-labelledby="stats-h" className="mb-8 sm:mb-10">
        <h2 id="stats-h" className="sr-only">Estatísticas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Target size={16} />}
          label="Objetivo"
          value={String(progress.targetScore ?? 700)}
          hint="/ 1000"
        />
        <StatCard
          icon={<Calendar size={16} />}
          label="Dias até prova"
          value={String(examDays)}
        />
        <StatCard
          icon={<CheckCircle2 size={16} />}
          label="Dias estudados"
          value={String(stats.distinctDays)}
        />
        <StatCard
          icon={<Clock size={16} />}
          label="Tempo estimado"
          value={fmtDuration(stats.estimatedSec)}
        />
        <StatCard
          icon={<User size={16} />}
          label="Questões"
          value={String(stats.totalAnswers)}
          hint={`${stats.accuracy}% acerto`}
        />
        <StatCard
          icon={<PenLine size={16} />}
          label="Redações"
          value={String(progress.essays.length)}
        />
        <StatCard
          icon={<FileText size={16} />}
          label="Simulados"
          value={String(progress.simulados.length)}
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Streak atual"
          value={`${progress.streakDays}d`}
        />
        </div>
      </section>

      {/* Best / Worst */}
      <section className="grid md:grid-cols-2 gap-4 mb-8 sm:mb-10">
        <AreaCard
          tone="success"
          icon={<TrendingUp size={18} />}
          label="Melhor área"
          area={stats.best}
        />
        <AreaCard
          tone="warning"
          icon={<TrendingDown size={18} />}
          label="Área mais fraca"
          area={stats.worst}
        />
      </section>

      {/* Evolution */}
      <section className="mb-8 sm:mb-10">
        <h2 className="text-lg font-bold tracking-tight mb-3">Evolução</h2>
        <div className="bg-card border border-border rounded-lg p-5">
          {evolution.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Faça um simulado para começar a registrar sua evolução.
            </p>
          ) : (
            <EvolutionChart data={evolution} />
          )}
        </div>
      </section>

      {/* Settings */}
      <section className="mb-10">
        <h2 className="text-lg font-bold tracking-tight mb-3">Configurações</h2>
        <div className="bg-card border border-border rounded-lg p-5 grid md:grid-cols-2 gap-4">
          <Field label="Nome" htmlFor="f-name">
            <input
              id="f-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              className="input"
            />
          </Field>
          <Field label="Objetivo de nota (0–1000)" htmlFor="f-target">
            <input
              id="f-target"
              type="number"
              min={0}
              max={1000}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="input"
            />
          </Field>
          <Field label="Meta diária de questões" htmlFor="f-goal">
            <input
              id="f-goal"
              type="number"
              min={1}
              max={200}
              value={goal}
              onChange={(e) => setGoal(Number(e.target.value))}
              className="input"
            />
          </Field>
          <Field label="Tempo disponível por dia (min)" htmlFor="f-min">
            <input
              id="f-min"
              type="number"
              min={15}
              max={720}
              step={15}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="input"
            />
          </Field>
          <Field label="Data da prova" htmlFor="f-exam">
            <input
              id="f-exam"
              type="date"
              value={exam}
              onChange={(e) => setExam(e.target.value)}
              className="input"
            />
          </Field>

          <div className="md:col-span-2 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 pt-3 border-t border-border">
            <button
              onClick={handleSave}
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground min-h-11 px-4 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Save size={14} aria-hidden /> Salvar alterações
            </button>
            <span
              className="text-xs font-mono text-success min-h-5"
              role="status"
              aria-live="polite"
            >
              {saved ? "Salvo ✓" : ""}
            </span>
            <span className="hidden sm:block flex-1" />
            <button
              onClick={handleExport}
              className="inline-flex items-center justify-center gap-2 border border-border min-h-11 px-4 rounded-md text-sm font-medium hover:border-foreground/30 hover:bg-accent transition-colors"
            >
              <Download size={14} aria-hidden /> Exportar dados
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 border border-destructive/40 text-destructive min-h-11 px-4 rounded-md text-sm font-medium hover:bg-destructive/10 transition-colors"
            >
              <RotateCcw size={14} aria-hidden /> Resetar progresso
            </button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirmReset}
        destructive
        title="Resetar todo o progresso?"
        description="Esta ação apaga respostas, simulados, redações e configurações. Não pode ser desfeita."
        confirmLabel="Sim, resetar"
        cancelLabel="Manter dados"
        onConfirm={() => {
          resetProgress();
          setConfirmReset(false);
        }}
        onCancel={() => setConfirmReset(false)}
      />

      <style>{`
        .input {
          width: 100%;
          background: transparent;
          border: 1px solid var(--color-border);
          border-radius: 0.375rem;
          padding: 0.625rem 0.75rem;
          font-size: 0.9375rem;
          color: var(--color-foreground);
          outline: none;
          transition: border-color 0.15s;
          min-height: 2.75rem;
        }
        .input:focus { border-color: var(--color-ring); box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-ring) 30%, transparent); }
      `}</style>
      </main>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-[10px] font-mono uppercase tracking-widest">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold tracking-tight tabular-nums">
        {value}
        {hint && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

function AreaCard({
  tone,
  icon,
  label,
  area,
}: {
  tone: "success" | "warning";
  icon: React.ReactNode;
  label: string;
  area: { id: string; label: string; accuracy: number; correct: number; total: number } | null;
}) {
  const toneClass =
    tone === "success"
      ? "text-success border-success/30 bg-success/5"
      : "text-warning border-warning/30 bg-warning/5";
  return (
    <div className={`border rounded-lg p-5 ${toneClass}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] font-mono uppercase tracking-widest">
          {label}
        </span>
      </div>
      {area ? (
        <>
          <div className="text-xl font-bold text-foreground">{area.label}</div>
          <div className="text-sm text-muted-foreground mt-1 tabular-nums">
            {area.accuracy}% · {area.correct}/{area.total} questões
          </div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground">
          Responda questões para descobrir.
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function EvolutionChart({
  data,
}: {
  data: { at: number; pct: number; score: number; total: number }[];
}) {
  const w = 600;
  const h = 140;
  const pad = 24;
  const xs = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = pad + i * xs;
    const y = h - pad - ((h - pad * 2) * d.pct) / 100;
    return { x, y, d };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const last = data[data.length - 1];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-3xl font-bold tabular-nums">{last.pct}%</div>
          <div className="text-xs text-muted-foreground">
            Último simulado · {last.score}/{last.total}
          </div>
        </div>
        <div className="text-xs font-mono text-muted-foreground">
          {data.length} simulado{data.length > 1 ? "s" : ""}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32">
        <line
          x1={pad}
          x2={w - pad}
          y1={h - pad}
          y2={h - pad}
          stroke="var(--color-border)"
          strokeWidth={1}
        />
        <path
          d={path}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill="var(--color-primary)"
          />
        ))}
      </svg>
    </div>
  );
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}
