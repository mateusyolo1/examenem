import { useEffect, useState } from "react";
import {
  Plus,
  Frame,
  MousePointer2,
  Hand,
  Pencil,
  Highlighter,
  Square,
  Circle,
  Diamond,
  Triangle,
  ArrowUpRight,
  Minus,
  Type,
  Zap,
  ChevronUp,
  Network,
  Image as ImageIcon,
} from "lucide-react";

import toolPencil from "@/assets/tools/pencil.png.asset.json";
import toolPen from "@/assets/tools/pen.png.asset.json";
import toolEraser from "@/assets/tools/eraser.png.asset.json";
import toolMarker from "@/assets/tools/marker.png.asset.json";
import toolHighlighter from "@/assets/tools/highlighter.png.asset.json";
import toolPostit from "@/assets/tools/postit.png.asset.json";

export type ToolId =
  | "selection" | "hand"
  | "pen" | "highlighter" | "pencil" | "marker"
  | "sticky"
  | "rectangle" | "ellipse" | "diamond" | "triangle" | "line" | "arrow"
  | "text" | "image" | "eraser" | "laser" | "frame";

export function FigmaBottomToolbar({ apiRef }: { apiRef: React.MutableRefObject<any> }) {
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
