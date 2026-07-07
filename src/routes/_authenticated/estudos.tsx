import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import {
  listStudyTopics,
  listUserVideos,
  addUserVideo,
  deleteUserVideo,
  listVideosForTopic,
  suggestVideosForTopic,
  markVideoWatched,
  clearSuggestedVideos,
  listSuggestionHistory,
  clearSuggestionHistory,

} from "@/lib/study.functions";
import { Youtube, ChevronRight, ExternalLink, Search, Plus, Trash2, X, Sparkles, Check, GraduationCap, History, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useProgress } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/estudos")({
  head: () => ({
    meta: [
      { title: "Área de Estudos — Exame ENEM" },
      {
        name: "description",
        content:
          "Estude cada assunto do ENEM com buscas prontas no YouTube nos melhores canais educacionais brasileiros.",
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

// Canais educacionais brasileiros por área. Buscas ficam restritas ao canal
// via " channel:Nome" no YouTube search.
const CHANNELS: Record<string, { name: string; handle: string }[]> = {
  linguagens: [
    { name: "Débora Aladim", handle: "@DeboraAladim" },
    { name: "Curso Enem Gratuito", handle: "@cursoenemgratuito" },
    { name: "Descomplica", handle: "@descomplica" },
    { name: "Prof. Noslen", handle: "@ProfessorNoslen" },
  ],
  humanas: [
    { name: "Débora Aladim", handle: "@DeboraAladim" },
    { name: "Prof. Boaro (História)", handle: "@ProfMarceloBoaro" },
    { name: "Descomplica", handle: "@descomplica" },
    { name: "Curso Enem Gratuito", handle: "@cursoenemgratuito" },
  ],
  natureza: [
    { name: "Biologia Total (Jubilut)", handle: "@BiologiaTotal" },
    { name: "Prof. Boaro (Física)", handle: "@ProfMarceloBoaro" },
    { name: "Umberto Mannarino (Química)", handle: "@UmbertoMannarino" },
    { name: "Curso Enem Gratuito", handle: "@cursoenemgratuito" },
  ],
  matematica: [
    { name: "Prof. Ferretto", handle: "@ProfessorFerretto" },
    { name: "Matemática Rio (Rafael Procopio)", handle: "@matematicario" },
    { name: "Equaciona (Paulo Pereira)", handle: "@EquacionaMatematicaComPauloPereira" },
    { name: "Kuadro", handle: "@kuadroensino" },
  ],
};

function ytSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

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
              Escolha um assunto e abra buscas prontas no YouTube nos melhores canais educacionais
              brasileiros para o ENEM.
            </p>
          </header>

          <div className="grid lg:grid-cols-[320px_1fr] gap-6">
            {/* Sidebar */}
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
                        <span className="text-sm font-bold">
                          {AREA_LABEL[area.area] ?? area.title}
                        </span>
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
                <TopicSearches topic={selectedTopic} />
              ) : (
                <div className="border border-dashed border-border rounded-md p-12 text-center bg-card">
                  <Youtube size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-xl font-bold mb-2">Escolha um assunto</h2>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Abra uma área na barra lateral e clique num assunto para ver as buscas
                    recomendadas.
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

function TopicSearches({ topic }: { topic: Topic }) {
  const channels = CHANNELS[topic.area] ?? [];
  const baseQuery = `${topic.title}${topic.subject ? " " + topic.subject : ""} ENEM`;

  const listVideos = useServerFn(listUserVideos);
  const addVideo = useServerFn(addUserVideo);
  const removeVideo = useServerFn(deleteUserVideo);
  const qc = useQueryClient();

  const videosKey = ["user-study-videos", topic.id];
  const { data: videosData } = useQuery({
    queryKey: videosKey,
    queryFn: () => listVideos({ data: { topicId: topic.id } }),
  });
  const videos = videosData?.videos ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const addMutation = useMutation({
    mutationFn: (input: { url: string; title?: string }) =>
      addVideo({ data: { topicId: topic.id, url: input.url, title: input.title } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: videosKey });
      setUrl("");
      setTitle("");
      setDialogOpen(false);
      toast.success("Vídeo salvo na sua conta");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeVideo({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: videosKey });
      toast.success("Vídeo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <header className="mb-6">
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
      </header>

      {/* Meus vídeos (por usuário) */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Meus vídeos salvos
          </h3>
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-foreground text-background rounded hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            Adicionar vídeo
          </button>
        </div>

        {videos.length === 0 ? (
          <div className="border border-dashed border-border rounded-md p-6 text-center bg-card">
            <p className="text-sm text-muted-foreground">
              Você ainda não salvou vídeos deste assunto. Cole um link do YouTube e assista aqui
              mesmo.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {videos.map((v) => (
              <div
                key={v.id}
                className="border border-border bg-card rounded-md overflow-hidden group"
              >
                <div className="relative aspect-video bg-black">
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={`https://www.youtube.com/embed/${v.youtube_id}`}
                    title={v.title ?? "Vídeo do YouTube"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
                <div className="flex items-start justify-between gap-2 p-3">
                  <div className="text-sm font-medium line-clamp-2 flex-1">
                    {v.title ?? "Vídeo do YouTube"}
                  </div>
                  <button
                    onClick={() => {
                      if (confirm("Remover este vídeo?")) deleteMutation.mutate(v.id);
                    }}
                    className="text-muted-foreground hover:text-red-600 transition-colors shrink-0"
                    aria-label="Remover vídeo"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vídeos sugeridos (curados + IA) com player embutido */}
      <SuggestedVideos topic={topic} />

      {/* Busca geral em destaque */}
      <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
        Descubra no YouTube
      </h3>
      <a
        href={ytSearchUrl(baseQuery)}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-4 p-5 border border-border bg-card rounded-md hover:border-foreground transition-colors mb-6"
      >
        <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shrink-0">
          <Search size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
            Busca geral no YouTube
          </div>
          <div className="text-base font-semibold truncate">{baseQuery}</div>
        </div>
        <ExternalLink
          size={18}
          className="text-muted-foreground group-hover:text-foreground shrink-0"
        />
      </a>

      <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
        Nos melhores canais
      </h3>
      <div className="grid md:grid-cols-2 gap-3">
        {channels.map((c) => {
          const q = `${baseQuery} ${c.name}`;
          return (
            <a
              key={c.handle}
              href={ytSearchUrl(q)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 p-4 border border-border bg-card rounded-md hover:border-foreground transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-red-600/10 border border-red-600/30 flex items-center justify-center shrink-0">
                <Youtube size={18} className="text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  Buscar "{topic.title}"
                </div>
              </div>
              <ExternalLink
                size={16}
                className="text-muted-foreground group-hover:text-foreground shrink-0"
              />
            </a>
          );
        })}
      </div>

      <div className="mt-8 p-4 border border-dashed border-border rounded-md bg-card">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Dica:</strong> encontrou um vídeo bom na busca?
          Copie o link e clique em "Adicionar vídeo" acima para assistir direto no app.
        </p>
      </div>

      {/* Add video dialog (portaled to body to escape any transform/overflow ancestor) */}
      <AddVideoDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        topicTitle={topic.title}
        url={url}
        setUrl={setUrl}
        title={title}
        setTitle={setTitle}
        isPending={addMutation.isPending}
        onSubmit={() => {
          if (!url.trim()) return;
          addMutation.mutate({ url: url.trim(), title: title.trim() || undefined });
        }}
      />
    </div>
  );
}

function AddVideoDialog({
  open,
  onClose,
  topicTitle,
  url,
  setUrl,
  title,
  setTitle,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  topicTitle: string;
  url: string;
  setUrl: (v: string) => void;
  title: string;
  setTitle: (v: string) => void;
  isPending: boolean;
  onSubmit: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-card border border-border rounded-md w-full max-w-md p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">Adicionar vídeo</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Salvo só na sua conta, em <strong>{topicTitle}</strong>.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
              Link do YouTube
            </label>
            <input
              type="url"
              required
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3 py-2 border border-border bg-background rounded text-sm focus:outline-none focus:border-foreground"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
              Título (opcional)
            </label>
            <input
              type="text"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Aula de funções — Prof. Ferretto"
              className="w-full px-3 py-2 border border-border bg-background rounded text-sm focus:outline-none focus:border-foreground"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded border border-border hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || !url.trim()}
              className="px-4 py-2 text-sm font-semibold rounded bg-foreground text-background hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function SuggestedVideos({ topic }: { topic: Topic }) {
  const listSuggested = useServerFn(listVideosForTopic);
  const suggest = useServerFn(suggestVideosForTopic);
  const markWatched = useServerFn(markVideoWatched);
  const clearSuggested = useServerFn(clearSuggestedVideos);
  const qc = useQueryClient();

  const [historyOpen, setHistoryOpen] = useState(false);

  const key = ["suggested-videos", topic.id];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listSuggested({ data: { topicId: topic.id } }),
  });
  const videos = data?.videos ?? [];

  const { progress } = useProgress();
  const dailyMinutes = progress.dailyMinutes ?? 120;

  const suggestMutation = useMutation({
    mutationFn: (forceRefresh: boolean) =>
      suggest({
        data: { topicId: topic.id, maxMinutes: dailyMinutes, forceRefresh },
      }),
    onSuccess: (r, forceRefresh) => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["suggestion-history", topic.id] });
      if (r?.added > 0) {
        toast.success(
          forceRefresh
            ? `${r.added} novos vídeos · ${r.totalMinutes}min`
            : `${r.added} vídeos sugeridos · ${r.totalMinutes}min de ${r.maxMinutes}min disponíveis`,
        );
      } else {
        toast.info("Nenhuma sugestão nova desta vez");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const watchedMutation = useMutation({
    mutationFn: (v: { id: string; watched: boolean }) =>
      markWatched({ data: { videoId: v.id, watched: v.watched } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const clearMutation = useMutation({
    mutationFn: () => clearSuggested({ data: { topicId: topic.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Lista de sugestões limpa");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasVideos = videos.length > 0;
  const busy = suggestMutation.isPending;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Vídeos sugeridos
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {videos.length >= 3 && (
            <Link
              to="/aula/$topicId"
              params={{ topicId: topic.id }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
            >
              <GraduationCap size={14} />
              Iniciar aula
            </Link>
          )}
          {hasVideos && (
            <>
              <button
                onClick={() => suggestMutation.mutate(true)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-border rounded hover:bg-accent transition-colors disabled:opacity-50"
                title="Buscar vídeos diferentes"
              >
                <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
                {busy ? "Buscando…" : "Trocar sugestões"}
              </button>
              <button
                onClick={() => {
                  if (confirm("Limpar todos os vídeos sugeridos pela IA deste tópico?")) {
                    clearMutation.mutate();
                  }
                }}
                disabled={clearMutation.isPending}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-border rounded hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
                {clearMutation.isPending ? "Limpando…" : "Limpar lista"}
              </button>
            </>
          )}
          {!hasVideos && (
            <button
              onClick={() => suggestMutation.mutate(false)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-border rounded hover:bg-accent transition-colors disabled:opacity-50"
            >
              <Sparkles size={14} />
              {busy ? "Buscando…" : "Sugerir com IA"}
            </button>
          )}
        </div>

      </div>

      {/* Link discreto de histórico */}
      <div className="mb-3">
        <button
          onClick={() => setHistoryOpen(true)}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          <History size={11} />
          Histórico de sugestões
        </button>
      </div>

      {historyOpen && (
        <SuggestionHistoryModal
          topic={topic}
          onClose={() => setHistoryOpen(false)}
        />
      )}



      {isLoading ? (
        <div className="border border-dashed border-border rounded-md p-6 text-center bg-card">
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </div>
      ) : videos.length === 0 ? (
        <div className="border border-dashed border-border rounded-md p-6 text-center bg-card">
          <p className="text-sm text-muted-foreground">
            Ainda não há vídeos sugeridos para este assunto. Clique em{" "}
            <strong>Sugerir com IA</strong> para gerar recomendações.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {videos.map((v) => (
            <div
              key={v.id}
              className="border border-border bg-card rounded-md overflow-hidden"
            >
              <div className="relative aspect-video bg-black">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${v.youtube_id}`}
                  title={v.title ?? "Vídeo do YouTube"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium line-clamp-2">
                      {v.title ?? "Vídeo do YouTube"}
                    </div>
                    {v.channel_name && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {v.channel_name}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      watchedMutation.mutate({ id: v.id, watched: !v.watched })
                    }
                    className={
                      "shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors " +
                      (v.watched
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                        : "border-border text-muted-foreground hover:text-foreground")
                    }
                    aria-label={v.watched ? "Marcar como não assistido" : "Marcar como assistido"}
                  >
                    <Check size={12} />
                    {v.watched ? "Assistido" : "Marcar"}
                  </button>
                </div>
                <a
                  href={`https://www.youtube.com/watch?v=${v.youtube_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Abrir no YouTube ↗
                </a>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionHistoryModal({
  topic,
  onClose,
}: {
  topic: Topic;
  onClose: () => void;
}) {
  const listHistory = useServerFn(listSuggestionHistory);
  const clearHistoryFn = useServerFn(clearSuggestionHistory);
  const qc = useQueryClient();

  const historyKey = ["suggestion-history", topic.id];
  const { data, isLoading } = useQuery({
    queryKey: historyKey,
    queryFn: () => listHistory({ data: { topicId: topic.id } }),
  });
  const history = data?.history ?? [];

  const clearMutation = useMutation({
    mutationFn: () => clearHistoryFn({ data: { topicId: topic.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: historyKey });
      toast.success("Histórico de sugestões apagado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h4 className="text-sm font-semibold">Histórico de sugestões</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {topic.title} · {history.length} vídeo{history.length === 1 ? "" : "s"} já sugerido{history.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum vídeo foi sugerido para este tópico ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li
                  key={h.youtube_id}
                  className="flex items-start gap-3 p-2 rounded hover:bg-accent/50 transition-colors"
                >
                  <img
                    src={`https://img.youtube.com/vi/${h.youtube_id}/mqdefault.jpg`}
                    alt=""
                    className="w-24 aspect-video object-cover rounded shrink-0 bg-muted"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <a
                      href={`https://www.youtube.com/watch?v=${h.youtube_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline line-clamp-2"
                    >
                      {h.title ?? "Vídeo do YouTube"}
                    </a>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      {h.channel_name && <span className="truncate">{h.channel_name}</span>}
                      <span>·</span>
                      <span>
                        {new Date(h.suggested_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {history.length > 0 && (
          <div className="p-3 border-t border-border flex justify-between items-center gap-2">
            <p className="text-[11px] text-muted-foreground">
              Vídeos daqui não voltam a ser sugeridos.
            </p>
            <button
              onClick={() => {
                if (confirm("Apagar o histórico? Vídeos antigos poderão ser sugeridos novamente.")) {
                  clearMutation.mutate();
                }
              }}
              disabled={clearMutation.isPending}
              className="text-xs font-semibold px-3 py-1.5 border border-border rounded hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors disabled:opacity-50"
            >
              {clearMutation.isPending ? "Apagando…" : "Apagar histórico"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
