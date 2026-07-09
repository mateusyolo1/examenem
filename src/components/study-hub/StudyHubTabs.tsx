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

import toolPencil from "@/assets/tools/pencil.png.asset.json";
import toolPen from "@/assets/tools/pen.png.asset.json";
import toolEraser from "@/assets/tools/eraser.png.asset.json";
import toolMarker from "@/assets/tools/marker.png.asset.json";
import toolHighlighter from "@/assets/tools/highlighter.png.asset.json";
import toolPostit from "@/assets/tools/postit.png.asset.json";
import { GenerateFromVideoButton } from "./GenerateFromVideoButton";
import { StickyToolbar } from "./StickyToolbar";
import { PropertiesBar } from "./PropertiesBar";
import {
  STICKY_COLORS,
  STICKY_FONT_FAMILIES,
  STICKY_SIZE_PRESETS,
  applyBold,
  removeBold,
  applyStrike,
  removeStrike,
} from "./sticky-utils";

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
    if (!import.meta.env.SSR) {
      import("@excalidraw/excalidraw").then((m) => {
        if (alive) convertRef.current = m.convertToExcalidrawElements;
      });
    }
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

  const sideFp = (side: "t" | "r" | "b" | "l"): [number, number] => fpFor(side);

  const sideAnchor = (target: any, side: "t" | "r" | "b" | "l") => ({
    x: side === "l" ? target.x : side === "r" ? target.x + target.width : target.x + target.width / 2,
    y: side === "t" ? target.y : side === "b" ? target.y + target.height : target.y + target.height / 2,
  });

  const nearestSide = (target: any, p: { x: number; y: number }): "t" | "r" | "b" | "l" => {
    const dLeft = Math.abs(p.x - target.x);
    const dRight = Math.abs(p.x - (target.x + target.width));
    const dTop = Math.abs(p.y - target.y);
    const dBottom = Math.abs(p.y - (target.y + target.height));
    const minD = Math.min(dLeft, dRight, dTop, dBottom);
    return minD === dTop ? "t" : minD === dBottom ? "b" : minD === dLeft ? "l" : "r";
  };

  const distanceToElement = (target: any, p: { x: number; y: number }) => {
    const dx = Math.max(target.x - p.x, 0, p.x - (target.x + target.width));
    const dy = Math.max(target.y - p.y, 0, p.y - (target.y + target.height));
    return Math.hypot(dx, dy);
  };

  const addBoundArrow = (target: any, arrowId: string) => {
    const existing = Array.isArray(target.boundElements) ? target.boundElements : [];
    if (existing.some((b: any) => b.id === arrowId)) return target;
    return {
      ...target,
      boundElements: [...existing, { id: arrowId, type: "arrow" }],
      version: (target.version ?? 1) + 1,
      versionNonce: Math.floor(Math.random() * 2 ** 31),
      updated: Date.now(),
    };
  };

  const dedupePoints = (points: [number, number][]) =>
    points.filter((p, i) => i === 0 || Math.abs(p[0] - points[i - 1][0]) > 0.5 || Math.abs(p[1] - points[i - 1][1]) > 0.5);

  const elbowPoints = (start: { x: number; y: number }, end: { x: number; y: number }, key: string): [number, number][] => {
    const relX = end.x - start.x;
    const relY = end.y - start.y;
    if (key === "r" || key === "l") {
      const dir = key === "r" ? 1 : -1;
      const midX = dir * relX > 36 ? relX / 2 : dir * 36;
      return dedupePoints([[0, 0], [midX, 0], [midX, relY], [relX, relY]]);
    }
    const dir = key === "b" ? 1 : -1;
    const midY = dir * relY > 36 ? relY / 2 : dir * 36;
    return dedupePoints([[0, 0], [0, midY], [relX, midY], [relX, relY]]);
  };

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
    const start = { x: a.sx, y: a.sy };
    const arrow: any = {
      ...built[1],
      points: elbowPoints(start, { x: start.x + dx * gap, y: start.y + dy * gap }, a.key),
      elbowed: false,
      roundness: null,
      startBinding: { elementId: el.id, focus: 0, gap: 1, fixedPoint: fpFor(a.key) },
      endBinding: { elementId: newShape.id, focus: 0, gap: 1, fixedPoint: oppositeFp(a.key) },
    };
    const current = api.getSceneElements();
    api.updateScene({
      elements: current.map((n: any) => n.id === el.id ? addBoundArrow(n, arrow.id) : n).concat(addBoundArrow(newShape, arrow.id), arrow),
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
    let arrowCreated = false;
    let arrowId: string | null = null;
    const start = { x: a.sx, y: a.sy };
    const fpStart = fpFor(a.key);
    const { dx: ddx, dy: ddy } = dirVec(a.key);

    const scenePt = (ev: PointerEvent) => {
      const st = api.getAppState();
      const z = st.zoom?.value ?? 1;
      return {
        x: (ev.clientX - rect.left) / z - (st.scrollX ?? 0),
        y: (ev.clientY - rect.top) / z - (st.scrollY ?? 0),
      };
    };

    const findTarget = (scn: { x: number; y: number }) => {
      const arr = api.getSceneElements();
      const st = api.getAppState();
      const z = st.zoom?.value ?? 1;
      const hitMargin = Math.max(18, 34 / z);
      return [...arr]
        .reverse()
        .filter(
          (n: any) =>
            !n.isDeleted &&
            n.id !== el.id &&
            n.id !== arrowId &&
            BINDABLE.has(n.type) &&
            distanceToElement(n, scn) <= hitMargin,
        )
        .sort((x: any, y: any) => distanceToElement(x, scn) - distanceToElement(y, scn))[0];
    };

    // Create a NATIVE elbowed arrow with startBinding fixedPoint — same shape
    // that cloneInDirection (Ctrl+→) produces. Excalidraw handles the routing.
    const createArrow = (ev: PointerEvent) => {
      const st = api.getAppState();
      const end0 = scenePt(ev);
      const built = convert([
        {
          type: "arrow",
          x: start.x,
          y: start.y,
          points: [
            [0, 0],
            [Math.max(Math.abs(end0.x - start.x), 40) * ddx || end0.x - start.x,
             Math.max(Math.abs(end0.y - start.y), 40) * ddy || end0.y - start.y],
          ],
          strokeColor: st.currentItemStrokeColor ?? "#1e1e1e",
          strokeWidth: st.currentItemStrokeWidth ?? 2,
          endArrowhead: "arrow",
          elbowed: true,
          roundness: null,
        } as any,
      ]);
      const arrow: any = {
        ...built[0],
        elbowed: true,
        roundness: null,
        startBinding: { elementId: el.id, focus: 0, gap: 1, fixedPoint: fpStart },
        endBinding: null,
      };
      arrowId = arrow.id;
      const current = api.getSceneElements();
      api.updateScene({
        elements: current
          .map((n: any) => (n.id === el.id ? addBoundArrow(n, arrow.id) : n))
          .concat(arrow),
      });
      arrowCreated = true;
      draggingRef.current = true;
    };

    const updateArrow = (ev: PointerEvent, finalize = false) => {
      if (!arrowId) return;
      const scn = scenePt(ev);
      const target = findTarget(scn);
      const arr = api.getSceneElements();
      const next = arr.map((n: any) => {
        if (n.id === arrowId) {
          let endPoint = scn;
          let endBinding: any = null;
          if (target) {
            const side = nearestSide(target, scn);
            endPoint = sideAnchor(target, side);
            endBinding = {
              elementId: target.id,
              focus: 0,
              gap: 1,
              fixedPoint: sideFp(side),
            };
          }
          return {
            ...n,
            points: [
              [0, 0],
              [endPoint.x - start.x, endPoint.y - start.y],
            ],
            endBinding,
            version: (n.version ?? 1) + 1,
            versionNonce: Math.floor(Math.random() * 2 ** 31),
          };
        }
        if (finalize && target && n.id === target.id) {
          return addBoundArrow(n, arrowId!);
        }
        return n;
      });
      api.updateScene({ elements: next });
    };

    const onMove = (ev: PointerEvent) => {
      if (!arrowCreated) {
        if (Math.hypot(ev.clientX - downX, ev.clientY - downY) < CLICK_THRESHOLD) return;
        createArrow(ev);
        return;
      }
      updateArrow(ev);
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
      updateArrow(ev, true);
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

type ToolId =
  | "selection" | "hand"
  | "pen" | "highlighter" | "pencil" | "marker"
  | "sticky"
  | "rectangle" | "ellipse" | "diamond" | "triangle" | "line" | "arrow"
  | "text" | "image" | "eraser" | "laser" | "frame";



function FigmaBottomToolbar({ apiRef }: { apiRef: React.MutableRefObject<any> }) {
  const [active, setActive] = useState<ToolId>("selection");
  const [shapesOpen, setShapesOpen] = useState(false);
  const [penOpen, setPenOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Fecha popovers ao clicar fora da toolbar (ex.: começar a desenhar no canvas)
  useEffect(() => {
    if (!penOpen && !shapesOpen && !moreOpen) return;
    const close = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest?.("[data-mindmap-toolbar]")) return;
      setPenOpen(false);
      setShapesOpen(false);
      setMoreOpen(false);
    };
    window.addEventListener("pointerdown", close, true);
    return () => window.removeEventListener("pointerdown", close, true);
  }, [penOpen, shapesOpen, moreOpen]);

  // Mirror Excalidraw's current tool for highlighting.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const st = apiRef.current?.getAppState?.();
      const t = st?.activeTool?.type;
      if (t && t !== active && ["selection","hand","freedraw","rectangle","ellipse","diamond","arrow","line","text","image","eraser","laser","frame"].includes(t)) {
        if (t === "freedraw") {
          // keep pen/highlighter/pencil/marker sub-state as-is
        } else {
          setActive(t as ToolId);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [apiRef, active]);

  const setTool = (id: ToolId) => {
    const api = apiRef.current;
    if (!api) return;
    setActive(id);
    const map: Record<string, string> = {
      selection: "selection", hand: "hand",
      pen: "freedraw", highlighter: "freedraw", pencil: "freedraw", marker: "freedraw",
      sticky: "rectangle",
      rectangle: "rectangle", ellipse: "ellipse", diamond: "diamond",
      triangle: "diamond", line: "line", arrow: "arrow",
      text: "text", image: "image", eraser: "eraser", laser: "laser", frame: "frame",
    };
    const toolType = map[id];
    window.dispatchEvent(new CustomEvent("mindmap-toolbar-tool-change", { detail: { id, tool: toolType } }));
    api.setActiveTool({ type: toolType as any, locked: false });
    if (toolType === "selection") {
      api.updateScene?.({
        appState: {
          activeTool: { type: "selection", locked: false, lastActiveTool: null },
        },
      });
      requestAnimationFrame(() => api.setActiveTool?.({ type: "selection", locked: false }));
    }
    const patch: any = {};
    if (id === "pen") { patch.currentItemStrokeColor = "#1e1e1e"; patch.currentItemStrokeWidth = 2; patch.currentItemOpacity = 100; }
    if (id === "pencil") { patch.currentItemStrokeColor = "#1e1e1e"; patch.currentItemStrokeWidth = 1; patch.currentItemOpacity = 100; }
    if (id === "marker") { patch.currentItemStrokeColor = "#0f172a"; patch.currentItemStrokeWidth = 4; patch.currentItemOpacity = 100; }
    if (id === "highlighter") { patch.currentItemStrokeColor = "#fde047"; patch.currentItemStrokeWidth = 12; patch.currentItemOpacity = 45; }
    if (id === "sticky") {
      patch.currentItemBackgroundColor = "#fef9c3";
      patch.currentItemFillStyle = "solid";
      patch.currentItemStrokeColor = "transparent";
    }
    if (Object.keys(patch).length) api.updateScene({ appState: patch });
  };

  // FigJam-style "Mapa mental": drop a pre-wired template (central node + 3 branches)
  // centered on the current viewport.
  const insertMindMap = async () => {
    const api = apiRef.current;
    if (!api) return;
    const m = await import("@excalidraw/excalidraw");
    const convert = m.convertToExcalidrawElements;
    const st = api.getAppState();
    const zoom = st.zoom?.value ?? 1;
    const vw = st.width ?? 800;
    const vh = st.height ?? 600;
    const centerX = -st.scrollX + vw / (2 * zoom);
    const centerY = -st.scrollY + vh / (2 * zoom);
    const cw = 240;
    const ch = 84;
    const cx = centerX - cw / 2 - 160;
    const cy = centerY - ch / 2;

    const t = Date.now();
    const centerId = `mm-c-${t}`;
    const ids = [`mm-1-${t}`, `mm-2-${t}`, `mm-3-${t}`];
    const labels = ["Um conceito", "Uma ideia", "Um pensamento"];
    const bw = 180;
    const bh = 60;
    const branchGapX = 140;
    const branchX = cx + cw + branchGapX;
    const gap = 30;
    const totalH = bh * 3 + gap * 2;
    const startY = cy + ch / 2 - totalH / 2;

    const skeleton: any[] = [
      {
        type: "rectangle",
        id: centerId,
        x: cx,
        y: cy,
        width: cw,
        height: ch,
        strokeColor: "#1e1e1e",
        backgroundColor: "#ffffff",
        fillStyle: "solid",
        strokeWidth: 2,
        roundness: { type: 3 },
        label: { text: "Qualquer questão ou tópico", fontSize: 20 },
      },
    ];
    ids.forEach((id, i) => {
      skeleton.push({
        type: "rectangle",
        id,
        x: branchX,
        y: startY + i * (bh + gap),
        width: bw,
        height: bh,
        strokeColor: "#1e1e1e",
        backgroundColor: "#ffffff",
        fillStyle: "solid",
        strokeWidth: 2,
        roundness: { type: 3 },
        label: { text: labels[i], fontSize: 16 },
      });
    });
    // Curved (bezier) connectors like FigJam mind map branches.
    const startX = cx + cw;
    const startPy = cy + ch / 2;
    ids.forEach((id, i) => {
      const endX = branchX;
      const endY = startY + i * (bh + gap) + bh / 2;
      const dx = endX - startX;
      const dy = endY - startPy;
      // Two control-ish points to force a smooth S-curve via roundness.
      skeleton.push({
        type: "line",
        x: startX,
        y: startPy,
        strokeColor: "#1e1e1e",
        strokeWidth: 2,
        roundness: { type: 2 },
        points: [
          [0, 0],
          [dx * 0.5, 0],
          [dx * 0.5, dy],
          [dx, dy],
        ],
        start: { id: centerId },
        end: { id },
      });
    });

    const built = convert(skeleton);
    const current = api.getSceneElements();
    const selected: Record<string, true> = {};
    for (const id of [centerId, ...ids]) selected[id] = true;
    api.updateScene({
      elements: [...current, ...built],
      appState: { selectedElementIds: selected },
    });
    api.scrollToContent(built, { animate: true, fitToViewport: true, maxZoom: 1 });
  };

  // Insert a FigJam-style sticky note (yellow rounded square with editable text)
  // at the current viewport center. Sticky is NOT a native Excalidraw tool, so
  // we drop a pre-styled element the user can immediately move / edit.
  const insertStickyNote = async () => {
    const api = apiRef.current;
    if (!api) return;
    const m = await import("@excalidraw/excalidraw");
    const convert = m.convertToExcalidrawElements;
    const st = api.getAppState();
    const zoom = st.zoom?.value ?? 1;
    const vw = st.width ?? 800;
    const vh = st.height ?? 600;
    const centerX = -st.scrollX + vw / (2 * zoom);
    const centerY = -st.scrollY + vh / (2 * zoom);
    const size = 200;
    const id = `sticky-${Date.now()}`;
    // Busca nome do autor da sessão (fallback "Você")
    let author = "Você";
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getUser();
      const u: any = data?.user;
      author =
        u?.user_metadata?.full_name ||
        u?.user_metadata?.name ||
        (u?.email ? String(u.email).split("@")[0] : "Você");
    } catch {}
    const built = convert([
      {
        type: "rectangle",
        id,
        x: centerX - size / 2,
        y: centerY - size / 2,
        width: size,
        height: size,
        backgroundColor: "#fef08a",
        fillStyle: "solid",
        strokeColor: "transparent",
        strokeWidth: 1,
        roundness: { type: 3 },
        customData: { sticky: true, bold: false, strike: false, list: false, showAuthor: true, author },
        label: { text: "", fontSize: 20, textAlign: "center", verticalAlign: "middle", strokeColor: "#1e293b" },
      },
    ] as any);
    const current = api.getSceneElements();
    api.updateScene({
      elements: [...current, ...built],
      appState: { selectedElementIds: { [id]: true } },
    });
    api.scrollToContent(built, { animate: true, fitToViewport: true, maxZoom: 1 });
    setActive("selection");
    api.setActiveTool({ type: "selection" });
  };



  const Btn = ({
    id, label, icon: Icon, image, onClick,
  }: { id?: ToolId; label: string; icon?: any; image?: string; onClick?: () => void }) => {
    const isActive = id && active === id;
    const switchOnPress = id === "selection" || id === "hand" || id === "eraser";
    return (
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          if (id && switchOnPress) {
            setTool(id);
            setPenOpen(false);
            setShapesOpen(false);
            setMoreOpen(false);
          }
        }}
        onClick={onClick ?? (() => id && setTool(id))}
        title={label}
        className={
          "h-11 w-11 rounded-lg flex items-center justify-center transition-all " +
          (isActive
            ? "bg-primary/15 text-primary ring-1 ring-primary/40 scale-105"
            : "text-foreground/70 hover:text-foreground hover:bg-muted hover:scale-105")
        }
      >
        {image ? (
          <img
            src={image}
            alt={label}
            draggable={false}
            className={
              "object-contain select-none transition-transform " +
              (isActive
                ? "h-9 w-9 drop-shadow-[0_3px_6px_rgba(34,197,94,0.45)]"
                : "h-8 w-8 drop-shadow-[0_2px_3px_rgba(0,0,0,0.15)]")
            }
          />
        ) : Icon ? (
          <Icon size={18} strokeWidth={1.75} />
        ) : null}
      </button>
    );
  };

  const Divider = () => <div className="w-px h-6 bg-border/70 mx-1" />;

  const penMeta: Record<string, { icon: any; image: string; label: string }> = {
    pen: { icon: Pencil, image: toolPen.url, label: "Caneta" },
    marker: { icon: Pencil, image: toolMarker.url, label: "Marcador" },
    highlighter: { icon: Highlighter, image: toolHighlighter.url, label: "Marca-texto" },
    pencil: { icon: Pencil, image: toolPencil.url, label: "Lápis fino" },
  };
  const activePen = (["pen","marker","highlighter","pencil"] as const).includes(active as any)
    ? (active as "pen" | "marker" | "highlighter" | "pencil")
    : "pen";

  const shapes: { id: ToolId; icon: any; label: string }[] = [
    { id: "rectangle", icon: Square, label: "Retângulo" },
    { id: "ellipse", icon: Circle, label: "Círculo" },
    { id: "diamond", icon: Diamond, label: "Losango" },
    { id: "triangle", icon: Triangle, label: "Triângulo" },
    { id: "line", icon: Minus, label: "Linha" },
  ];
  const activeShape = shapes.find((s) => s.id === active) ?? shapes[0];

  // Lucide-based custom cursor when a drawing tool is active.
  // Rendered as an inline SVG data URI so the cursor matches the toolbar icon.
  const svgCursor = (paths: string, hotX = 2, hotY = 22) => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24' fill='none' stroke='%231e1e1e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='0' y='0' width='24' height='24' fill='white' fill-opacity='0.001'/>${paths}</svg>`;
    return `url("data:image/svg+xml;utf8,${svg}") ${hotX} ${hotY}, crosshair`;
  };
  const cursorMap: Partial<Record<ToolId, string>> = {
    pen: svgCursor("<path d='M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'/><path d='m15 5 4 4'/>"),
    pencil: svgCursor("<path d='M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'/><path d='m15 5 4 4'/>"),
    marker: svgCursor("<path d='M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'/><path d='m15 5 4 4'/>"),
    highlighter: svgCursor("<path d='m9 11-6 6v3h9l3-3'/><path d='m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4'/>", 2, 22),
    eraser: svgCursor("<path d='m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21'/><path d='M22 21H7'/><path d='m5 11 9 9'/>", 4, 20),
  };
  const cursorCss = cursorMap[active];

  return (
    <>
      {cursorCss && (
        <style>{`.mm-canvas canvas, .mm-canvas .excalidraw .interactive { cursor: ${cursorCss} !important; }`}</style>
      )}
      <div data-mindmap-toolbar="true" className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-4 z-30">
      {/* Popovers */}
      {penOpen && (
        <div className="pointer-events-auto absolute bottom-full mb-2 left-1/2 -translate-x-1/2 -translate-x-[80px] flex items-end gap-1 bg-card border border-border rounded-2xl shadow-lg px-2 py-2">
          {(Object.keys(penMeta) as (keyof typeof penMeta)[]).map((k) => (
            <Btn key={k} id={k as ToolId} image={penMeta[k].image} label={penMeta[k].label} onClick={() => { setTool(k as ToolId); setPenOpen(false); }} />
          ))}
        </div>
      )}
      {shapesOpen && (
        <div className="pointer-events-auto absolute bottom-full mb-2 left-1/2 -translate-x-1/2 translate-x-[30px] flex items-center gap-1 bg-card border border-border rounded-xl shadow-lg px-2 py-1.5">
          {shapes.map((s) => (
            <Btn key={s.id} id={s.id} icon={s.icon} label={s.label} onClick={() => { setTool(s.id); setShapesOpen(false); }} />
          ))}
          <div className="w-px h-6 bg-border/70 mx-1" />
          <button
            title="Mapa mental"
            onClick={() => { insertMindMap(); setShapesOpen(false); }}
            className="h-10 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-muted transition-colors"
          >
            <Network size={16} strokeWidth={1.75} />
            Mapa mental
          </button>
        </div>
      )}
      {moreOpen && (
        <div className="pointer-events-auto absolute bottom-full mb-2 right-0 flex items-end gap-1 bg-card border border-border rounded-2xl shadow-lg px-2 py-2">
          <Btn id="image" icon={ImageIcon} label="Imagem" onClick={() => { setTool("image"); setMoreOpen(false); }} />
          <Btn id="eraser" image={toolEraser.url} label="Borracha" onClick={() => { setTool("eraser"); setMoreOpen(false); }} />
          <Btn id="laser" icon={Zap} label="Ponteiro laser" onClick={() => { setTool("laser"); setMoreOpen(false); }} />
          <Btn id="frame" icon={Frame} label="Frame" onClick={() => { setTool("frame"); setMoreOpen(false); }} />
        </div>
      )}

      {/* Main pill */}
      <div className="pointer-events-auto flex items-end gap-0.5 bg-card/95 backdrop-blur border border-border rounded-2xl shadow-xl px-2 py-1.5">
        <Btn id="selection" icon={MousePointer2} label="Selecionar" />
        <Btn id="hand" icon={Hand} label="Mover" />
        <Divider />
        <button
          onClick={() => { setPenOpen((v) => !v); setShapesOpen(false); setMoreOpen(false); setTool(activePen); }}
          title={penMeta[activePen].label}
          className={
            "h-11 px-1.5 rounded-lg flex items-center gap-0.5 transition-all " +
            (["pen","marker","highlighter","pencil"].includes(active as string)
              ? "bg-primary/15 text-primary ring-1 ring-primary/40 scale-105"
              : "text-foreground/70 hover:text-foreground hover:bg-muted hover:scale-105")
          }
        >
          <img
            src={penMeta[activePen].image}
            alt={penMeta[activePen].label}
            draggable={false}
            className={
              "object-contain select-none " +
              (["pen","marker","highlighter","pencil"].includes(active as string)
                ? "h-9 w-9 drop-shadow-[0_3px_6px_rgba(34,197,94,0.45)]"
                : "h-8 w-8 drop-shadow-[0_2px_3px_rgba(0,0,0,0.15)]")
            }
          />
          <ChevronUp size={11} className="opacity-60" />
        </button>
        <Btn id="sticky" image={toolPostit.url} label="Nota adesiva" onClick={() => insertStickyNote()} />
        <Btn id="eraser" image={toolEraser.url} label="Borracha" onClick={() => setTool("eraser")} />
        <Divider />
        <button
          onClick={() => { setShapesOpen((v) => !v); setPenOpen(false); setMoreOpen(false); setTool(activeShape.id); }}
          title={activeShape.label}
          className={
            "h-11 px-2 rounded-lg flex items-center gap-0.5 transition-colors " +
            (shapes.some((s) => s.id === active)
              ? "bg-primary/15 text-primary ring-1 ring-primary/40"
              : "text-foreground/70 hover:text-foreground hover:bg-muted")
          }
        >
          {(() => { const I = activeShape.icon; return <I size={18} strokeWidth={1.75} />; })()}
          <ChevronUp size={11} className="opacity-60" />
        </button>
        <Btn id="arrow" icon={ArrowUpRight} label="Seta" />
        <Divider />
        <Btn id="text" icon={Type} label="Texto" />
        <Divider />
        <Btn label="Mais" icon={Plus} onClick={() => { setMoreOpen((v) => !v); setPenOpen(false); setShapesOpen(false); }} />
      </div>
    </div>
    </>
  );
}








