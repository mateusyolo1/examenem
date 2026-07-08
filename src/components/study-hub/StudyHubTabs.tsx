import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import {
  Brain,
  StickyNote,
  Layers,
  FileText,
  NotebookPen,
  Sparkles,
  Trash2,
  Save,
  Download,
  Plus,
  Loader2,
  RotateCcw,
  ChevronRight,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  generateMindMap,
  listMindMaps,
  saveMindMap,
  deleteMindMap,
  listAllVideoNotes,
  listDueFlashcards,
  generateFlashcards,
  recordFlashcardReview,
  deleteFlashcard,
  listSummaries,
  generateSummary,
  deleteSummary,
  listDrafts,
  saveDraft,
  deleteDraft,
} from "@/lib/study-hub.functions";

export { MindMapsTab, NotesTab, FlashcardsTab, SummariesTab, DraftsSection };
// no-op refs so bundlers keep the tabs UI imports meaningful
void Tabs; void TabsList; void TabsTrigger; void TabsContent;
void Brain; void StickyNote; void Layers; void FileText;

// ============ MIND MAPS ============

function MindMapsTab() {
  const listFn = useServerFn(listMindMaps);
  const generateFn = useServerFn(generateMindMap);
  const saveFn = useServerFn(saveMindMap);
  const deleteFn = useServerFn(deleteMindMap);
  const qc = useQueryClient();

  const { data: maps = [] } = useQuery({
    queryKey: ["mind-maps"],
    queryFn: () => listFn(),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const flowRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => maps.find((m) => m.id === selectedId), [maps, selectedId]);

  useEffect(() => {
    if (selected) {
      setTitle(selected.title);
      setNodes((selected.nodes as unknown as Node[]) ?? []);
      setEdges((selected.edges as unknown as Edge[]) ?? []);
    }
  }, [selected, setNodes, setEdges]);

  const genMutation = useMutation({
    mutationFn: (t: string) => generateFn({ data: { topic: t } }),
    onSuccess: (res) => {
      setTitle(res.title);
      setNodes(res.nodes as Node[]);
      setEdges(res.edges as Edge[]);
      setSelectedId(null);
      toast.success("Mapa gerado — edite e salve.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: selectedId ?? undefined,
          title: title || topic || "Mapa mental",
          nodes,
          edges,
        },
      }),
    onSuccess: (res) => {
      setSelectedId(res!.id);
      qc.invalidateQueries({ queryKey: ["mind-maps"] });
      toast.success("Mapa salvo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mind-maps"] });
      if (selectedId) setSelectedId(null);
      toast.success("Mapa removido.");
    },
  });

  const onConnect = useCallback((c: Connection) => setEdges((eds) => addEdge(c, eds)), [setEdges]);

  function addNode() {
    const id = `n-${Date.now()}`;
    setNodes((ns) => [
      ...ns,
      { id, data: { label: "Novo nó" }, position: { x: 40 + Math.random() * 200, y: 40 + Math.random() * 200 } },
    ]);
  }

  async function exportPng() {
    const el = flowRef.current?.querySelector(".react-flow__viewport") as HTMLElement | null;
    const wrap = flowRef.current;
    if (!wrap) return;
    try {
      const dataUrl = await toPng(wrap, { backgroundColor: "#ffffff", pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${title || "mapa"}.png`;
      a.click();
    } catch {
      toast.error("Falha ao exportar PNG.");
    }
    void el;
  }

  function exportMarkdown() {
    const rootNode = nodes.find((n) => n.id === "root") ?? nodes[0];
    const lines: string[] = [];
    if (rootNode) lines.push(`# ${(rootNode.data as { label: string }).label}`);
    const byParent: Record<string, Node[]> = {};
    for (const e of edges) {
      byParent[e.source] ??= [];
      const child = nodes.find((n) => n.id === e.target);
      if (child) byParent[e.source].push(child);
    }
    function walk(id: string, depth: number) {
      const kids = byParent[id] ?? [];
      for (const k of kids) {
        lines.push(`${"  ".repeat(depth)}- ${(k.data as { label: string }).label}`);
        walk(k.id, depth + 1);
      }
    }
    if (rootNode) walk(rootNode.id, 0);
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "mapa"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
      <aside className="border border-border rounded-md bg-card p-3 space-y-3">
        <div className="space-y-2">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Novo mapa</label>
          <Input
            placeholder="Tópico (ex: Revolução Francesa)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <Button
            size="sm"
            className="w-full gap-1.5"
            disabled={!topic || genMutation.isPending}
            onClick={() => genMutation.mutate(topic)}
          >
            {genMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Gerar com IA
          </Button>
        </div>
        <div className="border-t border-border pt-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Salvos</div>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {maps.length === 0 && <p className="text-xs text-muted-foreground">Nenhum ainda.</p>}
            {maps.map((m) => (
              <div key={m.id} className="flex items-center gap-1 group">
                <button
                  onClick={() => setSelectedId(m.id)}
                  className={
                    "flex-1 text-left text-xs px-2 py-1.5 rounded truncate " +
                    (selectedId === m.id ? "bg-foreground text-background" : "hover:bg-accent")
                  }
                >
                  {m.title}
                </button>
                <button
                  onClick={() => delMutation.mutate(m.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="border border-border rounded-md bg-card overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 p-2 border-b border-border">
          <Input
            value={title}
            placeholder="Título do mapa"
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 text-sm"
          />
          <Button size="sm" variant="outline" onClick={addNode} className="gap-1"><Plus size={13} />Nó</Button>
          <Button size="sm" variant="outline" onClick={exportPng} className="gap-1"><Download size={13} />PNG</Button>
          <Button size="sm" variant="outline" onClick={exportMarkdown} className="gap-1"><Download size={13} />MD</Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={nodes.length === 0 || saveMutation.isPending}
            className="gap-1"
          >
            {saveMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Salvar
          </Button>
        </div>
        <div ref={flowRef} className="h-[520px] bg-background">
          {nodes.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Digite um tópico e gere um mapa, ou selecione um salvo.
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
            >
              <Background />
              <Controls />
            </ReactFlow>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ NOTES ============

function NotesTab() {
  const listFn = useServerFn(listAllVideoNotes);
  const { data: notes = [] } = useQuery({
    queryKey: ["all-video-notes"],
    queryFn: () => listFn(),
  });

  if (notes.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-md p-10 text-center text-sm text-muted-foreground bg-card">
        Suas notas de vídeo aparecerão aqui. Assista aulas e crie notas no timeline dos vídeos.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {notes.map((n) => (
        <div key={n.id} className="border border-border rounded-md p-3 bg-card">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
            <span>{n.style}</span>
            <span>{new Date(n.created_at).toLocaleDateString("pt-BR")}</span>
          </div>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{n.ai_explanation}</p>
          {n.user_note && (
            <div className="mt-2 pt-2 border-t border-border text-xs text-foreground/90 whitespace-pre-wrap">
              <span className="font-mono uppercase text-[10px] text-muted-foreground">Eu: </span>
              {n.user_note}
            </div>
          )}
          <a
            href={`https://youtu.be/${n.youtube_id}?t=${n.timestamp_seconds}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <ChevronRight size={11} /> Abrir no YouTube
          </a>
        </div>
      ))}
    </div>
  );
}

// ============ FLASHCARDS ============

function FlashcardsTab() {
  const listFn = useServerFn(listDueFlashcards);
  const genFn = useServerFn(generateFlashcards);
  const reviewFn = useServerFn(recordFlashcardReview);
  const delFn = useServerFn(deleteFlashcard);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["flashcards-due"],
    queryFn: () => listFn(),
  });
  const due = data?.due ?? [];
  const all = data?.all ?? [];

  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(6);
  const [flipped, setFlipped] = useState(false);
  const [idx, setIdx] = useState(0);

  const genMutation = useMutation({
    mutationFn: () => genFn({ data: { topic, count } }),
    onSuccess: (res) => {
      toast.success(`${res.inserted} flashcards criados.`);
      setTopic("");
      qc.invalidateQueries({ queryKey: ["flashcards-due"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewMutation = useMutation({
    mutationFn: (v: { id: string; quality: number }) =>
      reviewFn({ data: { flashcardId: v.id, quality: v.quality } }),
    onSuccess: () => {
      setFlipped(false);
      setIdx((i) => i + 1);
      qc.invalidateQueries({ queryKey: ["flashcards-due"] });
    },
  });

  const current = due[idx];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      <aside className="border border-border rounded-md bg-card p-3 space-y-3">
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Gerar com IA</label>
          <Input
            placeholder="Tópico"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-1"
          />
          <div className="flex items-center gap-2 mt-2">
            <Input
              type="number"
              min={1}
              max={15}
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 6)}
              className="w-16 h-8"
            />
            <Button
              size="sm"
              className="flex-1 gap-1.5"
              disabled={!topic || genMutation.isPending}
              onClick={() => genMutation.mutate()}
            >
              {genMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Criar
            </Button>
          </div>
        </div>
        <div className="border-t border-border pt-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Todos ({all.length}) — {due.length} para hoje
          </div>
          <div className="space-y-1 max-h-[360px] overflow-y-auto">
            {all.map((c) => (
              <div key={c.id} className="flex items-start gap-1 group text-xs border border-border/50 rounded p-2">
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{c.front}</p>
                  <p className="truncate text-muted-foreground text-[11px]">{c.back}</p>
                </div>
                <button
                  onClick={() => delFn({ data: { id: c.id } }).then(() => qc.invalidateQueries({ queryKey: ["flashcards-due"] }))}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="border border-border rounded-md bg-card p-6 flex flex-col items-center justify-center min-h-[400px]">
        {!current ? (
          <div className="text-center space-y-3">
            <Layers size={40} className="mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {all.length === 0 ? "Nenhum flashcard ainda — crie um deck!" : "Você está em dia com as revisões."}
            </p>
            {idx > 0 && (
              <Button size="sm" variant="outline" onClick={() => setIdx(0)} className="gap-1">
                <RotateCcw size={13} /> Reiniciar
              </Button>
            )}
          </div>
        ) : (
          <div className="w-full max-w-xl space-y-4">
            <div className="text-xs text-muted-foreground text-center">
              Card {idx + 1} de {due.length}
            </div>
            <button
              onClick={() => setFlipped((f) => !f)}
              className="w-full min-h-[220px] border border-border rounded-md bg-background p-6 text-left hover:bg-accent/30 transition-colors"
            >
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
                {flipped ? "Resposta" : "Pergunta"}
              </div>
              <p className="text-lg leading-relaxed whitespace-pre-wrap">
                {flipped ? current.back : current.front}
              </p>
              {!flipped && (
                <p className="mt-4 text-xs text-muted-foreground">Toque para ver a resposta</p>
              )}
            </button>
            {flipped && (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {[
                  { q: 0, l: "Errei", v: "destructive" as const },
                  { q: 3, l: "Difícil", v: "outline" as const },
                  { q: 4, l: "Bom", v: "outline" as const },
                  { q: 5, l: "Fácil", v: "default" as const },
                ].map((b) => (
                  <Button
                    key={b.q}
                    size="sm"
                    variant={b.v}
                    onClick={() => reviewMutation.mutate({ id: current.id, quality: b.q })}
                    disabled={reviewMutation.isPending}
                  >
                    {b.l}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ SUMMARIES ============

function SummariesTab() {
  const listFn = useServerFn(listSummaries);
  const genFn = useServerFn(generateSummary);
  const delFn = useServerFn(deleteSummary);
  const qc = useQueryClient();

  const { data: summaries = [] } = useQuery({
    queryKey: ["study-summaries"],
    queryFn: () => listFn(),
  });

  const genMutation = useMutation({
    mutationFn: () => genFn({ data: { scope: "week" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study-summaries"] });
      toast.success("Resumo gerado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-bold">Resumos do que aprendi</h3>
        <Button
          size="sm"
          className="gap-1.5"
          disabled={genMutation.isPending}
          onClick={() => genMutation.mutate()}
        >
          {genMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Gerar resumo desta semana
        </Button>
      </div>
      {summaries.length === 0 ? (
        <div className="border border-dashed border-border rounded-md p-10 text-center text-sm text-muted-foreground bg-card">
          Nenhum resumo ainda. Assista aulas, crie notas e depois gere seu primeiro resumo semanal.
        </div>
      ) : (
        <div className="space-y-3">
          {summaries.map((s) => (
            <article key={s.id} className="border border-border rounded-md bg-card p-4">
              <header className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <h4 className="font-bold">{s.title}</h4>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {new Date(s.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <button
                  onClick={() =>
                    delFn({ data: { id: s.id } }).then(() =>
                      qc.invalidateQueries({ queryKey: ["study-summaries"] }),
                    )
                  }
                  className="p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={13} />
                </button>
              </header>
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">{s.content}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ DRAFTS ============

function DraftsSection() {
  const listFn = useServerFn(listDrafts);
  const saveFn = useServerFn(saveDraft);
  const delFn = useServerFn(deleteDraft);
  const qc = useQueryClient();

  const { data: drafts = [] } = useQuery({
    queryKey: ["study-drafts"],
    queryFn: () => listFn(),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");

  const selected = drafts.find((d) => d.id === selectedId);
  useEffect(() => {
    if (selected) {
      setTitle(selected.title);
      setContent(selected.content);
      setTags((selected.tags ?? []).join(", "));
    }
  }, [selected]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: selectedId ?? undefined,
          title: title || "Sem título",
          content,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (res) => {
      setSelectedId(res!.id);
      qc.invalidateQueries({ queryKey: ["study-drafts"] });
      toast.success("Rascunho salvo.");
    },
  });

  function newDraft() {
    setSelectedId(null);
    setTitle("");
    setContent("");
    setTags("");
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <NotebookPen size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-bold">Rascunhos e materiais</h3>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        <aside className="border border-border rounded-md bg-card p-3 space-y-2">
          <Button size="sm" onClick={newDraft} variant="outline" className="w-full gap-1">
            <Plus size={13} /> Novo
          </Button>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {drafts.length === 0 && <p className="text-xs text-muted-foreground px-1">Nenhum ainda.</p>}
            {drafts.map((d) => (
              <div key={d.id} className="flex items-center gap-1 group">
                <button
                  onClick={() => setSelectedId(d.id)}
                  className={
                    "flex-1 text-left text-xs px-2 py-1.5 rounded truncate " +
                    (selectedId === d.id ? "bg-foreground text-background" : "hover:bg-accent")
                  }
                >
                  {d.title}
                </button>
                <button
                  onClick={() =>
                    delFn({ data: { id: d.id } }).then(() => {
                      qc.invalidateQueries({ queryKey: ["study-drafts"] });
                      if (selectedId === d.id) newDraft();
                    })
                  }
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </aside>
        <div className="border border-border rounded-md bg-card p-3 space-y-2">
          <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            placeholder="Escreva aqui suas anotações, resumos, links..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[280px] font-sans text-sm"
          />
          <div className="flex items-center gap-2">
            <Input
              placeholder="Tags (separadas por vírgula)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="gap-1"
            >
              {saveMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Salvar
            </Button>
          </div>
          {selected && selected.tags && selected.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {selected.tags.map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
