import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import {
  listStudyTopics,
  listUserVideos,
  addUserVideo,
  deleteUserVideo,
} from "@/lib/study.functions";
import { Youtube, ChevronRight, ExternalLink, Search, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

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

      {/* Add video dialog */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setDialogOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-md w-full max-w-md p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">Adicionar vídeo</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Salvo só na sua conta, em <strong>{topic.title}</strong>.
                </p>
              </div>
              <button
                onClick={() => setDialogOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!url.trim()) return;
                addMutation.mutate({ url: url.trim(), title: title.trim() || undefined });
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
                  onClick={() => setDialogOpen(false)}
                  className="px-4 py-2 text-sm rounded border border-border hover:bg-accent"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addMutation.isPending || !url.trim()}
                  className="px-4 py-2 text-sm font-semibold rounded bg-foreground text-background hover:opacity-90 disabled:opacity-50"
                >
                  {addMutation.isPending ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
