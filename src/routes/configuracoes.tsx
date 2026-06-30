import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Nav } from "@/components/Nav";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  useProgress,
  resetProgress,
  exportProgress,
  daysUntilExam,
} from "@/lib/storage";
import {
  Settings as SettingsIcon,
  Save,
  Download,
  RotateCcw,
  User,
  Target,
  Calendar,
  Clock,
  Moon,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Exame" },
      {
        name: "description",
        content:
          "Ajuste nome, meta de nota, tempo de estudo diário e gerencie seus dados.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { progress, update } = useProgress();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(progress.studentName ?? "");
  const [target, setTarget] = useState(progress.targetScore ?? 700);
  const [daily, setDaily] = useState(progress.dailyMinutes ?? 120);
  const [examDate, setExamDate] = useState(progress.examDate ?? "");

  const days = useMemo(() => daysUntilExam(progress.examDate), [progress.examDate]);

  function handleSave() {
    update({
      studentName: name.trim() || undefined,
      targetScore: Math.max(0, Math.min(1000, Number(target) || 0)),
      dailyMinutes: Math.max(15, Math.min(720, Number(daily) || 60)),
      examDate: examDate || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function handleExport() {
    const data = exportProgress();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exame-progresso-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    resetProgress();
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main id="main" className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <header className="flex items-center gap-3">
          <div className="h-10 w-10 grid place-items-center rounded-lg bg-accent text-foreground">
            <SettingsIcon size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Configurações
            </h1>
            <p className="text-sm text-muted-foreground">
              Ajuste suas preferências, metas e gerencie seus dados.
            </p>
          </div>
        </header>

        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
            Perfil e metas
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nome" icon={User} htmlFor="cfg-name">
              <input
                id="cfg-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Seu nome"
              />
            </Field>

            <Field label="Objetivo de nota" icon={Target} htmlFor="cfg-target">
              <input
                id="cfg-target"
                type="number"
                min={0}
                max={1000}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>

            <Field label="Data da prova" icon={Calendar} htmlFor="cfg-date">
              <input
                id="cfg-date"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {days !== null && (
                <p className="text-xs text-muted-foreground mt-1">
                  Faltam {days} dia(s) para a prova.
                </p>
              )}
            </Field>

            <Field label="Meta diária (minutos)" icon={Clock} htmlFor="cfg-daily">
              <input
                id="cfg-daily"
                type="number"
                min={15}
                max={720}
                step={15}
                value={daily}
                onChange={(e) => setDaily(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 min-h-11"
            >
              <Save size={16} /> Salvar
            </button>
            {saved && (
              <span className="text-xs text-primary font-medium">
                Salvo com sucesso.
              </span>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
            Aparência
          </h2>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 grid place-items-center rounded-md bg-accent">
                <Moon size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Tema do app</p>
                <p className="text-xs text-muted-foreground">
                  Alterne entre claro e escuro.
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
            Dados
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 border border-border px-4 py-2 rounded-md text-sm font-medium hover:bg-accent min-h-11"
            >
              <Download size={16} /> Exportar dados
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center gap-2 border border-destructive/40 text-destructive px-4 py-2 rounded-md text-sm font-medium hover:bg-destructive/10 min-h-11"
            >
              <RotateCcw size={16} /> Resetar progresso
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Seus dados ficam salvos apenas neste navegador. Exportar gera um arquivo JSON.
          </p>
        </section>

        <p className="text-xs text-muted-foreground">
          Procurando estatísticas e histórico?{" "}
          <Link to="/perfil" className="underline hover:text-foreground">
            Veja seu perfil completo
          </Link>
          .
        </p>
      </main>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleReset}
        title="Resetar progresso?"
        message="Esta ação apaga todo o seu histórico, respostas, redações e simulados. Não dá para desfazer."
        confirmLabel="Apagar tudo"
        variant="destructive"
      />
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  htmlFor,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5"
      >
        <Icon size={12} /> {label}
      </label>
      {children}
    </div>
  );
}
