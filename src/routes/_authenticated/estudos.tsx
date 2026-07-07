import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import {
  listStudyTopics,
  listVideosForTopic,
  markVideoWatched,
  suggestVideosForTopic,
} from "@/lib/study.functions";
import { toast } from "sonner";
import { CheckCircle2, Circle, Sparkles, Youtube, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/estudos")({
  head: () => ({
    meta: [
      { title: "Área de Estudos — Exame ENEM" },
      {
        name: "description",
        content:
          "Aprenda cada assunto do ENEM com vídeos selecionados dos melhores canais educacionais do YouTube, organizados por área.",
      },
    ],
  }),
  component: EstudosPage,
});

interface Topic {
  id: string;
  parent_id: string | null;
  slug: string;
  title: string;
  area: string;
  subject: string | null;
  description: string | null;
  sort_order: number;
}

const AREA_LABEL: Record<string, string> = {
  linguagens: "Linguagens",
  humanas: "Humanas",
  natureza: "Natureza",
  matematica: "Matemática",
};

const AREA_COLOR: Record<string, string> = {
  linguagens: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  humanas: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  natureza: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  matematica: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
};

function EstudosPage() {
  const listTopics = useServerFn(listStudyTopics);
  const { data: topicsData } = useQuery({
    queryKey: ["study-topics"],
    queryFn: () => listTopics(),
  });

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set(["linguagens"]));

  const { roots, byParent } = useMemo(() => {
    const topics = (topicsData?.topics ?? []) as Topic[];
    const rootsArr = topics.filter((t) => t.parent_id === null);
    const map: Record<string, Topic[]> = {};
    for (const t of topics) {
      if (t.parent_id) {
        map[t.parent_id] ??= [];
        map[t.parent_id].push(t);
      }
    }
    return { roots: rootsArr, byParent: map };
  }, [topicsData]);

  const selectedTopic = useMemo(() => {
    if (!selectedTopicId || !topicsData) return null;
    return (topicsData.topics as Topic[]).find((t) => t.id === selectedTopicId) ?? null;
  }, [selectedTopicId, topicsData]);

  function toggleArea(id: string) {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Nav />
      <main id="main" className="lg:ml-64">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 pb-24 lg:pb-8">
          <header className="mb-8 border-b border-border pb-6">
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Área de Estudos
            </span>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter mt-2">
              Aprenda por vídeo.
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl">
              Vídeos selecionados dos melhores canais do YouTube para cada assunto do ENEM.
              Marque como assistido conforme avança.
            </p>
          </header>

          <div className="grid lg:grid-cols-[320px_1fr] gap-6">
            {/* Sidebar: topic tree */}
            <aside className="border border-border bg-card p-4 rounded-md h-fit lg:sticky lg:top-6">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                Assuntos
              </h2>
              <div className="space-y-1">
                {roots.map((area) => {
                  const children = byParent[area.id] ?? [];
                  const expanded = expandedAreas.has(area.id);
                  return (
                    <div key={area.id}>
                      <button
                        onClick={() => toggleArea(area.id)}
                        className="w-full flex items-center justify-between text-left px-2 py-2 rounded hover:bg-accent transition-colors"
                      >
                        <span className="text-sm font-bold">{AREA_LABEL[area.area] ?? area.title}</span>
                        <ChevronRight
                          size={14}
                          className={`transition-transform ${expanded ? "rotate-90" : ""}`}
                        />
                      </button>
                      {expanded && (
                        <div className="pl-2 space-y-0.5 mt-1 mb-2">
                          {children.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => setSelectedTopicId(t.id)}
                              className={
                                "w-full text-left px-2 py-1.5 rounded text-sm transition-colors " +
                                (selectedTopicId === t.id
                                  ? "bg-foreground text-background font-medium"
                                  : "text-muted-foreground hover:bg-accent hover:text-foreground")
                              }
                            >
                              {t.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* Content */}
            <section>
              {selectedTopic ? (
                <TopicVideos topic={selectedTopic} />
              ) : (
                <div className="border border-dashed border-border rounded-md p-12 text-center bg-card">
                  <Youtube size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-xl font-bold mb-2">Escolha um assunto</h2>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Abra uma área na barra lateral e clique num assunto para ver os vídeos disponíveis.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

interface Video {
  id: string;
  youtube_id: string;
  title: string;
  channel_name: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  source: "curated" | "ai";
  sort_order: number;
  suggested_at: string | null;
  watched: boolean;
}

function TopicVideos({ topic }: { topic: Topic }) {
  const queryClient = useQueryClient();
  const listVideos = useServerFn(listVideosForTopic);
  const markWatched = useServerFn(markVideoWatched);
  const suggest = useServerFn(suggestVideosForTopic);

  const [playingId, setPlayingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["study-videos", topic.id],
    queryFn: () => listVideos({ data: { topicId: topic.id } }),
  });

  const watchMutation = useMutation({
    mutationFn: (vars: { videoId: string; watched: boolean }) =>
      markWatched({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-videos", topic.id] });
    },
  });

  const suggestMutation = useMutation({
    mutationFn: () => suggest({ data: { topicId: topic.id } }),
    onSuccess: (res) => {
      toast.success(
        res.added > 0
          ? `${res.added} vídeo(s) sugerido(s) pela IA!`
          : "A IA não encontrou vídeos novos confiáveis. Tente de novo mais tarde.",
      );
      queryClient.invalidateQueries({ queryKey: ["study-videos", topic.id] });
    },
    onError: (e) => {
      toast.error("Não foi possível sugerir vídeos", {
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  const videos = (data?.videos ?? []) as Video[];
  const watchedCount = videos.filter((v) => v.watched).length;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span
              className={
                "text-[10px] font-mono uppercase tracking-widest px-2 py-1 border rounded " +
                (AREA_COLOR[topic.area] ?? "")
              }
            >
              {AREA_LABEL[topic.area] ?? topic.area}
            </span>
            {topic.subject && (
              <span className="text-xs font-mono text-muted-foreground uppercase">
                {topic.subject}
              </span>
            )}
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tighter">{topic.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {watchedCount}/{videos.length} assistidos
          </p>
        </div>
        <button
          onClick={() => suggestMutation.mutate()}
          disabled={suggestMutation.isPending}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-widest border border-border rounded hover:bg-accent transition-colors disabled:opacity-50"
        >
          <Sparkles size={14} />
          {suggestMutation.isPending ? "Buscando…" : "Sugerir com IA"}
        </button>
      </header>

      {isLoading ? (
        <div className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
          Carregando…
        </div>
      ) : videos.length === 0 ? (
        <div className="border border-dashed border-border rounded-md p-8 text-center bg-card">
          <p className="text-sm text-muted-foreground mb-3">
            Nenhum vídeo cadastrado ainda para esse assunto.
          </p>
          <button
            onClick={() => suggestMutation.mutate()}
            disabled={suggestMutation.isPending}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-widest bg-foreground text-background rounded disabled:opacity-50"
          >
            <Sparkles size={14} />
            Sugerir com IA
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {videos.map((v) => (
            <article
              key={v.id}
              className="border border-border bg-card rounded-md overflow-hidden flex flex-col"
            >
              {playingId === v.id ? (
                <div className="aspect-video bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${v.youtube_id}?autoplay=1&rel=0`}
                    title={v.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <button
                  onClick={() => setPlayingId(v.id)}
                  className="aspect-video bg-black relative group"
                  aria-label={`Reproduzir ${v.title}`}
                >
                  <img
                    src={`https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`}
                    alt=""
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6 ml-1">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </button>
              )}
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold leading-snug">{v.title}</h3>
                  <span
                    className={
                      "shrink-0 text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 border rounded " +
                      (v.source === "ai"
                        ? "border-purple-500/40 text-purple-600 dark:text-purple-400"
                        : "border-border text-muted-foreground")
                    }
                  >
                    {v.source === "ai" ? "IA" : "Curado"}
                  </span>
                </div>
                {v.channel_name && (
                  <div className="text-xs text-muted-foreground mb-3">{v.channel_name}</div>
                )}
                <div className="mt-auto flex items-center gap-2">
                  <button
                    onClick={() =>
                      watchMutation.mutate({ videoId: v.id, watched: !v.watched })
                    }
                    disabled={watchMutation.isPending}
                    className={
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded border transition-colors " +
                      (v.watched
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-border text-muted-foreground hover:border-foreground")
                    }
                  >
                    {v.watched ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                    {v.watched ? "Assistido" : "Marcar assistido"}
                  </button>
                  <a
                    href={`https://www.youtube.com/watch?v=${v.youtube_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-[11px] font-mono uppercase text-muted-foreground hover:text-foreground"
                  >
                    YouTube →
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
