import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CircleDashed,
  PenLine,
  Sparkles,
  X,
} from "lucide-react";
import {
  getLessonEssayTask,
  submitLessonEssay,
  listLessonEssayAttempts,
} from "@/lib/study.functions";
import { z } from "zod";
import { markPlanTaskDone } from "@/lib/study-plan";

export const Route = createFileRoute("/_authenticated/aula/$topicId/pratica")({
  validateSearch: (search: Record<string, unknown>) =>
    z.object({ taskId: z.string().optional() }).parse(search),
  head: () => ({
    meta: [{ title: "Prática de escrita — Aula" }],
  }),
  component: PraticaPage,
});

function PraticaPage() {
  const { topicId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const getTask = useServerFn(getLessonEssayTask);
  const submit = useServerFn(submitLessonEssay);
  const listAttempts = useServerFn(listLessonEssayAttempts);

  const taskQuery = useQuery({
    queryKey: ["lesson-essay-task", topicId],
    queryFn: () => getTask({ data: { topicId } }),
  });

  const attemptsQuery = useQuery({
    queryKey: ["lesson-essay-attempts", topicId],
    queryFn: () => listAttempts({ data: { topicId } }),
  });

  const [essayText, setEssayText] = useState("");
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof submit>
  > | null>(null);

  const submitMutation = useMutation({
    mutationFn: (text: string) => submit({ data: { topicId, essayText: text } }),
    onSuccess: (r) => {
      setResult(r);
      attemptsQuery.refetch();
      // Auto-complete the linked redação task, if opened from /plano.
      if (taskId) markPlanTaskDone(taskId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const wordCount = useMemo(() => {
    const trimmed = essayText.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [essayText]);

  const task = taskQuery.data?.essayTask ?? null;
  const minW = task?.minWords ?? 60;
  const maxW = task?.maxWords ?? 180;
  const withinRange = wordCount >= minW && wordCount <= maxW;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            to="/aula/$topicId"
            params={{ topicId }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} /> Voltar à aula
          </Link>
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Prática de escrita
          </div>
          <span />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {taskQuery.isLoading && (
          <div className="border border-dashed border-border rounded-md p-8 text-center text-sm text-muted-foreground">
            Carregando tarefa…
          </div>
        )}

        {taskQuery.error && (
          <div className="border border-dashed border-red-500/40 rounded-md p-8 text-center text-sm text-red-600 dark:text-red-400">
            {(taskQuery.error as Error).message}
            <div className="mt-3">
              <Link
                to="/aula/$topicId"
                params={{ topicId }}
                className="text-xs font-semibold underline"
              >
                Voltar à aula
              </Link>
            </div>
          </div>
        )}

        {taskQuery.data && !task && (
          <div className="border border-dashed border-border rounded-md p-8 text-center text-sm text-muted-foreground">
            Esta aula não tem tarefa de escrita associada.
            <div className="mt-3">
              <Link
                to="/aula/$topicId"
                params={{ topicId }}
                className="text-xs font-semibold underline"
              >
                Voltar à aula
              </Link>
            </div>
          </div>
        )}

        {task && (
          <div className="space-y-6">
            {/* Enunciado */}
            <div className="border border-border bg-card rounded-md p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                  <PenLine size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Tarefa
                  </div>
                  <h1 className="text-xl font-extrabold tracking-tight mt-0.5">{task.title}</h1>
                  <p className="text-sm mt-2 leading-relaxed">{task.prompt}</p>
                  <div className="mt-4">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                      Você será avaliado apenas por:
                    </div>
                    <ul className="space-y-1">
                      {task.rubric.map((r, i) => (
                        <li key={i} className="text-xs flex items-start gap-2">
                          <span className="shrink-0 grid place-items-center w-4 h-4 rounded-full border border-border text-[9px] font-mono mt-0.5">
                            {i + 1}
                          </span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-3 italic">
                    A IA não olha acentuação, ortografia ou concordância — só a habilidade acima.
                  </p>
                </div>
              </div>
            </div>

            {/* Editor */}
            {!result && (
              <div className="border border-border bg-card rounded-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Seu texto
                  </label>
                  <span
                    className={
                      "text-xs font-mono " +
                      (withinRange
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground")
                    }
                  >
                    {wordCount} / {minW}–{maxW} palavras
                  </span>
                </div>
                <textarea
                  value={essayText}
                  onChange={(e) => setEssayText(e.target.value)}
                  disabled={submitMutation.isPending}
                  placeholder="Escreva aqui…"
                  rows={12}
                  className="w-full bg-background border border-border rounded p-3 text-sm leading-relaxed focus:outline-none focus:border-foreground disabled:opacity-60"
                />
                <div className="flex items-center justify-end gap-2 mt-3">
                  <button
                    onClick={() => setEssayText("")}
                    disabled={!essayText || submitMutation.isPending}
                    className="text-xs font-semibold px-3 py-2 border border-border rounded hover:bg-accent disabled:opacity-40"
                  >
                    Limpar
                  </button>
                  <button
                    onClick={() => submitMutation.mutate(essayText.trim())}
                    disabled={!withinRange || submitMutation.isPending}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-40"
                  >
                    <Sparkles size={13} />
                    {submitMutation.isPending ? "Corrigindo…" : "Enviar para correção"}
                  </button>
                </div>
              </div>
            )}

            {/* Feedback */}
            {result && <FeedbackView result={result} onRedo={() => setResult(null)} />}

            {/* Histórico */}
            {attemptsQuery.data && attemptsQuery.data.attempts.length > 0 && (
              <div className="border border-border bg-card rounded-md p-4">
                <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                  Tentativas anteriores
                </h3>
                <ul className="divide-y divide-border">
                  {attemptsQuery.data.attempts.map((a) => (
                    <li key={a.id} className="py-2 flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString("pt-BR")}
                      </span>
                      <span className="text-xs font-mono">
                        Nota{" "}
                        <strong className="text-foreground">
                          {a.score !== null && a.score !== undefined
                            ? Number(a.score).toFixed(1)
                            : "—"}
                        </strong>
                        /10
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function FeedbackView({
  result,
  onRedo,
}: {
  result: {
    task: {
      title: string;
      focusSkill: string;
    };
    feedback: {
      score: number;
      overall: string;
      criteria: {
        criterion: string;
        status: "atendido" | "parcial" | "nao_atendido";
        evidence: string;
        suggestion?: string;
      }[];
      tips: string[];
      rewriteExample?: { original: string; improved: string };
    };
  };
  onRedo: () => void;
}) {
  const { feedback } = result;
  return (
    <div className="space-y-4">
      <div className="border border-border bg-card rounded-md p-6 text-center">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Nota (só {result.task.focusSkill})
        </div>
        <div className="text-5xl font-bold mt-2">{feedback.score.toFixed(1)}</div>
        <div className="text-xs text-muted-foreground mt-1">/ 10.0</div>
        <p className="text-sm mt-3">{feedback.overall}</p>
      </div>

      <div className="border border-border bg-card rounded-md p-4">
        <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Rubrica
        </h3>
        <ul className="space-y-3">
          {feedback.criteria.map((c, i) => (
            <li key={i} className="flex items-start gap-3">
              <StatusIcon status={c.status} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{c.criterion}</div>
                {c.evidence && (
                  <div className="text-xs text-muted-foreground mt-1 italic">
                    "{c.evidence}"
                  </div>
                )}
                {c.suggestion && (
                  <div className="text-xs mt-1">
                    <strong>Sugestão:</strong> {c.suggestion}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {feedback.tips.length > 0 && (
        <div className="border border-border bg-card rounded-md p-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Dicas
          </h3>
          <ul className="space-y-1">
            {feedback.tips.map((t, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <Sparkles size={12} className="mt-1 shrink-0 text-primary" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback.rewriteExample && (
        <div className="border border-border bg-card rounded-md p-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Exemplo de reescrita
          </h3>
          <div className="text-xs text-muted-foreground mb-1">Você escreveu:</div>
          <div className="text-sm p-2 rounded bg-red-500/5 border border-red-500/20 mb-2">
            {feedback.rewriteExample.original}
          </div>
          <div className="text-xs text-muted-foreground mb-1">Ficaria melhor assim:</div>
          <div className="text-sm p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
            {feedback.rewriteExample.improved}
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={onRedo}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 border border-border rounded hover:bg-accent"
        >
          <PenLine size={13} /> Escrever nova versão
        </button>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: "atendido" | "parcial" | "nao_atendido" }) {
  if (status === "atendido") {
    return (
      <span className="shrink-0 grid place-items-center w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
        <Check size={14} />
      </span>
    );
  }
  if (status === "parcial") {
    return (
      <span className="shrink-0 grid place-items-center w-6 h-6 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
        <CircleDashed size={14} />
      </span>
    );
  }
  return (
    <span className="shrink-0 grid place-items-center w-6 h-6 rounded-full bg-red-500/15 text-red-700 dark:text-red-300">
      <X size={14} />
    </span>
  );
}
