import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import {
  NotebookPen,
  Sparkles,
  Trash2,
  Save,
  Download,
  Plus,
  Loader2,
  RotateCcw,
  ChevronRight,
  Square,
  Circle as CircleIcon,
  StickyNote,
  Type,
  Copy,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Frame,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
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

// ============ MIND MAPS ============

const STICKY_COLORS = [
  { name: "Amarelo", bg: "#fef3c7", border: "#f59e0b" },
  { name: "Rosa", bg: "#fce7f3", border: "#ec4899" },
  { name: "Verde", bg: "#d1fae5", border: "#10b981" },
  { name: "Azul", bg: "#dbeafe", border: "#3b82f6" },
  { name: "Roxo", bg: "#ede9fe", border: "#8b5cf6" },
  { name: "Cinza", bg: "#f3f4f6", border: "#6b7280" },
];

type StickyData = { label: string; bg: string; border: string };
type ShapeData = { label: string; shape: "rect" | "ellipse" };
type TextData = { label: string };

function StickyNode({ data, selected }: NodeProps) {
  const d = data as StickyData;
  return (
    <div
      style={{ background: d.bg, borderColor: d.border }}
      className={
        "min-w-[140px] max-w-[220px] px-3 py-2 border-2 rounded-sm shadow-sm text-[13px] leading-snug whitespace-pre-wrap break-words " +
        (selected ? "ring-2 ring-offset-1 ring-black/50" : "")
      }
    >
      <Handle type="target" position={Position.Top} className="!bg-black/40" />
      {d.label}
      <Handle type="source" position={Position.Bottom} className="!bg-black/40" />
    </div>
  );
}

function ShapeNode({ data, selected }: NodeProps) {
  const d = data as ShapeData;
  const isEllipse = d.shape === "ellipse";
  return (
    <div
      className={
        "min-w-[120px] min-h-[56px] px-3 py-2 border-2 border-foreground/60 bg-card text-foreground text-[13px] flex items-center justify-center text-center " +
        (isEllipse ? "rounded-full" : "rounded-md") +
        (selected ? " ring-2 ring-offset-1 ring-primary" : "")
      }
    >
      <Handle type="target" position={Position.Top} className="!bg-foreground/60" />
      {d.label}
      <Handle type="source" position={Position.Bottom} className="!bg-foreground/60" />
    </div>
  );
}

function TextNode({ data, selected }: NodeProps) {
  const d = data as TextData;
  return (
    <div
      className={
        "px-1 text-[15px] font-medium text-foreground whitespace-pre-wrap " +
        (selected ? "ring-2 ring-primary rounded-sm" : "")
      }
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      {d.label}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

const NODE_TYPES = { sticky: StickyNode, shape: ShapeNode, text: TextNode };

function MindMapsTab() {
  return (
    <ReactFlowProvider>
      <MindMapsInner />
    </ReactFlowProvider>
  );
}

function MindMapsInner() {
  const listFn = useServerFn(listMindMaps);
  const generateFn = useServerFn(generateMindMap);
  const saveFn = useServerFn(saveMindMap);
  const deleteFn = useServerFn(deleteMindMap);
  const qc = useQueryClient();
  const rf = useReactFlow();

  const { data: maps = [] } = useQuery({
    queryKey: ["mind-maps"],
    queryFn: () => listFn(),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [stickyColor, setStickyColor] = useState(STICKY_COLORS[0]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  // History (undo/redo)
  const historyRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const futureRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const skipHistoryRef = useRef(false);

  const snapshot = useCallback(() => {
    historyRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });
    if (historyRef.current.length > 50) historyRef.current.shift();
    futureRef.current = [];
  }, [nodes, edges]);

  function undo() {
    const prev = historyRef.current.pop();
    if (!prev) return;
    futureRef.current.push({ nodes, edges });
    skipHistoryRef.current = true;
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }
  function redo() {
    const next = futureRef.current.pop();
    if (!next) return;
    historyRef.current.push({ nodes, edges });
    skipHistoryRef.current = true;
    setNodes(next.nodes);
    setEdges(next.edges);
  }

  const selected = useMemo(() => maps.find((m) => m.id === selectedId), [maps, selectedId]);

  useEffect(() => {
    if (selected) {
      setTitle(selected.title);
      setNodes((selected.nodes as unknown as Node[]) ?? []);
      setEdges((selected.edges as unknown as Edge[]) ?? []);
      historyRef.current = [];
      futureRef.current = [];
    }
  }, [selected, setNodes, setEdges]);

  // Fullscreen listener
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault(); redo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        const selNodes = nodes.filter((n) => n.selected).map((n) => n.id);
        const selEdges = edges.filter((ed) => ed.selected).map((ed) => ed.id);
        if (selNodes.length || selEdges.length) {
          e.preventDefault();
          snapshot();
          setNodes((ns) => ns.filter((n) => !selNodes.includes(n.id)));
          setEdges((es) => es.filter((ed) => !selEdges.includes(ed.id) && !selNodes.includes(ed.source) && !selNodes.includes(ed.target)));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const genMutation = useMutation({
    mutationFn: (t: string) => generateFn({ data: { topic: t } }),
    onSuccess: (res) => {
      historyRef.current = [];
      futureRef.current = [];
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

  const onConnect = useCallback(
    (c: Connection) => {
      snapshot();
      setEdges((eds) => addEdge({ ...c, animated: false }, eds));
    },
    [setEdges, snapshot],
  );

  function centerPos() {
    try {
      const vp = rf.getViewport();
      const el = flowRef.current;
      const w = el?.clientWidth ?? 600;
      const h = el?.clientHeight ?? 400;
      return {
        x: (w / 2 - vp.x) / vp.zoom - 60,
        y: (h / 2 - vp.y) / vp.zoom - 20,
      };
    } catch {
      return { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };
    }
  }

  function addShape(shape: "rect" | "ellipse") {
    snapshot();
    const id = `n-${Date.now()}`;
    setNodes((ns) => [...ns, { id, type: "shape", data: { label: "Novo nó", shape }, position: centerPos() }]);
  }
  function addSticky() {
    snapshot();
    const id = `s-${Date.now()}`;
    setNodes((ns) => [
      ...ns,
      { id, type: "sticky", data: { label: "Nota", bg: stickyColor.bg, border: stickyColor.border }, position: centerPos() },
    ]);
  }
  function addText() {
    snapshot();
    const id = `t-${Date.now()}`;
    setNodes((ns) => [...ns, { id, type: "text", data: { label: "Texto" }, position: centerPos() }]);
  }
  function duplicateSelection() {
    const sel = nodes.filter((n) => n.selected);
    if (!sel.length) return;
    snapshot();
    const clones: Node[] = sel.map((n) => ({
      ...n,
      id: `${n.id}-${Date.now()}`,
      position: { x: n.position.x + 30, y: n.position.y + 30 },
      selected: false,
    }));
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), ...clones]);
  }
  function deleteSelection() {
    const selN = nodes.filter((n) => n.selected).map((n) => n.id);
    const selE = edges.filter((e) => e.selected).map((e) => e.id);
    if (!selN.length && !selE.length) return;
    snapshot();
    setNodes((ns) => ns.filter((n) => !selN.includes(n.id)));
    setEdges((es) => es.filter((e) => !selE.includes(e.id) && !selN.includes(e.source) && !selN.includes(e.target)));
  }
  function onNodeDoubleClick(_e: React.MouseEvent, node: Node) {
    const current = (node.data as { label?: string })?.label ?? "";
    const next = window.prompt("Editar texto do nó:", current);
    if (next === null) return;
    snapshot();
    setNodes((ns) => ns.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, label: next } } : n)));
  }

  function toggleFullscreen() {
    const el = canvasWrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  async function captureDataUrl() {
    const wrap = flowRef.current;
    if (!wrap) return null;
    try {
      rf.fitView({ padding: 0.15, duration: 0 });
    } catch {}
    await new Promise((r) => setTimeout(r, 60));
    return toPng(wrap, { backgroundColor: "#ffffff", pixelRatio: 2, cacheBust: true });
  }

  async function exportPng() {
    try {
      const dataUrl = await captureDataUrl();
      if (!dataUrl) return;
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${title || "mapa"}.png`;
      a.click();
    } catch {
      toast.error("Falha ao exportar PNG.");
    }
  }

  async function exportPdf() {
    try {
      const dataUrl = await captureDataUrl();
      if (!dataUrl) return;
      const img = new window.Image();
      img.src = dataUrl;
      await new Promise((r) => (img.onload = () => r(null)));
      const orientation = img.width >= img.height ? "l" : "p";
      const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const availW = pw - margin * 2;
      const availH = ph - margin * 2 - 30;
      const ratio = Math.min(availW / img.width, availH / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      pdf.setFontSize(14);
      pdf.text(title || "Mapa mental", margin, margin + 4);
      pdf.addImage(dataUrl, "PNG", margin + (availW - w) / 2, margin + 24, w, h);
      pdf.save(`${title || "mapa"}.pdf`);
      toast.success("PDF exportado.");
    } catch {
      toast.error("Falha ao exportar PDF.");
    }
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

  const ToolBtn = ({
    title: t, onClick, disabled, children,
  }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
    <button
      type="button"
      title={t}
      onClick={onClick}
      disabled={disabled}
      className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent text-foreground"
    >
      {children}
    </button>
  );

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

      <div
        ref={canvasWrapRef}
        className={
          "border border-border rounded-md bg-card overflow-hidden flex flex-col " +
          (isFullscreen ? "fixed inset-0 z-50 rounded-none" : "")
        }
      >
        {/* Title bar */}
        <div className="flex items-center gap-2 p-2 border-b border-border">
          <Input
            value={title}
            placeholder="Título do mapa"
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 text-sm max-w-xs"
          />
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={exportPng} className="gap-1"><ImageIcon size={13} />PNG</Button>
          <Button size="sm" variant="outline" onClick={exportPdf} className="gap-1"><FileText size={13} />PDF</Button>
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

        {/* Figma-like toolbar */}
        <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-muted/30">
          <ToolBtn title="Retângulo" onClick={() => addShape("rect")}><Square size={15} /></ToolBtn>
          <ToolBtn title="Elipse" onClick={() => addShape("ellipse")}><CircleIcon size={15} /></ToolBtn>
          <ToolBtn title="Nota adesiva" onClick={addSticky}><StickyNote size={15} /></ToolBtn>
          <ToolBtn title="Texto" onClick={addText}><Type size={15} /></ToolBtn>
          <div className="w-px h-5 bg-border mx-1" />
          {STICKY_COLORS.map((c) => (
            <button
              key={c.name}
              title={`Cor ${c.name}`}
              onClick={() => setStickyColor(c)}
              className={
                "h-5 w-5 rounded-sm border transition-transform " +
                (stickyColor.name === c.name ? "ring-2 ring-offset-1 ring-foreground scale-110" : "hover:scale-110")
              }
              style={{ background: c.bg, borderColor: c.border }}
            />
          ))}
          <div className="w-px h-5 bg-border mx-1" />
          <ToolBtn title="Duplicar (seleção)" onClick={duplicateSelection}><Copy size={15} /></ToolBtn>
          <ToolBtn title="Excluir (seleção)" onClick={deleteSelection}><Trash2 size={15} /></ToolBtn>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolBtn title="Desfazer (Ctrl+Z)" onClick={undo}><Undo2 size={15} /></ToolBtn>
          <ToolBtn title="Refazer (Ctrl+Shift+Z)" onClick={redo}><Redo2 size={15} /></ToolBtn>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolBtn title="Zoom −" onClick={() => rf.zoomOut({ duration: 200 })}><ZoomOut size={15} /></ToolBtn>
          <ToolBtn title="Enquadrar" onClick={() => rf.fitView({ padding: 0.2, duration: 200 })}><Frame size={15} /></ToolBtn>
          <ToolBtn title="Zoom +" onClick={() => rf.zoomIn({ duration: 200 })}><ZoomIn size={15} /></ToolBtn>
          <div className="flex-1" />
          <ToolBtn title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"} onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </ToolBtn>
        </div>

        <div ref={flowRef} className={"bg-background flex-1 " + (isFullscreen ? "" : "h-[520px]")}>
          {nodes.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Digite um tópico e gere um mapa, ou selecione um salvo. Use a barra acima para criar formas, notas e texto.
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              onNodesChange={(chs) => {
                if (!skipHistoryRef.current && chs.some((c) => c.type === "position" && c.dragging === false)) snapshot();
                skipHistoryRef.current = false;
                onNodesChange(chs);
              }}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDoubleClick={onNodeDoubleClick}
              deleteKeyCode={null}
              fitView
              panOnScroll
              selectionOnDrag
              multiSelectionKeyCode={["Shift", "Meta", "Control"]}
            >
              <Background gap={16} />
              <MiniMap pannable zoomable className="!bg-card" />
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
            <Frame size={40} className="mx-auto text-muted-foreground" />
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
