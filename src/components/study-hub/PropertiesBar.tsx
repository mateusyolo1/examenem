import { useEffect, useState } from "react";
import {
  ArrowUpFromLine,
  ArrowDownFromLine,
  Copy,
  Trash2,
} from "lucide-react";
import { StickyToolbar } from "./StickyToolbar";

// ============ FIGMA-STYLE PROPERTIES BAR ============
// Aparece quando ao menos um elemento está selecionado. Mostra controles
// de traço, preenchimento, opacidade, camadas e ações — tudo alinhado
// no rodapé, acima da barra principal de ferramentas.

const STROKE_SWATCHES = ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00", "#9c36b5", "#ffffff"];
const FILL_SWATCHES = ["transparent", "#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99", "#eebefa", "#ffffff"];
const STROKE_WIDTHS = [1, 2, 4];
const STROKE_STYLES: Array<{ id: "solid" | "dashed" | "dotted"; label: string }> = [
  { id: "solid", label: "Sólido" },
  { id: "dashed", label: "Tracejado" },
  { id: "dotted", label: "Pontilhado" },
];

export function PropertiesBar({ apiRef }: { apiRef: React.MutableRefObject<any> }) {
  const [selection, setSelection] = useState<{ ids: string[]; sample: any | null }>({ ids: [], sample: null });
  const [openPop, setOpenPop] = useState<null | "stroke" | "fill">(null);

  // Sincroniza seleção em tempo real via onChange do Excalidraw + fallback rAF
  useEffect(() => {
    let raf = 0;
    let unsub: (() => void) | null = null;

    const sync = () => {
      const api = apiRef.current;
      if (!api) return;
      const st = api.getAppState?.();
      const selMap = (st?.selectedElementIds ?? {}) as Record<string, boolean>;
      const ids = Object.keys(selMap).filter((k) => selMap[k]);
      const els = (api.getSceneElements?.() ?? []) as any[];
      const sample = ids.length ? els.find((e) => e.id === ids[0]) ?? null : null;
      setSelection((prev) => {
        if (
          prev.ids.length === ids.length &&
          prev.ids.every((id, i) => id === ids[i]) &&
          prev.sample?.version === sample?.version
        ) {
          return prev;
        }
        return { ids, sample };
      });
    };

    const tryAttach = () => {
      const api = apiRef.current;
      if (api?.onChange && !unsub) {
        try {
          unsub = api.onChange(() => sync());
        } catch {}
      }
      sync();
      raf = requestAnimationFrame(tryAttach);
    };
    raf = requestAnimationFrame(tryAttach);
    return () => {
      cancelAnimationFrame(raf);
      try { unsub?.(); } catch {}
    };
  }, [apiRef]);

  if (!selection.ids.length || !selection.sample) return null;

  // Sticky notes têm barra especializada estilo FigJam
  if (selection.ids.length === 1 && selection.sample?.customData?.sticky) {
    return <StickyToolbar apiRef={apiRef} rect={selection.sample} />;
  }

  const s = selection.sample as any;

  const patch = (fn: (el: any) => any) => {
    const api = apiRef.current;
    if (!api) return;
    const set = new Set(selection.ids);
    const next = (api.getSceneElements() as any[]).map((el) => {
      if (!set.has(el.id)) return el;
      const updated = fn(el);
      return {
        ...updated,
        versionNonce: Math.floor(Math.random() * 2 ** 31),
        version: (el.version ?? 1) + 1,
      };
    });
    api.updateScene({ elements: next });
  };

  const reorder = (dir: "front" | "back" | "forward" | "backward") => {
    const api = apiRef.current;
    if (!api) return;
    const all = api.getSceneElements() as any[];
    const set = new Set(selection.ids);
    const sel = all.filter((e) => set.has(e.id));
    const rest = all.filter((e) => !set.has(e.id));
    let out: any[];
    if (dir === "front") out = [...rest, ...sel];
    else if (dir === "back") out = [...sel, ...rest];
    else if (dir === "forward") {
      out = all.slice();
      for (let i = out.length - 2; i >= 0; i--) {
        if (set.has(out[i].id) && !set.has(out[i + 1].id)) {
          [out[i], out[i + 1]] = [out[i + 1], out[i]];
        }
      }
    } else {
      out = all.slice();
      for (let i = 1; i < out.length; i++) {
        if (set.has(out[i].id) && !set.has(out[i - 1].id)) {
          [out[i], out[i - 1]] = [out[i - 1], out[i]];
        }
      }
    }
    api.updateScene({ elements: out });
  };

  const duplicate = () => {
    const api = apiRef.current;
    if (!api) return;
    const all = api.getSceneElements() as any[];
    const set = new Set(selection.ids);
    const clones = all
      .filter((e) => set.has(e.id))
      .map((e) => ({
        ...e,
        id: (crypto.randomUUID?.() ?? String(Math.random())).replace(/-/g, ""),
        x: (e.x ?? 0) + 20,
        y: (e.y ?? 0) + 20,
        seed: Math.floor(Math.random() * 2 ** 31),
        versionNonce: Math.floor(Math.random() * 2 ** 31),
        version: 1,
      }));
    const selected: Record<string, true> = {};
    for (const c of clones) selected[c.id] = true;
    api.updateScene({ elements: [...all, ...clones], appState: { selectedElementIds: selected } });
  };

  const remove = () => {
    const api = apiRef.current;
    if (!api) return;
    const set = new Set(selection.ids);
    const next = (api.getSceneElements() as any[]).filter((e) => !set.has(e.id));
    api.updateScene({ elements: next, appState: { selectedElementIds: {} } });
  };

  const hasStroke = s.strokeColor !== undefined;
  const hasFill = s.backgroundColor !== undefined;
  const opacity = typeof s.opacity === "number" ? s.opacity : 100;

  return (
    <div
      data-mindmap-toolbar="true"
      onPointerDownCapture={(e) => e.stopPropagation()}
      className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[92px] z-30"
    >
      {openPop === "stroke" && (
        <div className="pointer-events-auto absolute bottom-full mb-2 left-0 flex items-center gap-1 bg-card border border-border rounded-xl shadow-lg px-2 py-1.5">
          {STROKE_SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => { patch((el) => ({ ...el, strokeColor: c })); setOpenPop(null); }}
              className="h-6 w-6 rounded-md border border-border/70 hover:scale-110 transition-transform"
              style={{ background: c }}
              title={c}
            />
          ))}
          <input
            type="color"
            defaultValue={s.strokeColor ?? "#1e1e1e"}
            onChange={(e) => patch((el) => ({ ...el, strokeColor: e.target.value }))}
            className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0"
          />
        </div>
      )}
      {openPop === "fill" && (
        <div className="pointer-events-auto absolute bottom-full mb-2 left-8 flex items-center gap-1 bg-card border border-border rounded-xl shadow-lg px-2 py-1.5">
          {FILL_SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => { patch((el) => ({ ...el, backgroundColor: c })); setOpenPop(null); }}
              className="h-6 w-6 rounded-md border border-border/70 hover:scale-110 transition-transform relative overflow-hidden"
              style={{ background: c === "transparent" ? "repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 8px 8px" : c }}
              title={c}
            />
          ))}
          <input
            type="color"
            defaultValue={s.backgroundColor && s.backgroundColor !== "transparent" ? s.backgroundColor : "#ffffff"}
            onChange={(e) => patch((el) => ({ ...el, backgroundColor: e.target.value }))}
            className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0"
          />
        </div>
      )}

      <div className="pointer-events-auto flex items-center gap-1 bg-card/95 backdrop-blur border border-border rounded-2xl shadow-xl px-2 py-1.5 text-xs">
        {hasStroke && (
          <>
            <button
              onClick={() => setOpenPop((v) => (v === "stroke" ? null : "stroke"))}
              className="h-8 px-2 rounded-lg flex items-center gap-1.5 hover:bg-muted transition-colors"
              title="Cor do traço"
            >
              <span
                className="h-4 w-4 rounded-full border border-border/70"
                style={{ background: s.strokeColor ?? "#1e1e1e" }}
              />
              <span className="text-foreground/70">Traço</span>
            </button>
            <div className="w-px h-5 bg-border/70 mx-0.5" />
          </>
        )}
        {hasFill && (
          <>
            <button
              onClick={() => setOpenPop((v) => (v === "fill" ? null : "fill"))}
              className="h-8 px-2 rounded-lg flex items-center gap-1.5 hover:bg-muted transition-colors"
              title="Preenchimento"
            >
              <span
                className="h-4 w-4 rounded-full border border-border/70"
                style={{
                  background:
                    !s.backgroundColor || s.backgroundColor === "transparent"
                      ? "repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 6px 6px"
                      : s.backgroundColor,
                }}
              />
              <span className="text-foreground/70">Fundo</span>
            </button>
            <div className="w-px h-5 bg-border/70 mx-0.5" />
          </>
        )}
        {hasStroke && (
          <>
            <div className="flex items-center gap-0.5" title="Espessura">
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  onClick={() => patch((el) => ({ ...el, strokeWidth: w }))}
                  className={
                    "h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors " +
                    (s.strokeWidth === w ? "bg-primary/15 ring-1 ring-primary/40" : "")
                  }
                >
                  <span className="rounded-full bg-foreground" style={{ width: w * 2 + 2, height: w * 2 + 2 }} />
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-border/70 mx-0.5" />
            <div className="flex items-center gap-0.5" title="Estilo do traço">
              {STROKE_STYLES.map((st) => (
                <button
                  key={st.id}
                  onClick={() => patch((el) => ({
                    ...el,
                    strokeStyle: st.id,
                    // Força regeneração do path roughjs (o cache é por seed)
                    seed: Math.floor(Math.random() * 2 ** 31),
                  }))}
                  className={
                    "h-8 px-2 rounded-lg text-[11px] hover:bg-muted transition-colors " +
                    ((s.strokeStyle ?? "solid") === st.id ? "bg-primary/15 text-primary ring-1 ring-primary/40" : "text-foreground/70")
                  }
                >
                  {st.id === "solid" ? "─" : st.id === "dashed" ? "╌" : "⋯"}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-border/70 mx-0.5" />
          </>
        )}
        <div className="flex items-center gap-1.5 px-1" title="Opacidade">
          <span className="text-foreground/60 text-[10px]">Opac</span>
          <input
            type="range"
            min={0}
            max={100}
            value={opacity}
            onChange={(e) => patch((el) => ({ ...el, opacity: Number(e.target.value) }))}
            className="w-14 h-1 accent-primary cursor-pointer"
          />
          <input
            type="number"
            min={0}
            max={100}
            value={opacity}
            onChange={(e) => {
              const raw = Number(e.target.value);
              if (Number.isNaN(raw)) return;
              const v = Math.max(0, Math.min(100, raw));
              patch((el) => ({ ...el, opacity: v }));
            }}
            className="w-11 h-6 text-[11px] text-right tabular-nums bg-muted/60 border border-border/60 rounded px-1 outline-none focus:ring-1 focus:ring-primary/40"
          />
          <span className="text-foreground/60 text-[10px]">%</span>
        </div>
        <div className="w-px h-5 bg-border/70 mx-0.5" />
        <button onClick={() => reorder("forward")} title="Trazer pra frente" className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-foreground/70">
          <ArrowUpFromLine size={14} />
        </button>
        <button onClick={() => reorder("backward")} title="Enviar pra trás" className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-foreground/70">
          <ArrowDownFromLine size={14} />
        </button>
        <div className="w-px h-5 bg-border/70 mx-0.5" />
        <button onClick={duplicate} title="Duplicar" className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-foreground/70">
          <Copy size={14} />
        </button>
        <button onClick={remove} title="Excluir" className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-destructive">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
