import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Nav } from "@/components/Nav";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  useProgress,
  resetProgress,
  exportProgress,
  importProgress,
  wipeAllData,
  daysUntilExam,
} from "@/lib/storage";
import {
  Settings as SettingsIcon,
  Save,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  Target,
  Calendar,
  Clock,
  ListChecks,
  Moon,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { COLOR_SCHEMES, useColorScheme } from "@/lib/color-scheme";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Exame" },
      {
        name: "description",
        content:
          "Ajuste tema, metas, tempo de estudo e gerencie seus dados (exportar, importar, resetar).",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

type Toast = { kind: "ok" | "err"; msg: string } | null;

function ConfiguracoesPage() {
  const { progress, update } = useProgress();
  const [askReset, setAskReset] = useState(false);
  const [askWipe, setAskWipe] = useState(false);
  const [wipeText, setWipeText] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [target, setTarget] = useState(progress.targetScore ?? 700);
  const [daily, setDaily] = useState(progress.dailyMinutes ?? 120);
  const [dailyGoal, setDailyGoal] = useState(progress.dailyGoal ?? 18);
  const [examDate, setExamDate] = useState(
    progress.examDate ? progress.examDate.slice(0, 10) : "",
  );

  const days = useMemo(
    () => (progress.examDate ? daysUntilExam(progress.examDate) : null),
    [progress.examDate],
  );

  function flash(t: Toast) {
    setToast(t);
    if (t) setTimeout(() => setToast(null), 2200);
  }

  function handleSave() {
    update((prev) => ({
      ...prev,
      targetScore: Math.max(0, Math.min(1000, Number(target) || 0)),
      dailyMinutes: Math.max(15, Math.min(720, Number(daily) || 60)),
      dailyGoal: Math.max(1, Math.min(200, Number(dailyGoal) || 1)),
      examDate: examDate ? new Date(examDate).toISOString() : prev.examDate,
    }));
    flash({ kind: "ok", msg: "Configurações salvas." });
  }

  function handleExport() {
    const data = exportProgress();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exame-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash({ kind: "ok", msg: "Backup exportado." });
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    const r = importProgress(text);
    if (r.ok) {
      flash({ kind: "ok", msg: "Dados importados. Recarregando…" });
      setTimeout(() => window.location.reload(), 900);
    } else {
      flash({ kind: "err", msg: r.error });
    }
  }

  function handleReset() {
    resetProgress();
    window.location.reload();
  }

  function handleWipe() {
    wipeAllData();
    window.location.assign("/");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main id="main" className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <header className="flex items-center gap-3">
          <div className="h-10 w-10 grid place-items-center rounded-lg bg-accent text-foreground">
            <SettingsIcon size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Configurações
            </h1>
            <p className="text-sm text-muted-foreground">
              Tema, metas e gerenciamento dos seus dados.
            </p>
          </div>
        </header>

        {toast && (
          <div
            role="status"
            className={
              "rounded-lg border px-4 py-2.5 text-sm font-medium flex items-center gap-2 " +
              (toast.kind === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-destructive/40 bg-destructive/10 text-destructive")
            }
          >
            {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {toast.msg}
          </div>
        )}

        {/* Appearance */}
        <Section title="Aparência">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 grid place-items-center rounded-md bg-accent">
                <Moon size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Modo claro / escuro</p>
                <p className="text-xs text-muted-foreground">
                  Alterne o tema do app a qualquer momento.
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </Section>

        {/* Goals */}
        <Section title="Metas e prova">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Data da prova" icon={Calendar} htmlFor="cfg-date">
              <input
                id="cfg-date"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full min-h-11 bg-background border border-border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {days !== null && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Faltam <strong className="text-foreground">{days}</strong> dia(s) para a prova.
                </p>
              )}
            </Field>

            <Field label="Objetivo de nota" icon={Target} htmlFor="cfg-target">
              <input
                id="cfg-target"
                type="number"
                min={0}
                max={1000}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                className="w-full min-h-11 bg-background border border-border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1.5">Entre 0 e 1000.</p>
            </Field>

            <Field
              label="Meta diária de questões"
              icon={ListChecks}
              htmlFor="cfg-daily-goal"
            >
              <input
                id="cfg-daily-goal"
                type="number"
                min={1}
                max={200}
                value={dailyGoal}
                onChange={(e) => setDailyGoal(Number(e.target.value))}
                className="w-full min-h-11 bg-background border border-border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Quantas questões pretende responder por dia.
              </p>
            </Field>

            <Field
              label="Tempo disponível por dia (min)"
              icon={Clock}
              htmlFor="cfg-daily"
            >
              <input
                id="cfg-daily"
                type="number"
                min={15}
                max={720}
                step={15}
                value={daily}
                onChange={(e) => setDaily(Number(e.target.value))}
                className="w-full min-h-11 bg-background border border-border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                {Math.floor(daily / 60)}h {daily % 60}min por dia.
              </p>
            </Field>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 min-h-11 rounded-md text-sm font-semibold hover:opacity-90"
            >
              <Save size={16} /> Salvar alterações
            </button>
          </div>
        </Section>

        {/* Data management */}
        <Section title="Seus dados">
          <p className="text-sm text-muted-foreground">
            Tudo fica salvo apenas neste navegador. Faça backups exportando um
            arquivo JSON — você pode importá-lo de volta em outro dispositivo.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 border border-border bg-background px-4 min-h-11 rounded-md text-sm font-medium hover:bg-accent"
            >
              <Download size={16} /> Exportar dados
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 border border-border bg-background px-4 min-h-11 rounded-md text-sm font-medium hover:bg-accent"
            >
              <Upload size={16} /> Importar dados
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                e.target.value = "";
              }}
            />
          </div>
        </Section>

        {/* Danger zone */}
        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={16} />
            <h2 className="text-sm font-mono uppercase tracking-widest">
              Zona de risco
            </h2>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Resetar progresso</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Apaga respostas, redações, simulados e streak. Mantém o plano de estudos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAskReset(true)}
              className="inline-flex items-center gap-2 border border-destructive/40 text-destructive bg-background px-4 min-h-11 rounded-md text-sm font-semibold hover:bg-destructive/10 shrink-0"
            >
              <RotateCcw size={16} /> Resetar
            </button>
          </div>

          <div className="rounded-lg border border-destructive/40 bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-destructive">
                Apagar todos os dados
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Remove tudo: progresso, plano de estudos, configurações e itens
                salvos. Não dá para desfazer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setWipeText("");
                setAskWipe(true);
              }}
              className="inline-flex items-center gap-2 bg-destructive text-destructive-foreground px-4 min-h-11 rounded-md text-sm font-semibold hover:opacity-90 shrink-0"
            >
              <Trash2 size={16} /> Apagar tudo
            </button>
          </div>
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
        open={askReset}
        onCancel={() => setAskReset(false)}
        onConfirm={handleReset}
        title="Resetar progresso?"
        description="Esta ação apaga respostas, redações, simulados e streak. Não dá para desfazer."
        confirmLabel="Resetar progresso"
        destructive
      />

      <ConfirmDialog
        open={askWipe}
        onCancel={() => setAskWipe(false)}
        onConfirm={() => {
          if (wipeText.trim().toUpperCase() === "APAGAR") handleWipe();
        }}
        title="Apagar TODOS os dados?"
        description={
          <div className="space-y-3">
            <p>
              Isso remove progresso, plano de estudos, configurações, simulados,
              redações e tudo mais salvo neste navegador.
            </p>
            <p className="text-sm">
              Para confirmar, digite{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">
                APAGAR
              </code>{" "}
              abaixo:
            </p>
            <input
              autoFocus
              value={wipeText}
              onChange={(e) => setWipeText(e.target.value)}
              placeholder="APAGAR"
              className="w-full min-h-11 bg-background border border-border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
            />
          </div>
        }
        confirmLabel="Apagar tudo"
        destructive
        confirmDisabled={wipeText.trim().toUpperCase() !== "APAGAR"}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4">
      <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
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
        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1.5"
      >
        <Icon size={12} /> {label}
      </label>
      {children}
    </div>
  );
}
