import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClientOnly } from "@tanstack/react-router";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import {
  NotebookPen,
  Sparkles,
  Trash2,
  Save,
  Plus,
  Loader2,
  RotateCcw,
  ChevronRight,
  Maximize2,
  Minimize2,
  FileText,
  Image as ImageIcon,
  Frame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
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

// ============ MIND MAPS (Excalidraw whiteboard) ============

// Excalidraw touches `window` at module top level and drags mermaid/canvg
// with it. If any of that lands in the SSR module graph, nitro's dep-splitter
// groups shared modules (react-dom, jsx-runtime, ...) under the excalidraw chunk
// and every unrelated lib ends up importing from it — the Worker then executes
// excalidraw at boot and dies with "window is not defined".
// The `import.meta.env.SSR` gate tree-shakes the entire import chain out of the
// server bundle so the vendor chunk is never created.
const ExcalidrawLazy = import.meta.env.SSR
  ? (null as unknown as ReturnType<typeof lazy>)
  : lazy(async () => {
      await import("@excalidraw/excalidraw/index.css");
      const mod = await import("@excalidraw/excalidraw");
      return { default: mod.Excalidraw };
    });

// Connector handles — draws 4 blue dots around the selected shape so the user
// can drag out a bound arrow from any side (draw.io / Miro style).
const BINDABLE = new Set(["rectangle", "diamond", "ellipse", "image", "text"]);
type SelInfo = { el: any; zoom: number; scrollX: number; scrollY: number; tick: number };
function ConnectorHandles({
  apiRef,
  containerRef,
}: {
  apiRef: React.MutableRefObject<any>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [sel, setSel] = useState<SelInfo | null>(null);
  const draggingRef = useRef(false);
  const convertRef = useRef<any>(null);

  useEffect(() => {
    let alive = true;
    import("@excalidraw/excalidraw").then((m) => {
      if (alive) convertRef.current = m.convertToExcalidrawElements;
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const api = apiRef.current;
      if (api && !draggingRef.current) {
        try {
          const st = api.getAppState();
          const els = api.getSceneElements();
          const ids = Object.keys(st.selectedElementIds || {}).filter(
            (id) => st.selectedElementIds[id],
          );
          if (ids.length === 1) {
            const el = els.find((e: any) => e.id === ids[0]);
            if (el && !el.isDeleted && BINDABLE.has(el.type)) {
              setSel({
                el,
                zoom: st.zoom?.value ?? 1,
                scrollX: st.scrollX ?? 0,
                scrollY: st.scrollY ?? 0,
                tick: Date.now(),
              });
            } else {
              setSel(null);
            }
          } else {
            setSel(null);
          }
        } catch {
          /* noop */
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [apiRef]);

  if (!sel || !containerRef.current) return null;
  const { el, zoom, scrollX, scrollY } = sel;
  const toPx = (sx: number, sy: number) => ({
    x: (sx + scrollX) * zoom,
    y: (sy + scrollY) * zoom,
  });
  const anchors = [
    { key: "t", sx: el.x + el.width / 2, sy: el.y },
    { key: "r", sx: el.x + el.width, sy: el.y + el.height / 2 },
    { key: "b", sx: el.x + el.width / 2, sy: el.y + el.height },
    { key: "l", sx: el.x, sy: el.y + el.height / 2 },
  ];

  const dirVec = (key: string) =>
    key === "t" ? { dx: 0, dy: -1 } :
    key === "r" ? { dx: 1, dy: 0 } :
    key === "b" ? { dx: 0, dy: 1 } :
                  { dx: -1, dy: 0 };

  const fpFor = (key: string): [number, number] =>
    key === "t" ? [0.5, 0] :
    key === "r" ? [1, 0.5] :
    key === "b" ? [0.5, 1] :
                  [0, 0.5];

  const oppositeFp = (key: string): [number, number] =>
    key === "t" ? [0.5, 1] :
    key === "r" ? [0, 0.5] :
    key === "b" ? [0.5, 0] :
                  [1, 0.5];

  // Click behavior: duplicate the shape in the direction of the handle and
  // connect it with an elbow arrow (like Excalidraw's Ctrl+Arrow shortcut).
  const cloneInDirection = (a: (typeof anchors)[number]) => {
    const api = apiRef.current;
    const convert = convertRef.current;
    if (!api || !convert) return;
    const { dx, dy } = dirVec(a.key);
    const gap = 80;
    const nx = el.x + dx * (el.width + gap);
    const ny = el.y + dy * (el.height + gap);
    const built = convert([
      {
        type: el.type,
        x: nx,
        y: ny,
        width: el.width,
        height: el.height,
        strokeColor: el.strokeColor,
        backgroundColor: el.backgroundColor,
        fillStyle: el.fillStyle,
        strokeWidth: el.strokeWidth,
        strokeStyle: el.strokeStyle,
        roughness: el.roughness,
        roundness: el.roundness,
      } as any,
      {
        type: "arrow",
        x: a.sx,
        y: a.sy,
        points: [
          [0, 0],
          [dx * gap, dy * gap],
        ],
        strokeColor: el.strokeColor,
        strokeWidth: el.strokeWidth ?? 2,
        endArrowhead: "arrow",
        elbowed: true,
        roundness: null,
      } as any,
    ]);
    const newShape = built[0];
    const arrow: any = {
      ...built[1],
      elbowed: true,
      roundness: null,
      startBinding: { elementId: el.id, focus: 0, gap: 1, fixedPoint: fpFor(a.key) },
      endBinding: { elementId: newShape.id, focus: 0, gap: 1, fixedPoint: oppositeFp(a.key) },
    };
    const current = api.getSceneElements();
    api.updateScene({
      elements: [...current, newShape, arrow],
      appState: { selectedElementIds: { [newShape.id]: true } },
    });
  };

  const startDrag = (e: React.PointerEvent, a: (typeof anchors)[number]) => {
    e.preventDefault();
    e.stopPropagation();
    const api = apiRef.current;
    const convert = convertRef.current;
    const cont = containerRef.current;
    if (!api || !convert || !cont) return;
    const rect = cont.getBoundingClientRect();
    const downX = e.clientX;
    const downY = e.clientY;
    const CLICK_THRESHOLD = 4;
    let movedPastThreshold = false;
    let arrowCreated = false;
    let arrow: any = null;
    const start = { x: a.sx, y: a.sy };
    const fpStart = fpFor(a.key);

    const createArrow = (ev: PointerEvent) => {
      const st = api.getAppState();
      const z = st.zoom?.value ?? 1;
      const sX = st.scrollX ?? 0;
      const sY = st.scrollY ?? 0;
      const end0 = {
        x: (ev.clientX - rect.left) / z - sX,
        y: (ev.clientY - rect.top) / z - sY,
      };
      const built = convert([
        {
          type: "arrow",
          x: start.x,
          y: start.y,
          points: [
            [0, 0],
            [end0.x - start.x, end0.y - start.y],
          ],
          strokeColor: st.currentItemStrokeColor ?? "#1e1e1e",
          strokeWidth: st.currentItemStrokeWidth ?? 2,
          endArrowhead: "arrow",
          elbowed: true,
          roundness: null,
        } as any,
      ]);
      arrow = {
        ...built[0],
        elbowed: true,
        roundness: null,
        startBinding: { elementId: el.id, focus: 0, gap: 1, fixedPoint: fpStart },
        endBinding: null,
      };
      const current = api.getSceneElements();
      api.updateScene({ elements: [...current, arrow] });
      arrowCreated = true;
      draggingRef.current = true;
    };

    const onMove = (ev: PointerEvent) => {
      if (!movedPastThreshold) {
        const dx = ev.clientX - downX;
        const dy = ev.clientY - downY;
        if (Math.hypot(dx, dy) < CLICK_THRESHOLD) return;
        movedPastThreshold = true;
        createArrow(ev);
        return;
      }
      const api2 = apiRef.current;
      if (!api2 || !arrow) return;
      const st2 = api2.getAppState();
      const z2 = st2.zoom?.value ?? 1;
      const scn = {
        x: (ev.clientX - rect.left) / z2 - (st2.scrollX ?? 0),
        y: (ev.clientY - rect.top) / z2 - (st2.scrollY ?? 0),
      };
      const arr = api2.getSceneElements();
      const next = arr.map((n: any) =>
        n.id === arrow.id
          ? {
              ...n,
              points: [
                [0, 0],
                [scn.x - start.x, scn.y - start.y],
              ],
              version: (n.version ?? 1) + 1,
              versionNonce: Math.floor(Math.random() * 2 ** 31),
            }
          : n,
      );
      api2.updateScene({ elements: next });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      draggingRef.current = false;
      if (!arrowCreated) {
        // Treat as click → duplicate shape in the handle's direction
        cloneInDirection(a);
        return;
      }
      const api2 = apiRef.current;
      if (!api2 || !arrow) return;
      const st2 = api2.getAppState();
      const z2 = st2.zoom?.value ?? 1;
      const scn = {
        x: (ev.clientX - rect.left) / z2 - (st2.scrollX ?? 0),
        y: (ev.clientY - rect.top) / z2 - (st2.scrollY ?? 0),
      };
      const arr = api2.getSceneElements();
      const target = [...arr]
        .reverse()
        .find(
          (n: any) =>
            !n.isDeleted &&
            n.id !== el.id &&
            n.id !== arrow.id &&
            BINDABLE.has(n.type) &&
            scn.x >= n.x &&
            scn.x <= n.x + n.width &&
            scn.y >= n.y &&
            scn.y <= n.y + n.height,
        );
      if (!target) return;
      const relX = (scn.x - target.x) / target.width;
      const relY = (scn.y - target.y) / target.height;
      const dLeft = relX, dRight = 1 - relX, dTop = relY, dBottom = 1 - relY;
      const minD = Math.min(dLeft, dRight, dTop, dBottom);
      const fpEnd: [number, number] =
        minD === dTop    ? [0.5, 0] :
        minD === dBottom ? [0.5, 1] :
        minD === dLeft   ? [0, 0.5] :
                           [1, 0.5];
      const next = arr.map((n: any) =>
        n.id === arrow.id
          ? {
              ...n,
              endBinding: { elementId: target.id, focus: 0, gap: 1, fixedPoint: fpEnd },
              version: (n.version ?? 1) + 1,
              versionNonce: Math.floor(Math.random() * 2 ** 31),
            }
          : n,
      );
      api2.updateScene({ elements: next });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {anchors.map((a) => {
        const p = toPx(a.sx, a.sy);
        return (
          <div
            key={a.key}
            onPointerDown={(e) => startDrag(e, a)}
            title="Clique para duplicar nessa direção ou arraste para conectar"
            className="pointer-events-auto absolute rounded-full bg-blue-500 border-2 border-white shadow-md cursor-crosshair hover:scale-125 transition-transform"
            style={{
              left: p.x - 6,
              top: p.y - 6,
              width: 12,
              height: 12,
            }}
          />
        );
      })}
    </div>
  );
}

type SavedMap = {
  id: string;
  title: string;
  nodes: unknown[]; // Excalidraw elements
  edges: unknown[]; // repurposed: [{ appState, files }]
};

function MindMapsTab() {
  const listFn = useServerFn(listMindMaps);
  const saveFn = useServerFn(saveMindMap);
  const deleteFn = useServerFn(deleteMindMap);
  const qc = useQueryClient();

  const { data: maps = [] } = useQuery({
    queryKey: ["mind-maps"],
    queryFn: () => listFn(),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("Novo mapa");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [saving, setSaving] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  // Bump this to force Excalidraw to reload with new initialData
  const [loadKey, setLoadKey] = useState(0);
  const initialDataRef = useRef<any>(null);
  const [bgStyle, setBgStyle] = useState<"dots" | "grid" | "none">(() => {
    if (typeof window === "undefined") return "dots";
    return (localStorage.getItem("mindmap-bg") as any) || "dots";
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("mindmap-bg", bgStyle);
    const api = apiRef.current;
    if (api?.updateScene) {
      api.updateScene({
        appState: {
          gridModeEnabled: bgStyle === "grid",
          gridSize: 20, objectsSnapModeEnabled: true,
          viewBackgroundColor: bgStyle === "dots" ? "transparent" : "#ffffff",
        },
      });
    }
  }, [bgStyle]);

  // Native fullscreen listener (falls back to CSS-only fullscreen when unavailable)
  useEffect(() => {
    const onFs = () => {
      if (document.fullscreenElement) setIsFullscreen(true);
      else if (!wrapRef.current?.dataset.cssFs) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Plain mouse-wheel zoom (Excalidraw requires Ctrl+wheel by default).
  // IMPORTANT: never remap while the user is drawing/dragging — a synthetic
  // Ctrl+wheel mid-drag causes Excalidraw to zoom, which breaks arrow binding
  // and shape resize. Also skip while linear/arrow tool is active, so users
  // can freely connect shapes without accidental zooms.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement;
      if (!target.closest(".excalidraw")) return;
      const st = apiRef.current?.getAppState?.();
      if (st) {
        const busy =
          st.draggingElement ||
          st.newElement ||
          st.resizingElement ||
          st.editingLinearElement ||
          st.multiElement ||
          st.selectedLinearElement?.isEditing;
        const tool = st.activeTool?.type;
        if (busy || tool === "arrow" || tool === "line" || tool === "freedraw") return;
      }
      e.preventDefault();
      e.stopPropagation();
      target.dispatchEvent(new WheelEvent("wheel", {
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaMode: e.deltaMode,
        clientX: e.clientX,
        clientY: e.clientY,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
    };
    el.addEventListener("wheel", handler, { passive: false, capture: true });
    return () => el.removeEventListener("wheel", handler, { capture: true } as any);
  }, []);

  // Nudge Excalidraw to re-measure on fullscreen toggle
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
    return () => clearTimeout(t);
  }, [isFullscreen]);

  // Load selected map into Excalidraw
  useEffect(() => {
    const m = maps.find((x) => x.id === selectedId) as SavedMap | undefined;
    if (!m) return;
    const meta = Array.isArray(m.edges) && m.edges[0] ? (m.edges[0] as any) : {};
    initialDataRef.current = {
      elements: (m.nodes as any) ?? [],
      appState: {
        viewBackgroundColor: bgStyle === "dots" ? "transparent" : (meta.viewBackgroundColor ?? "#ffffff"),
        gridModeEnabled: bgStyle === "grid",
        gridSize: 20, objectsSnapModeEnabled: true,
      },
      files: meta.files ?? {},
      scrollToContent: true,
    };
    setTitle(m.title);
    setLoadKey((k) => k + 1);
  }, [selectedId, maps]);

  function newMap() {
    setSelectedId(null);
    setTitle("Novo mapa");
    initialDataRef.current = {
      elements: [],
      appState: { viewBackgroundColor: bgStyle === "dots" ? "transparent" : "#ffffff", gridModeEnabled: bgStyle === "grid", gridSize: 20, objectsSnapModeEnabled: true },
      files: {},
    };
    setLoadKey((k) => k + 1);
  }

  async function handleSave() {
    if (!apiRef.current) return;
    setSaving(true);
    try {
      const elements = apiRef.current.getSceneElements();
      const appState = apiRef.current.getAppState();
      const files = apiRef.current.getFiles?.() ?? {};
      const res = await saveFn({
        data: {
          id: selectedId ?? undefined,
          title: title || "Mapa mental",
          nodes: elements as unknown[],
          edges: [
            {
              viewBackgroundColor: appState.viewBackgroundColor ?? "#ffffff",
              files,
            },
          ],
        },
      });
      if (res?.id) setSelectedId(res.id);
      qc.invalidateQueries({ queryKey: ["mind-maps"] });
      toast.success("Mapa salvo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const delMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["mind-maps"] });
      if (selectedId === id) newMap();
      toast.success("Mapa removido.");
    },
  });

  async function exportBlob(mime: "image/png" | "image/svg+xml") {
    if (!apiRef.current) return null;
    const elements = apiRef.current.getSceneElements();
    if (!elements.length) {
      toast.error("Canvas vazio — desenhe algo primeiro.");
      return null;
    }
    const appState = apiRef.current.getAppState();
    const files = apiRef.current.getFiles?.() ?? {};
    if (import.meta.env.SSR) return null;
    const { exportToBlob } = await import("@excalidraw/excalidraw");
    return exportToBlob({
      elements,
      appState: { ...appState, exportBackground: true, viewBackgroundColor: appState.viewBackgroundColor ?? "#ffffff" },
      files,
      mimeType: mime,
      quality: 0.95,
    });
  }

  async function exportPng() {
    try {
      const blob = await exportBlob("image/png");
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "mapa"}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Falha ao exportar PNG.");
    }
  }

  async function exportPdf() {
    try {
      const blob = await exportBlob("image/png");
      if (!blob) return;
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
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

  function toggleFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    // If we're in CSS-only fullscreen, just toggle off
    if (el.dataset.cssFs === "1") {
      delete el.dataset.cssFs;
      setIsFullscreen(false);
      return;
    }
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }
    const req = el.requestFullscreen?.bind(el);
    if (!req) {
      el.dataset.cssFs = "1";
      setIsFullscreen(true);
      return;
    }
    req().catch(() => {
      // iframe likely blocks native fullscreen — fall back to CSS-only
      el.dataset.cssFs = "1";
      setIsFullscreen(true);
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
      <aside className="border border-border rounded-md bg-card p-3 space-y-3 h-fit">
        <Button size="sm" className="w-full gap-1.5" onClick={newMap}>
          <Plus size={14} /> Novo mapa
        </Button>
        <div className="border-t border-border pt-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Salvos
          </div>
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {maps.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum ainda.</p>
            )}
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
                  title="Excluir"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-border pt-3 text-[10px] text-muted-foreground leading-relaxed">
          <div className="font-mono uppercase tracking-widest mb-1.5">Dicas</div>
          <ul className="space-y-1">
            <li>• Barra de ferramentas fica no canvas</li>
            <li>• Duplo clique = texto</li>
            <li>• Conectar formas: escolha a <b>seta</b>, arraste da borda de uma forma até a outra (a borda acende quando conecta)</li>
            <li>• Trave a seta no ícone de cadeado da barra para conectar várias sem reclicar</li>
            <li>• Ctrl+Z / Ctrl+Y = desfazer/refazer</li>
            <li>• Roda do mouse = zoom</li>
          </ul>
        </div>
      </aside>

      <div
        ref={wrapRef}
        className={
          "border border-border rounded-md bg-card overflow-hidden flex flex-col " +
          (isFullscreen ? "fixed inset-0 z-50 rounded-none" : "")
        }
      >
        <div className="flex items-center gap-2 p-2 border-b border-border shrink-0">
          <Input
            value={title}
            placeholder="Título do mapa"
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 text-sm max-w-xs"
          />
          <div className="flex-1" />
          <div className="flex items-center gap-1 border border-border rounded-md p-0.5 bg-background">
            {(["dots", "grid", "none"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setBgStyle(s)}
                className={
                  "px-2 py-1 text-[11px] font-mono rounded transition-colors " +
                  (bgStyle === s
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground")
                }
                title={
                  s === "dots" ? "Fundo com bolinhas" : s === "grid" ? "Grade quadriculada" : "Sem fundo"
                }
              >
                {s === "dots" ? "• • •" : s === "grid" ? "▦" : "∅"}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={exportPng} className="gap-1">
            <ImageIcon size={13} />
            PNG
          </Button>
          <Button size="sm" variant="outline" onClick={exportPdf} className="gap-1">
            <FileText size={13} />
            PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={toggleFullscreen}
            className="gap-1"
            title={isFullscreen ? "Sair da tela cheia (Esc)" : "Tela cheia"}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {isFullscreen ? "Sair" : "Tela cheia"}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Salvar
          </Button>
        </div>

        {/* Canvas — explicit height so Excalidraw fills; dot bg via CSS layer */}
        <div
          className="bg-background w-full relative"
          style={{
            height: isFullscreen ? "calc(100vh - 49px)" : "640px",
            backgroundImage:
              bgStyle === "dots"
                ? "radial-gradient(circle, rgba(0,0,0,0.22) 1px, transparent 1px)"
                : undefined,
            backgroundSize: bgStyle === "dots" ? "20px 20px" : undefined,
          }}
          ref={canvasWrapRef}
        >
          <ClientOnly
            fallback={
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin mr-2" />
                Carregando canvas…
              </div>
            }
          >
            <Suspense
              fallback={
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  <Loader2 size={14} className="animate-spin mr-2" />
                  Carregando canvas…
                </div>
              }
            >
              <ExcalidrawLazy
                key={loadKey}
                initialData={initialDataRef.current ?? { elements: [], appState: { viewBackgroundColor: bgStyle === "dots" ? "transparent" : "#ffffff", gridModeEnabled: bgStyle === "grid", gridSize: 20, objectsSnapModeEnabled: true }, files: {} }}
                excalidrawAPI={(api: any) => (apiRef.current = api)}
                UIOptions={{
                  canvasActions: {
                    changeViewBackgroundColor: true,
                    clearCanvas: true,
                    export: false,
                    loadScene: false,
                    saveToActiveFile: false,
                    toggleTheme: true,
                    saveAsImage: false,
                  },
                }}
              />
              <ConnectorHandles apiRef={apiRef} containerRef={canvasWrapRef} />
            </Suspense>
          </ClientOnly>
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
