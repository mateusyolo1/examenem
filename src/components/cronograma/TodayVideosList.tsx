import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Play, Check, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  getTodayAgendaTasks,
  markStudyTaskDone,
} from "@/lib/study-plan.functions";

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

  const videos = data?.videos ?? [];
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
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>
          Playlist de hoje · {done}/{videos.length} assistidos
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && (
        <ul className="mt-3 space-y-2">
          {videos.map((v) => {
            const isDone = v.status === "concluida";
            const color = AREA_COLOR[v.topicArea ?? v.area] ?? "#64748b";
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
                <button
                  onClick={() => mark.mutate(v.id)}
                  disabled={mark.isPending}
                  aria-label={isDone ? "Desmarcar" : "Marcar como assistido"}
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
                  <div className={"text-sm font-semibold " + (isDone ? "line-through opacity-70" : "")}>
                    {v.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                    {v.topicArea ?? v.area} · {v.minutes} min
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
        </ul>
      )}
    </div>
  );
}
