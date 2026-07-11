import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Play,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  getTodayAgendaTasks,
  markStudyTaskDone,
} from "@/lib/study-plan.functions";
import {
  INTENT_META,
  INTENT_ORDER,
  isIntent,
  summarizeJourney,
  type PedagogicalIntentKey,
} from "@/lib/pedagogical-intent";

const AREA_COLOR: Record<string, string> = {
  linguagens: "#8b5cf6",
  humanas: "#f97316",
  natureza: "#10b981",
  matematica: "#3b82f6",
  redacao: "#ec4899",
  geral: "#64748b",
};

export function TodayVideosList() {
  const getFn = useServerFn(getTodayAgendaTasks);
  const markFn = useServerFn(markStudyTaskDone);
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [showLegend, setShowLegend] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["today-agenda"],
    queryFn: () => getFn(),
    staleTime: 30_000,
  });

  const mark = useMutation({
    mutationFn: (taskId: string) => markFn({ data: { taskId, toggle: true } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["today-agenda"] });
      qc.invalidateQueries({ queryKey: ["cron-today"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-2">
        <Loader2 size={12} className="animate-spin" /> Carregando vídeos da Agenda…
      </div>
    );
  }

  const videos = (data?.videos ?? []) as Array<{
    id: string;
    title: string;
    area: string;
    minutes: number;
    status: string;
    topicSlug?: string;
    topicArea?: string;
    intents?: (string | null)[];
    dominantIntent?: string | null;
  }>;
  if (!videos.length) {
    return (
      <div className="mt-2 text-xs text-muted-foreground">
        A Agenda não indicou vídeos específicos para hoje. Use o catálogo geral.
      </div>
    );
  }

  const done = videos.filter((v) => v.status === "concluida").length;

  return (
    <div className="mt-3 border-t border-border pt-3 w-full">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 flex items-center justify-between text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>
            Jornada de hoje · {done}/{videos.length} concluídas
          </span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          type="button"
          onClick={() => setShowLegend((v) => !v)}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Legenda das etapas pedagógicas"
          title="O que significam essas etapas?"
        >
          <HelpCircle size={14} />
        </button>
      </div>
      {showLegend && <IntentLegend />}
      {expanded && (
        <ol className="mt-3 space-y-2">
          {videos.map((v, i) => {
            const isDone = v.status === "concluida";
            const color = AREA_COLOR[v.topicArea ?? v.area] ?? "#64748b";
            const summary = summarizeJourney(v.intents ?? []);
            return (
              <li
                key={v.id}
                className={
                  "flex items-center gap-3 rounded-lg border p-3 transition-all " +
                  (isDone
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-border bg-background hover:border-foreground/40")
                }
              >
                <span className="text-[10px] font-mono text-muted-foreground w-4 text-right shrink-0">
                  {i + 1}
                </span>
                <button
                  onClick={() => mark.mutate(v.id)}
                  disabled={mark.isPending}
                  aria-label={isDone ? "Desmarcar" : "Marcar como concluída"}
                  className={
                    "w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all " +
                    (isDone
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "border-border hover:border-foreground")
                  }
                >
                  {isDone && <Check size={14} strokeWidth={3} />}
                </button>
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: `${color}22`, color }}
                >
                  <BookOpen size={14} />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={
                        "text-sm font-semibold " + (isDone ? "line-through opacity-70" : "")
                      }
                    >
                      {v.title}
                    </span>
                    {isIntent(v.dominantIntent) && (
                      <DominantChip intent={v.dominantIntent} />
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 capitalize flex items-center gap-2 flex-wrap">
                    <span>
                      {v.topicArea ?? v.area} · {v.minutes} min
                    </span>
                    {summary.total > 0 && (
                      <span
                        className="text-[10px] font-mono normal-case tracking-wider text-muted-foreground/80"
                        title="Composição pedagógica da playlist"
                      >
                        · {summary.label}
                      </span>
                    )}
                  </div>
                </div>
                {v.topicSlug && !isDone && (
                  <Link
                    to="/aula/$topicId"
                    params={{ topicId: v.topicSlug }}
                    search={{ taskId: v.id }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-foreground text-background text-[11px] font-bold uppercase tracking-widest hover:bg-primary transition-all"
                  >
                    <Play size={12} /> Assistir
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function DominantChip({ intent }: { intent: PedagogicalIntentKey }) {
  const meta = INTENT_META[intent];
  return (
    <span
      className={
        "px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wider " +
        meta.cls
      }
      title={`Etapa dominante: ${meta.label} — ${meta.description}`}
    >
      {meta.label}
    </span>
  );
}

function IntentLegend() {
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        Etapas pedagógicas da IA
      </div>
      {INTENT_ORDER.map((k) => {
        const meta = INTENT_META[k];
        return (
          <div key={k} className="flex items-start gap-2 text-xs">
            <span
              className={
                "px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wider shrink-0 " +
                meta.cls
              }
            >
              {meta.label}
            </span>
            <span className="text-muted-foreground">{meta.description}</span>
          </div>
        );
      })}
    </div>
  );
}
