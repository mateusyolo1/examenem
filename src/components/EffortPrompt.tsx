import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Smile, Meh, Frown, X } from "lucide-react";
import { toast } from "sonner";
import { logEffort } from "@/lib/telemetry.functions";

type Effort = "facil" | "medio" | "dificil";

interface EffortPromptProps {
  activityKind: "video" | "lousa" | "treino" | "simulado" | "flashcards";
  activityRef?: string;
  topicSlug?: string;
  topicArea?: string;
  score?: number; // 0..1
  durationMin?: number;
  onDone?: (outcome: string) => void;
  onDismiss?: () => void;
  inline?: boolean; // se true, renderiza como bloco (não modal)
}

const OPTIONS: Array<{ id: Effort; label: string; Icon: typeof Smile; color: string }> = [
  { id: "facil", label: "Muito Fácil", Icon: Smile, color: "text-emerald-500" },
  { id: "medio", label: "Na Medida", Icon: Meh, color: "text-amber-500" },
  { id: "dificil", label: "Muito Difícil", Icon: Frown, color: "text-rose-500" },
];

/**
 * Termômetro de esforço mostrado ao aluno após concluir qualquer
 * atividade. Alimenta o motor de dificuldade gradual.
 */
export function EffortPrompt({
  activityKind,
  activityRef,
  topicSlug,
  topicArea,
  score,
  durationMin,
  onDone,
  onDismiss,
  inline = false,
}: EffortPromptProps) {
  const logFn = useServerFn(logEffort);
  const [selected, setSelected] = useState<Effort | null>(null);

  const submit = useMutation({
    mutationFn: (effort: Effort) =>
      logFn({
        data: {
          activityKind,
          activityRef,
          topicSlug,
          topicArea,
          effort,
          score,
          durationMin,
        },
      }),
    onSuccess: (res) => {
      const map: Record<string, string> = {
        fast_track: "🚀 Fast track ativado! Próxima aula sobe 2 níveis.",
        level_up: "📈 Nível ↑ — próxima aula um degrau acima.",
        hold: "✅ Mantendo o ritmo.",
        level_down: "🧱 Recuo estratégico — próxima aula um degrau abaixo.",
        noop: "Feedback registrado.",
      };
      toast.success(map[res.outcome] ?? "Feedback registrado.");
      onDone?.(res.outcome);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const wrapCls = inline
    ? "rounded-lg border border-border bg-muted/30 p-4"
    : "rounded-xl border border-border bg-background p-4 shadow-lg";

  return (
    <div className={wrapCls}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Termômetro
          </div>
          <div className="text-sm font-semibold mt-0.5">
            Como foi o esforço para esta tarefa?
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Dispensar"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ id, label, Icon, color }) => {
          const active = selected === id;
          const isPending = submit.isPending && selected === id;
          return (
            <button
              key={id}
              type="button"
              disabled={submit.isPending}
              onClick={() => {
                setSelected(id);
                submit.mutate(id);
              }}
              className={
                "flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-all " +
                (active
                  ? "border-foreground bg-foreground/5"
                  : "border-border hover:border-foreground/40") +
                (submit.isPending ? " opacity-60 cursor-wait" : "")
              }
            >
              <Icon size={22} className={color} />
              <span className="text-[11px] font-semibold">{label}</span>
              {isPending && (
                <span className="text-[9px] font-mono text-muted-foreground">
                  enviando…
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
