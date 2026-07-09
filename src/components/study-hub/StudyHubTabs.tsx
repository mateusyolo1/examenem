import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClientOnly, useSearch } from "@tanstack/react-router";
// jsPDF is imported dynamically inside the export handler — importing at the
// module top made it evaluate during SSR on Cloudflare Workers where `window`
// doesn't exist, crashing every page ("ReferenceError: window is not defined").
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
  MousePointer2,
  Hand,
  Pencil,
  Highlighter,
  StickyNote,
  Square,
  Circle,
  Diamond,
  Triangle,
  ArrowUpRight,
  Minus,
  Type,
  Eraser,
  Zap,
  ChevronUp,
  List,
  Tag,
  Network,
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

import { GenerateFromVideoButton } from "./GenerateFromVideoButton";
import { PropertiesBar } from "./PropertiesBar";
import { FigmaBottomToolbar } from "./FigmaBottomToolbar";

export { MindMapsTab };
export { NotesTab } from "./NotesTab";
export { FlashcardsTab } from "./FlashcardsTab";
export { SummariesTab } from "./SummariesTab";
export { DraftsSection } from "./DraftsSection";

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
      const { Excalidraw, MainMenu } = mod;
      // Wrap Excalidraw so callers can inject custom MainMenu items via
      // a `menuItems` render prop (keeps MainMenu import inside the lazy
      // chunk so SSR never touches it).
      const Wrapped = (props: any) => {
        const { menuItems, children, ...rest } = props;
        return (
          <Excalidraw {...rest}>
            {menuItems ? menuItems(MainMenu) : children}
          </Excalidraw>
        );
      };
      return { default: Wrapped };
    });


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

  // Auto-open a map when navigated with `?openMap=<id>` (used by the
  // "Gerar mapa mental" button in NotesTab video cards).
  const search = useSearch({ strict: false }) as { openMap?: string };
  useEffect(() => {
    if (search.openMap && search.openMap !== selectedId) {
      setSelectedId(search.openMap);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.openMap]);

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

  // ── Freedraw modifiers ─────────────────────────────────────────────
  // SHIFT ao iniciar rabisco → usa "line" (Shift trava em ângulos).
  // CTRL (em qualquer momento do traço) → ao soltar, suaviza os pontos
  //   com Chaikin. Se o traço parecer um círculo fechado, substitui
  //   por uma elipse perfeita.
  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;

    let swappedToLine = false;
    let drawing = false;
    let ctrlEver = false;
    let skipNextRestore = false;

    const isToolbarEvent = (target: EventTarget | null) =>
      target instanceof HTMLElement && Boolean(target.closest("[data-mindmap-toolbar]"));

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
    };

    // Ajusta um círculo aos pontos (método de Kasa, mínimos quadrados) e,
    // se o resíduo for baixo, devolve pontos reamostrados ao longo do arco
    // perfeito indo do primeiro ao último ponto no sentido do traço.
    const fitArc = (pts: [number, number][]): [number, number][] | null => {
      const n = pts.length;
      if (n < 8) return null;
      let Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0;
      let Sxz = 0, Syz = 0, Sz = 0;
      for (const [x, y] of pts) {
        const z = x * x + y * y;
        Sx += x; Sy += y; Sxx += x * x; Syy += y * y; Sxy += x * y;
        Sxz += x * z; Syz += y * z; Sz += z;
      }
      // Resolve M·[a,b,c] = v, onde centro = (a/2, b/2), r² = c + a²/4 + b²/4
      const M = [
        [Sxx, Sxy, Sx],
        [Sxy, Syy, Sy],
        [Sx,  Sy,  n ],
      ];
      const v = [Sxz, Syz, Sz];
      const det =
        M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
        M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
        M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
      if (Math.abs(det) < 1e-6) return null;
      const solve = (col: number) => {
        const A = M.map((row, i) => row.map((val, j) => (j === col ? v[i] : val)));
        return (
          A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
          A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
          A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
        ) / det;
      };
      const a = solve(0), b = solve(1), c = solve(2);
      const cx = a / 2, cy = b / 2;
      const r2 = c + (a * a + b * b) / 4;
      if (r2 <= 0) return null;
      const r = Math.sqrt(r2);
      if (r < 15 || r > 20000) return null;

      // Resíduo médio normalizado
      let err = 0;
      for (const [x, y] of pts) {
        err += Math.abs(Math.hypot(x - cx, y - cy) - r);
      }
      err /= n * r;
      if (err > 0.09) return null;

      // Ângulos start/end e sentido a partir de um ponto do meio
      const angleOf = (p: [number, number]) => Math.atan2(p[1] - cy, p[0] - cx);
      const a0 = angleOf(pts[0]);
      const a1 = angleOf(pts[n - 1]);
      const am = angleOf(pts[Math.floor(n / 2)]);
      // determina delta angular do traço (soma de deltas assinados)
      let total = 0;
      let prev = a0;
      for (let i = 1; i < n; i++) {
        let cur = angleOf(pts[i]);
        let d = cur - prev;
        if (d > Math.PI) d -= 2 * Math.PI;
        else if (d < -Math.PI) d += 2 * Math.PI;
        total += d;
        prev = cur;
      }
      // Reamostra ao longo do arco a0 → a0 + total
      const steps = Math.max(32, Math.min(128, Math.round(Math.abs(total) * r / 4)));
      const out: [number, number][] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const ang = a0 + total * t;
        out.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
      }
      void a1; void am;
      return out;
    };

    const chaikin = (pts: [number, number][], passes = 3): [number, number][] => {
      let out = pts;
      for (let p = 0; p < passes; p++) {
        if (out.length < 3) break;
        const next: [number, number][] = [out[0]];
        for (let i = 0; i < out.length - 1; i++) {
          const [x0, y0] = out[i];
          const [x1, y1] = out[i + 1];
          next.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1]);
          next.push([0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
        }
        next.push(out[out.length - 1]);
        out = next;
      }
      return out;
    };

    // Retorna {cx, cy, rx, ry} se os pontos formarem um círculo/elipse
    // fechado; senão null.
    const detectEllipse = (pts: [number, number][]) => {
      if (pts.length < 20) return null;
      const first = pts[0];
      const last = pts[pts.length - 1];
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const w = maxX - minX, h = maxY - minY;
      if (w < 30 || h < 30) return null;
      // endpoints próximos (relativo ao tamanho)
      const gap = Math.hypot(first[0] - last[0], first[1] - last[1]);
      if (gap > Math.max(w, h) * 0.35) return null;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const rx = w / 2, ry = h / 2;
      // desvio médio dos raios normalizados — círculo/elipse tem baixo desvio
      let err = 0;
      for (const [x, y] of pts) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        err += Math.abs(Math.hypot(dx, dy) - 1);
      }
      err /= pts.length;
      if (err > 0.22) return null;
      return { cx, cy, rx, ry };
    };

    const STICKY_TOOLS = new Set([
      "freedraw", "rectangle", "ellipse", "diamond", "arrow", "line", "text",
    ]);
    let stickyTool: string | null = null;

    const onDown = (e: PointerEvent) => {
      const api = apiRef.current;
      if (!api) return;
      if (isToolbarEvent(e.target)) {
        stickyTool = null;
        skipNextRestore = true;
        return;
      }
      const st = api.getAppState?.();
      const tool = st?.activeTool?.type;
      if (tool === "selection" || tool === "hand" || tool === "eraser") {
        // Usuário escolheu explicitamente seleção/mão/borracha — não restaurar
        stickyTool = null;
      } else if (tool && STICKY_TOOLS.has(tool)) {
        stickyTool = tool;
      }
      if (tool !== "freedraw") return;
      drawing = true;
      ctrlEver = e.ctrlKey || e.metaKey;
      if (e.shiftKey) {
        api.setActiveTool?.({ type: "line" });
        swappedToLine = true;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === "v" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !isTypingTarget(e.target)
      ) {
        stickyTool = null;
        apiRef.current?.setActiveTool?.({ type: "selection" });
        return;
      }
      if (drawing && (e.ctrlKey || e.metaKey)) ctrlEver = true;
    };

    const onToolbarToolChange = (e: Event) => {
      const tool = (e as CustomEvent<{ tool?: string }>).detail?.tool;
      if (tool === "selection" || tool === "hand" || tool === "eraser") {
        stickyTool = null;
        skipNextRestore = true;
        drawing = false;
        swappedToLine = false;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (drawing && (e.ctrlKey || e.metaKey)) ctrlEver = true;
    };

    const restoreSticky = () => {
      const api = apiRef.current;
      if (!api || !stickyTool) return;
      // Se o Excalidraw resetou pra "selection", volta pra ferramenta anterior
      setTimeout(() => {
        const cur = api.getAppState?.()?.activeTool?.type;
        if (cur === "selection" && stickyTool) {
          api.setActiveTool?.({ type: stickyTool });
        }
      }, 0);
    };

    const finishStroke = () => {
      const api = apiRef.current;
      const wasDrawing = drawing;
      const wasCtrl = ctrlEver;
      drawing = false;
      ctrlEver = false;
      if (!api) return;
      if (skipNextRestore) {
        skipNextRestore = false;
        swappedToLine = false;
        return;
      }
      if (swappedToLine) {
        api.setActiveTool?.({ type: "freedraw" });
        swappedToLine = false;
      }
      restoreSticky();
      if (!wasDrawing || !wasCtrl) return;

      setTimeout(async () => {
        try {
          const elements = api.getSceneElements?.();
          if (!elements || !elements.length) return;
          let idx = -1;
          for (let i = elements.length - 1; i >= 0; i--) {
            if ((elements[i] as any).type === "freedraw") { idx = i; break; }
          }
          if (idx < 0) return;
          const target = elements[idx] as any;
          const pts = target.points as [number, number][] | undefined;
          if (!pts || pts.length < 4) return;

          // Coordenadas absolutas para os fits
          const absPts = pts.map(([x, y]) => [x + target.x, y + target.y] as [number, number]);

          const nextElements = elements.slice();

          // 1) Tenta arco/círculo perfeito (funciona pra aberto e fechado)
          const arcPts = fitArc(absPts);
          // 2) Se não for circular mas fechar bem, tenta elipse (oval alongado)
          const ellipse = arcPts ? null : detectEllipse(absPts);

          if (ellipse) {
            const mod = await import("@excalidraw/excalidraw");
            const [ell] = mod.convertToExcalidrawElements([
              {
                type: "ellipse",
                x: ellipse.cx - ellipse.rx,
                y: ellipse.cy - ellipse.ry,
                width: ellipse.rx * 2,
                height: ellipse.ry * 2,
                strokeColor: target.strokeColor,
                backgroundColor: target.backgroundColor,
                strokeWidth: target.strokeWidth,
                strokeStyle: target.strokeStyle,
                roughness: target.roughness,
                opacity: target.opacity,
              } as any,
            ]);
            nextElements[idx] = ell;
          } else {
            const source = arcPts ?? chaikin(pts, 3).map(([x, y]) => [x + target.x, y + target.y] as [number, number]);
            const xs = source.map((p) => p[0]);
            const ys = source.map((p) => p[1]);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const shifted = source.map(([x, y]) => [x - minX, y - minY] as [number, number]);
            const width = Math.max(...xs) - minX;
            const height = Math.max(...ys) - minY;
            nextElements[idx] = {
              ...target,
              x: minX,
              y: minY,
              width,
              height,
              points: shifted,
              pressures: shifted.map(() => 0.5),
              lastCommittedPoint: shifted[shifted.length - 1],
              versionNonce: Math.floor(Math.random() * 2 ** 31),
              version: (target.version ?? 1) + 1,
            };
          }
          api.updateScene?.({ elements: nextElements });
        } catch {
          /* noop */
        }
      }, 0);
    };

    el.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mindmap-toolbar-tool-change", onToolbarToolChange);
    window.addEventListener("pointerup", finishStroke, true);
    window.addEventListener("pointercancel", finishStroke, true);
    return () => {
      el.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mindmap-toolbar-tool-change", onToolbarToolChange);
      window.removeEventListener("pointerup", finishStroke, true);
      window.removeEventListener("pointercancel", finishStroke, true);
    };
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
      const { jsPDF } = await import("jspdf");
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
          <GenerateFromVideoButton
            variant="toolbar"
            onInsert={async (elements, meta) => {
              const api = apiRef.current;
              if (!api) return;
              // Elements arrive already normalized via convertToExcalidrawElements.
              // Offset if the canvas already has content, so we don't stack
              // on top of an existing mind map.
              const current = api.getSceneElements() as any[];
              let offsetX = 0;
              if (current.length > 0) {
                const maxX = current.reduce(
                  (m: number, el: any) => Math.max(m, (el.x ?? 0) + (el.width ?? 0)),
                  -Infinity,
                );
                offsetX = Math.max(0, maxX + 200);
              }
              const shifted = elements.map((el: any) => ({
                ...el,
                x: (el.x ?? 0) + offsetX,
              }));
              const selected: Record<string, true> = {};
              for (const el of shifted) selected[el.id] = true;
              api.updateScene({
                elements: [...current, ...shifted],
                appState: { selectedElementIds: selected },
              });
              api.scrollToContent(shifted, {
                animate: true,
                fitToViewport: true,
                maxZoom: 1,
              });
              if (!title || title === "Novo mapa") setTitle(meta.title);
            }}
          />
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
          {/* Hide Excalidraw's native top toolbar / lock button — we render a
              FigJam-style bottom pill instead. Scoped to this container. */}
          <style>{`
            .mm-canvas .App-toolbar,
            .mm-canvas .App-toolbar-container,
            .mm-canvas .App-toolbar__extra-tools-trigger,
            .mm-canvas .lock-button,
            .mm-canvas .App-mobile-menu .App-toolbar,
            .mm-canvas .App-menu__left,
            .mm-canvas .layer-ui__wrapper__top-right,
            .mm-canvas .App-menu_top__left { display: none !important; }
            .mm-canvas .App-menu_top { top: 8px; }
          `}</style>
          <div className="mm-canvas h-full w-full">
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
                menuItems={(MainMenu: any) => (
                  <MainMenu>
                    <MainMenu.DefaultItems.CommandPalette />
                    <MainMenu.DefaultItems.SearchMenu />
                    <MainMenu.DefaultItems.Help />
                    <MainMenu.DefaultItems.ClearCanvas />
                    <MainMenu.Separator />
                    <MainMenu.Item onSelect={exportPng}>Exportar PNG</MainMenu.Item>
                    <MainMenu.Item onSelect={exportPdf}>Exportar PDF</MainMenu.Item>
                    <MainMenu.Separator />
                    <MainMenu.DefaultItems.Socials />
                    <MainMenu.Separator />
                    <MainMenu.DefaultItems.ToggleTheme />
                    <MainMenu.DefaultItems.ChangeCanvasBackground />
                  </MainMenu>
                )}
              />
              <ConnectorHandles apiRef={apiRef} containerRef={canvasWrapRef} />
              <FigmaBottomToolbar apiRef={apiRef} />
              <PropertiesBar apiRef={apiRef} />
            </Suspense>
          </ClientOnly>
          </div>
        </div>
      </div>
    </div>
  );
}


// ============ FIGMA-STYLE BOTTOM TOOLBAR ============









