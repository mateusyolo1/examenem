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
} from "@/lib/study.functions";


export const Route = createFileRoute("/_authenticated/aula/$topicId")({
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

  return <LessonPlayer topicId={topicId} topicTitle={data.topic.title} videos={data.videos} />;
}

interface Video {
  id: string;
  youtube_id: string;
  title: string | null;
  channel_name: string | null;
}

function LessonPlayer({
  topicId,
  topicTitle,
  videos,
}: {
  topicId: string;
  topicTitle: string;
  videos: Video[];
}) {
  const [phase, setPhase] = useState<Phase>("watching");
  const [current, setCurrent] = useState(0);
  const [watched, setWatched] = useState<Set<number>>(new Set());

  const buildQuiz = useServerFn(buildLessonQuiz);
  const submit = useServerFn(submitLessonAttempt);

  const quizMutation = useMutation({
    mutationFn: () => buildQuiz({ data: { topicId } }),
    onSuccess: (r) => {
      if (r.questions.length === 0) {
        toast.error("Não foi possível gerar questões (nenhum vídeo com legendas).");
        return;
      }
      setPhase("quiz");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitMutation = useMutation({
    mutationFn: (answers: { videoId: string; chosenIndex: number }[]) =>
      submit({ data: { topicId, answers } }),
    onSuccess: () => setPhase("result"),
    onError: (e: Error) => toast.error(e.message),
  });

  const total = videos.length;
  const video = videos[current];
  const allWatched = watched.size === total;

  const markCurrentWatched = () => {
    setWatched((prev) => new Set(prev).add(current));
  };

  const goNext = () => {
    markCurrentWatched();
    if (current < total - 1) setCurrent(current + 1);
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
            onSelect={setCurrent}
            onMarkWatched={markCurrentWatched}
            onNext={goNext}
            onPrev={() => current > 0 && setCurrent(current - 1)}
            allWatched={allWatched}
            onStartQuiz={() => quizMutation.mutate()}
            quizLoading={quizMutation.isPending}
            videos={videos}
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
          <ResultView result={submitMutation.data} topicId={topicId} />
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
  videos,
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
  videos: Video[];
}) {
  const isWatched = watched.has(current);
  const isLast = current === total - 1;
  const canGoNext = isWatched;
  const iframeRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !iframeRef.current) return;
      const player = new YT.Player(iframeRef.current, {
        videoId: video.youtube_id,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
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
            // 0 = ended
            if (e.data === 0) {
              onMarkWatched();
              toast.success("Vídeo concluído — marcado como assistido");
              if (poll) {
                clearInterval(poll);
                poll = null;
              }
            }
          },
        },
      });
      playerRef.current = player;
    });
    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
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
          <button
            onClick={onStartQuiz}
            disabled={!allWatched || quizLoading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <ClipboardList size={14} />
            {quizLoading ? "Preparando atividade…" : "Fazer atividade"}
          </button>
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
    videoId: string;
    youtubeId: string;
    videoTitle: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
  skipped: { youtubeId: string; title: string; reason: string }[];
}

function QuizView({
  payload,
  onSubmit,
  submitting,
}: {
  payload: QuizPayload;
  onSubmit: (a: { videoId: string; chosenIndex: number }[]) => void;
  submitting: boolean;
}) {
  const [choices, setChoices] = useState<Record<string, number>>({});

  const allAnswered = payload.questions.every((q) => choices[q.videoId] !== undefined);

  const submit = () => {
    const answers = payload.questions.map((q) => ({
      videoId: q.videoId,
      chosenIndex: choices[q.videoId],
    }));
    onSubmit(answers);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-primary" />
        <h2 className="text-lg font-semibold">Atividade baseada nas aulas</h2>
      </div>

      {payload.skipped.length > 0 && (
        <div className="border border-dashed border-border rounded-md p-3 text-xs text-muted-foreground bg-card">
          Não foi possível gerar questão para {payload.skipped.length} vídeo(s):{" "}
          {payload.skipped.map((s) => s.title).join(", ")} (sem legendas disponíveis).
        </div>
      )}

      <ol className="space-y-5">
        {payload.questions.map((q, i) => (
          <li key={q.videoId} className="border border-border bg-card rounded-md p-4">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Questão {i + 1} · sobre "{q.videoTitle}"
            </div>
            <p className="text-sm font-medium mb-3">{q.question}</p>
            <div className="space-y-1.5">
              {q.options.map((opt, idx) => {
                const selected = choices[q.videoId] === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setChoices({ ...choices, [q.videoId]: idx })}
                    className={
                      "w-full text-left px-3 py-2 rounded border text-sm transition-colors " +
                      (selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent")
                    }
                  >
                    <span className="font-mono text-xs text-muted-foreground mr-2">
                      {String.fromCharCode(65 + idx)})
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
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
}: {
  result: {
    score: number;
    total: number;
    graded: { videoId: string; chosenIndex: number; correct: boolean }[];
    quiz: QuizPayload;
  };
  topicId: string;
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
          const g = result.graded.find((x) => x.videoId === q.videoId);
          const correct = g?.correct ?? false;
          return (
            <li key={q.videoId} className="border border-border bg-card rounded-md p-4">
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
