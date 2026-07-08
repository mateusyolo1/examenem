import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Lock,
  PenLine,
  Play,
  Sparkles,
  X,
} from "lucide-react";

// YouTube IFrame API loader (singleton)
let ytApiPromise: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  const w = window as any;
  if (w.YT && w.YT.Player) return Promise.resolve(w.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(w.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}
import {
  getLessonPlaylist,
  buildLessonQuiz,
  submitLessonAttempt,
  saveVideoPosition,
  markVideoWatched,
  recordTopicMastery,
} from "@/lib/study.functions";
import { z } from "zod";
import { markPlanTaskDone } from "@/lib/study-plan";
import { saveLastEssayTask } from "@/lib/lesson-essay-cache";


export const Route = createFileRoute("/_authenticated/aula/$topicId")({
  validateSearch: (search: Record<string, unknown>) =>
    z.object({ taskId: z.string().optional() }).parse(search),
  component: LessonPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-lg font-semibold">Erro ao carregar a aula</h1>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <button
            onClick={() => {
              reset();
              router.invalidate();
            }}
            className="text-xs font-semibold px-3 py-1.5 border border-border rounded hover:bg-accent"
          >
            Tentar de novo
          </button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Tópico não encontrado.</p>
    </div>
  ),
});

type Phase = "watching" | "quiz" | "result";

function LessonPage() {
  const { topicId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const getPlaylist = useServerFn(getLessonPlaylist);

  const { data, isLoading } = useQuery({
    queryKey: ["lesson-playlist", topicId],
    queryFn: () => getPlaylist({ data: { topicId } }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando aula…</p>
      </div>
    );
  }

  if (!data || data.videos.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-lg font-semibold">Nenhum vídeo na playlist</h1>
          <p className="text-sm text-muted-foreground">
            Volte para o tópico e clique em "Sugerir com IA" para gerar a playlist.
          </p>
          <Link
            to="/estudos"
            className="inline-block text-xs font-semibold px-3 py-1.5 border border-border rounded hover:bg-accent"
          >
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <LessonPlayer
      topicId={topicId}
      topicSlug={data.topic.slug}
      topicTitle={data.topic.title}
      topicArea={data.topic.area}
      videos={data.videos}
      taskId={taskId}
    />
  );
}

interface Video {
  id: string;
  youtube_id: string;
  title: string | null;
  channel_name: string | null;
  watched?: boolean;
  watch_seconds?: number;
}

function LessonPlayer({
  topicId,
  topicSlug,
  topicTitle,
  topicArea,
  videos,
  taskId,
}: {
  topicId: string;
  topicSlug: string;
  topicTitle: string;
  topicArea: string;
  videos: Video[];
  taskId?: string;
}) {
  const [phase, setPhase] = useState<Phase>("watching");
  const [autoplay, setAutoplay] = useState(false);
  const [watched, setWatched] = useState<Set<number>>(
    () => new Set(videos.map((v, i) => (v.watched ? i : -1)).filter((i) => i >= 0)),
  );
  // Initial video = first unwatched with saved position, else first unwatched, else last.
  const [current, setCurrent] = useState(() => {
    const withProgress = videos.findIndex((v) => !v.watched && (v.watch_seconds ?? 0) > 0);
    if (withProgress >= 0) return withProgress;
    const firstUnwatched = videos.findIndex((v) => !v.watched);
    return firstUnwatched >= 0 ? firstUnwatched : videos.length - 1;
  });

  const buildQuiz = useServerFn(buildLessonQuiz);
  const submit = useServerFn(submitLessonAttempt);
  const savePos = useServerFn(saveVideoPosition);
  const markWatchedFn = useServerFn(markVideoWatched);
  const recordMastery = useServerFn(recordTopicMastery);


  // Pré-geração da atividade em background: assim que o aluno conclui
  // o 1º vídeo, começamos a montar o quiz (Gemini transcreve + gera perguntas
  // e cacheia no banco). Quando ele clicar em "Fazer atividade" no fim da
  // playlist, reaproveitamos a mesma promessa — instantâneo se já pronto.
  const prefetchRef = useRef<Promise<Awaited<ReturnType<typeof buildQuiz>>> | null>(null);
  const [prefetchReady, setPrefetchReady] = useState(false);
  const startPrefetch = () => {
    if (prefetchRef.current) return;
    prefetchRef.current = buildQuiz({ data: { topicId } })
      .then((r) => {
        setPrefetchReady(true);
        return r;
      })
      .catch((e) => {
        // libera para nova tentativa quando o aluno clicar em "Fazer atividade"
        prefetchRef.current = null;
        throw e;
      });
  };

  const quizMutation = useMutation({
    mutationFn: () => {
      startPrefetch();
      return prefetchRef.current!;
    },
    onSuccess: (r) => {
      if (r.questions.length === 0) {
        toast.error("Não foi possível gerar a atividade agora. Tente novamente em instantes.");
        return;
      }
      // Cache essayTask so /plano can propose "Escrever sobre esta aula"
      // for the next redação task in the cronograma.
      if (r.essayTask) {
        saveLastEssayTask({
          topicId,
          topicTitle,
          area: topicArea,
          essayTitle: r.essayTask.title,
          focusSkill: r.essayTask.focusSkill,
          savedAt: Date.now(),
        });
      }
      setPhase("quiz");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const submitMutation = useMutation({
    mutationFn: (answers: { questionId: string; chosenIndex: number }[]) =>
      submit({ data: { topicId, answers } }),
    onSuccess: (data) => {
      // Auto-complete the linked schedule task, if this aula was opened
      // from /plano.
      if (taskId) markPlanTaskDone(taskId);
      // Registra desempenho por tópico (Abordagem 3) — alimenta o cronograma
      // (skip de dominados, revisão espaçada, pesos por área).
      const total = Math.max(data.total, 1);
      const score = data.score / total;
      const area = topicArea as "linguagens" | "humanas" | "natureza" | "matematica";
      if (["linguagens", "humanas", "natureza", "matematica"].includes(area)) {
        recordMastery({ data: { topicSlug, area, score } }).catch(() => {});
      }
      setPhase("result");
    },
    onError: (e: Error) => toast.error(e.message),
  });



  const total = videos.length;
  const video = videos[current];
  const allWatched = watched.size === total;

  // Dispara o prefetch quando o aluno concluir o 1º vídeo (ou se já
  // entrou na aula com algum vídeo assistido de sessão anterior).
  useEffect(() => {
    if (watched.size >= 1) startPrefetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched.size >= 1]);


  const markCurrentWatched = () => {
    setWatched((prev) => {
      if (prev.has(current)) return prev;
      const next = new Set(prev).add(current);
      return next;
    });
    // Persist server-side (fire and forget).
    markWatchedFn({ data: { videoId: video.id, watched: true } }).catch(() => {});
  };

  const goNext = () => {
    markCurrentWatched();
    if (current < total - 1) {
      setAutoplay(true);
      setCurrent(current + 1);
    }
  };

  const goPrev = () => {
    if (current > 0) {
      setAutoplay(true);
      setCurrent(current - 1);
    }
  };

  const goSelect = (i: number) => {
    setAutoplay(true);
    setCurrent(i);
  };


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            to="/estudos"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} /> Sair da aula
          </Link>
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground truncate max-w-[50%]">
            {topicTitle}
          </div>
          <div className="text-xs font-mono text-muted-foreground">
            {phase === "watching"
              ? `Vídeo ${current + 1} de ${total}`
              : phase === "quiz"
                ? "Atividade"
                : "Resultado"}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {phase === "watching" && (
          <WatchingView
            video={video}
            current={current}
            total={total}
            watched={watched}
            onSelect={goSelect}
            onMarkWatched={markCurrentWatched}
            onNext={goNext}
            onPrev={goPrev}
            allWatched={allWatched}
            onStartQuiz={() => quizMutation.mutate()}
            quizLoading={quizMutation.isPending}
            quizPrefetching={!!prefetchRef.current && !prefetchReady}
            quizPrefetchReady={prefetchReady}
            videos={videos}
            autoplay={autoplay}
            onSaveProgress={(seconds) =>
              savePos({ data: { videoId: video.id, watchSeconds: Math.floor(seconds) } }).catch(
                () => {},
              )
            }
            resumeAt={video.watch_seconds ?? 0}
          />


        )}

        {phase === "quiz" && quizMutation.data && (
          <QuizView
            payload={quizMutation.data}
            onSubmit={(answers) => submitMutation.mutate(answers)}
            submitting={submitMutation.isPending}
          />
        )}

        {phase === "result" && submitMutation.data && (
          <ResultView result={submitMutation.data} topicId={topicId} taskId={taskId} />
        )}
      </main>
    </div>
  );
}

function WatchingView({
  video,
  current,
  total,
  watched,
  onSelect,
  onMarkWatched,
  onNext,
  onPrev,
  allWatched,
  onStartQuiz,
  quizLoading,
  quizPrefetching,
  quizPrefetchReady,
  videos,
  autoplay,
  onSaveProgress,
  resumeAt,
}: {
  video: Video;
  current: number;
  total: number;
  watched: Set<number>;
  onSelect: (i: number) => void;
  onMarkWatched: () => void;
  onNext: () => void;
  onPrev: () => void;
  allWatched: boolean;
  onStartQuiz: () => void;
  quizLoading: boolean;
  quizPrefetching: boolean;
  quizPrefetchReady: boolean;
  videos: Video[];
  autoplay: boolean;
  onSaveProgress: (seconds: number) => void;
  resumeAt: number;
}) {
  const isWatched = watched.has(current);
  const isLast = current === total - 1;
  const canGoNext = isWatched;
  const [countdown, setCountdown] = useState<number | null>(null);
  const iframeRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const onSaveProgressRef = useRef(onSaveProgress);
  onSaveProgressRef.current = onSaveProgress;
  const resumeAtRef = useRef(resumeAt);
  resumeAtRef.current = resumeAt;
  const isLastRef = useRef(isLast);
  isLastRef.current = isLast;
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  // Reset countdown whenever we switch videos.
  useEffect(() => {
    setCountdown(null);
  }, [video.youtube_id]);

  // Tick the auto-next countdown.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      onNextRef.current();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let saveTimer: ReturnType<typeof setInterval> | null = null;

    const flush = () => {
      try {
        const p = playerRef.current;
        if (!p || typeof p.getCurrentTime !== "function") return;
        const cur = p.getCurrentTime();
        if (cur > 1) onSaveProgressRef.current(cur);
      } catch {}
    };

    loadYouTubeApi().then((YT) => {
      if (cancelled || !iframeRef.current) return;
      const player = new YT.Player(iframeRef.current, {
        videoId: video.youtube_id,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          autoplay: autoplay ? 1 : 0,
          origin: window.location.origin,
          start: Math.max(0, Math.floor(resumeAtRef.current)),
        },
        events: {
          onReady: (e: any) => {
            try {
              if (resumeAtRef.current > 3) e.target.seekTo(resumeAtRef.current, true);
            } catch {}
            // Save current position periodically
            saveTimer = setInterval(flush, 5000);
            // End-of-video detection fallback
            poll = setInterval(() => {
              try {
                const p = playerRef.current;
                if (!p || typeof p.getDuration !== "function") return;
                const dur = p.getDuration();
                const cur = p.getCurrentTime();
                if (dur > 0 && cur > 0 && dur - cur <= 2) {
                  onMarkWatched();
                  if (poll) {
                    clearInterval(poll);
                    poll = null;
                  }
                }
              } catch {}
            }, 1000);
          },
          onStateChange: (e: any) => {
            // 0 = ended, 2 = paused
            if (e.data === 0) {
              onMarkWatched();
              toast.success("Vídeo concluído — próximo em 5s");
              if (poll) {
                clearInterval(poll);
                poll = null;
              }
              if (!isLastRef.current) setCountdown(5);
            }
            if (e.data === 2) flush();
          },
        },
      });
      playerRef.current = player;
    });

    const onBeforeUnload = () => flush();
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onBeforeUnload);

    return () => {
      cancelled = true;
      flush();
      if (poll) clearInterval(poll);
      if (saveTimer) clearInterval(saveTimer);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onBeforeUnload);
      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.youtube_id]);



  return (
    <div className="space-y-6">
      <div className="border border-border bg-card rounded-md overflow-hidden">
        <div className="relative aspect-video bg-black">
          <div ref={iframeRef} className="absolute inset-0 w-full h-full" />
          {countdown !== null && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="bg-card border border-border rounded-lg p-6 max-w-sm mx-4 text-center shadow-xl">
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                  Próximo vídeo em
                </div>
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="4" fill="none" className="text-muted opacity-30" />
                    <circle
                      cx="40" cy="40" r="34"
                      stroke="currentColor" strokeWidth="4" fill="none"
                      strokeDasharray={2 * Math.PI * 34}
                      strokeDashoffset={2 * Math.PI * 34 * (1 - countdown / 5)}
                      className="text-primary transition-all duration-1000 ease-linear"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
                    {countdown}
                  </div>
                </div>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => setCountdown(null)}
                    className="text-xs font-semibold px-3 py-2 border border-border rounded hover:bg-accent transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      setCountdown(null);
                      onNext();
                    }}
                    className="text-xs font-semibold px-3 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
                  >
                    Pular agora <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="text-sm font-medium">{video.title ?? "Vídeo do YouTube"}</div>
          {video.channel_name && (
            <div className="text-xs text-muted-foreground mt-0.5">{video.channel_name}</div>
          )}
          {!isWatched && (
            <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <Lock size={12} /> Assista até o final para liberar o próximo vídeo.
            </div>
          )}
          {isWatched && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1.5">
              <Check size={12} /> Assistido
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={onPrev}
          disabled={current === 0}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 border border-border rounded hover:bg-accent transition-colors disabled:opacity-40"
        >
          <ArrowLeft size={14} /> Anterior
        </button>

        {isLast ? (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={onStartQuiz}
              disabled={!allWatched || quizLoading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <ClipboardList size={14} />
              {quizLoading ? "Preparando atividade…" : "Fazer atividade"}
            </button>
            {allWatched && !quizLoading && (
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                {quizPrefetchReady ? (
                  <>
                    <Check size={10} className="text-emerald-600 dark:text-emerald-400" />
                    Atividade pronta
                  </>
                ) : quizPrefetching ? (
                  <>
                    <Sparkles size={10} className="animate-pulse" />
                    Preparando em segundo plano…
                  </>
                ) : null}
              </span>
            )}
          </div>
        ) : (

          <button
            onClick={onNext}
            disabled={!canGoNext}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {canGoNext ? (
              <>
                Próximo <ArrowRight size={14} />
              </>
            ) : (
              <>
                <Lock size={14} /> Assista até o final
              </>
            )}
          </button>
        )}
      </div>

      {!allWatched && isLast && (
        <p className="text-xs text-muted-foreground text-center">
          Assista todos os vídeos até o final para liberar a atividade.
        </p>
      )}

      <div>
        <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Playlist
        </h3>
        <ol className="space-y-1.5">
          {videos.map((v, i) => {
            const unlocked = i === 0 || watched.has(i - 1) || watched.has(i);
            return (
              <li key={v.id}>
                <button
                  onClick={() => unlocked && onSelect(i)}
                  disabled={!unlocked}
                  className={
                    "w-full text-left flex items-center gap-3 px-3 py-2 rounded border transition-colors " +
                    (i === current
                      ? "border-primary bg-primary/5"
                      : unlocked
                        ? "border-border hover:bg-accent"
                        : "border-border opacity-50 cursor-not-allowed")
                  }
                >
                  <span
                    className={
                      "shrink-0 w-6 h-6 rounded-full grid place-items-center text-[10px] font-mono " +
                      (watched.has(i)
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    {watched.has(i) ? (
                      <Check size={12} />
                    ) : unlocked ? (
                      i + 1
                    ) : (
                      <Lock size={10} />
                    )}
                  </span>
                  <span className="text-sm truncate">{v.title ?? `Vídeo ${i + 1}`}</span>
                  {i === current && <Play size={12} className="ml-auto shrink-0" />}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

interface QuizPayload {
  questions: {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    videoRef: {
      videoId: string;
      youtubeId: string;
      videoTitle: string;
      timestamp?: string;
    };
  }[];
  skipped: { youtubeId: string; title: string; reason: string }[];
  essayTask: {
    title: string;
    prompt: string;
    focusSkill: string;
    rubric: string[];
    minWords: number;
    maxWords: number;
  } | null;
}

function QuizView({
  payload,
  onSubmit,
  submitting,
}: {
  payload: QuizPayload;
  onSubmit: (a: { questionId: string; chosenIndex: number }[]) => void;
  submitting: boolean;
}) {
  const [choices, setChoices] = useState<Record<string, number>>({});

  const allAnswered = payload.questions.every((q) => choices[q.id] !== undefined);

  const submit = () => {
    const answers = payload.questions.map((q) => ({
      questionId: q.id,
      chosenIndex: choices[q.id],
    }));
    onSubmit(answers);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-primary">
          <Sparkles size={14} /> Atividade
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Atividade baseada nas aulas</h2>
        <p className="text-sm text-muted-foreground">
          {payload.questions.length} questões cobrindo o conteúdo dos vídeos que você acabou de assistir.
        </p>
      </div>

      {payload.skipped.length > 0 && (
        <div className="border border-dashed border-border rounded-md p-3 text-xs text-muted-foreground bg-card">
          Não foi possível analisar {payload.skipped.length} vídeo(s):{" "}
          {payload.skipped.map((s) => s.title).join(", ")}.
        </div>
      )}

      <ol className="space-y-8">
        {payload.questions.map((q, i) => {
          const answered = choices[q.id] !== undefined;
          return (
            <li
              key={q.id}
              className="border border-border bg-card rounded-lg p-6 sm:p-8 space-y-5 shadow-sm"
            >
              <header className="space-y-3 pb-4 border-b border-border">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    <span className="inline-grid place-items-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                      {i + 1}
                    </span>
                    Questão {i + 1} de {payload.questions.length}
                  </span>
                  {answered && (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                      <Check size={12} /> Respondida
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground/70 line-clamp-1">
                  Baseado em: {q.videoRef.videoTitle}
                  {q.videoRef.timestamp ? ` · aos ${q.videoRef.timestamp}` : ""}
                </p>
              </header>

              <p className="text-base leading-relaxed text-foreground">{q.question}</p>

              <div className="space-y-2.5 pt-1">
                {q.options.map((opt, idx) => {
                  const selected = choices[q.id] === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setChoices({ ...choices, [q.id]: idx })}
                      className={
                        "w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-md border transition-colors " +
                        (selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:bg-accent hover:border-border")
                      }
                    >
                      <span
                        className={
                          "shrink-0 mt-0.5 w-7 h-7 rounded-full grid place-items-center text-xs font-mono font-semibold border transition-colors " +
                          (selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-muted text-muted-foreground")
                        }
                      >
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-sm leading-relaxed pt-1">{opt}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>


      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={!allAnswered || submitting}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {submitting ? "Enviando…" : "Enviar respostas"}
        </button>
      </div>
    </div>
  );
}

function ResultView({
  result,
  topicId,
  taskId,
}: {
  result: {
    score: number;
    total: number;
    graded: { questionId: string; chosenIndex: number; correct: boolean }[];
    quiz: QuizPayload;
  };
  topicId: string;
  taskId?: string;
}) {
  const pct = Math.round((result.score / Math.max(result.total, 1)) * 100);
  return (
    <div className="space-y-6">
      <div className="border border-border bg-card rounded-md p-6 text-center">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Resultado
        </div>
        <div className="text-4xl font-bold mt-2">
          {result.score} / {result.total}
        </div>
        <div className="text-sm text-muted-foreground mt-1">{pct}% de acertos</div>
      </div>

      <ol className="space-y-4">
        {result.quiz.questions.map((q, i) => {
          const g = result.graded.find((x) => x.questionId === q.id);
          const correct = g?.correct ?? false;
          return (
            <li key={q.id} className="border border-border bg-card rounded-md p-4">
              <div className="flex items-start gap-2 mb-2">
                <span
                  className={
                    "shrink-0 w-6 h-6 rounded-full grid place-items-center " +
                    (correct
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                      : "bg-red-500/20 text-red-700 dark:text-red-300")
                  }
                >
                  {correct ? <Check size={14} /> : <X size={14} />}
                </span>
                <div className="flex-1">
                  <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Questão {i + 1}
                  </div>
                  <p className="text-sm font-medium">{q.question}</p>
                </div>
              </div>
              <div className="space-y-1 pl-8">
                {q.options.map((opt, idx) => {
                  const isCorrect = idx === q.correctIndex;
                  const isChosen = g?.chosenIndex === idx;
                  return (
                    <div
                      key={idx}
                      className={
                        "text-xs px-2 py-1 rounded " +
                        (isCorrect
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : isChosen
                            ? "bg-red-500/10 text-red-700 dark:text-red-300"
                            : "text-muted-foreground")
                      }
                    >
                      <span className="font-mono mr-2">{String.fromCharCode(65 + idx)})</span>
                      {opt}
                      {isCorrect && <span className="ml-2 font-semibold">(correta)</span>}
                      {isChosen && !isCorrect && <span className="ml-2">(sua resposta)</span>}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3 pl-8">
                <strong className="text-foreground">Explicação:</strong> {q.explanation}
              </p>
            </li>
          );
        })}
      </ol>

      {result.quiz.essayTask && (
        <div className="border border-border bg-card rounded-md p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary">
              <PenLine size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Praticar escrevendo
              </div>
              <h3 className="text-base font-extrabold tracking-tight mt-0.5">
                {result.quiz.essayTask.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Foco: {result.quiz.essayTask.focusSkill}. A correção olha SÓ essa habilidade — não
                acentuação, ortografia ou concordância geral.
              </p>
              <Link
                to="/aula/$topicId/pratica"
                params={{ topicId }}
                search={taskId ? { taskId } : {}}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
              >
                <PenLine size={13} /> Escrever agora
              </Link>
            </div>
          </div>
        </div>
      )}



      <div className="flex justify-center gap-2">
        <Link
          to="/estudos"
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 border border-border rounded hover:bg-accent"
        >
          Voltar aos estudos
        </Link>
        <Link
          to="/aula/$topicId"
          params={{ topicId }}
          reloadDocument
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          Refazer aula
        </Link>
      </div>
    </div>
  );
}
