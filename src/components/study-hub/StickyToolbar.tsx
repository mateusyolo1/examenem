import { useEffect, useState } from "react";
import { Bold, ChevronDown, Link2, List, Strikethrough, UserCircle2 } from "lucide-react";
import {
  STICKY_COLORS,
  STICKY_FONT_FAMILIES,
  STICKY_SIZE_PRESETS,
  applyBold,
  applyStrike,
  removeBold,
  removeStrike,
} from "./sticky-utils";

export function StickyToolbar({
  apiRef,
  rect: initialRect,
}: {
  apiRef: React.MutableRefObject<any>;
  rect: any;
}) {
  const [openPop, setOpenPop] = useState<null | "color" | "font" | "size">(null);

  const api = apiRef.current;

  // Ticker rAF: re-renderiza para acompanhar pan/zoom/movimento da nota
  const [, forceTick] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      forceTick((t) => (t + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Sempre lê a versão atual do retângulo — evita snapshot vencido quando
  // a nota é movida, redimensionada, recolorida etc.
  const liveRect: any =
    (api?.getSceneElements?.() as any[])?.find((e) => e.id === initialRect.id) ?? initialRect;
  const rect = liveRect;

  const textId: string | undefined = rect?.boundElements?.find((b: any) => b.type === "text")?.id;
  const textEl: any = textId
    ? (api?.getSceneElements?.() as any[])?.find((e) => e.id === textId)
    : null;

  const flags = (rect.customData ?? {}) as {
    bold?: boolean;
    strike?: boolean;
    list?: boolean;
    showAuthor?: boolean;
    author?: string;
  };
  const bold = !!flags.bold;
  const strike = !!flags.strike;
  const list = !!flags.list;
  const showAuthor = flags.showAuthor !== false;
  const author = flags.author ?? "Você";
  const fontSize: number = textEl?.fontSize ?? 20;
  const fontFamily: number = textEl?.fontFamily ?? 1;
  const bg: string = rect.backgroundColor ?? "#fef08a";
  const link: string | null = rect.link ?? null;

  const bump = (el: any) => ({
    ...el,
    versionNonce: Math.floor(Math.random() * 2 ** 31),
    version: (el.version ?? 1) + 1,
  });

  const patchRect = (fn: (el: any) => any) => {
    if (!api) return;
    const next = (api.getSceneElements() as any[]).map((el) =>
      el.id === rect.id ? bump(fn(el)) : el,
    );
    api.updateScene({ elements: next });
  };

  const patchText = (fn: (el: any) => any) => {
    if (!api || !textId) return;
    const next = (api.getSceneElements() as any[]).map((el) =>
      el.id === textId ? bump(fn(el)) : el,
    );
    api.updateScene({ elements: next });
  };

  const setColor = (c: string) => {
    patchRect((el) => ({ ...el, backgroundColor: c }));
    setOpenPop(null);
  };
  const setFontFamily = (id: number) => {
    patchText((el) => ({ ...el, fontFamily: id }));
    setOpenPop(null);
  };
  const setFontSize = (v: number) => {
    patchText((el) => ({ ...el, fontSize: Math.max(8, Math.min(200, v)) }));
  };

  const toggleBold = () => {
    patchText((el) => {
      const nextText = bold ? removeBold(el.text) : applyBold(removeBold(el.text));
      return { ...el, text: nextText, originalText: nextText };
    });
    patchRect((el) => ({ ...el, customData: { ...(el.customData ?? {}), bold: !bold } }));
  };

  const toggleStrike = () => {
    patchText((el) => {
      const nextText = strike ? removeStrike(el.text) : applyStrike(el.text);
      return { ...el, text: nextText, originalText: nextText };
    });
    patchRect((el) => ({ ...el, customData: { ...(el.customData ?? {}), strike: !strike } }));
  };

  const toggleList = () => {
    patchText((el) => {
      const lines = String(el.text ?? "").split("\n");
      const nextLines = list
        ? lines.map((l) => l.replace(/^•\s?/, ""))
        : lines.map((l) => (l.length && !l.startsWith("• ") ? `• ${l}` : l));
      const nextText = nextLines.join("\n");
      return { ...el, text: nextText, originalText: nextText, textAlign: list ? el.textAlign : "left" };
    });
    patchRect((el) => ({ ...el, customData: { ...(el.customData ?? {}), list: !list } }));
  };

  const setLink = () => {
    const current = link ?? "";
    const value = window.prompt("URL do link (deixe vazio para remover):", current);
    if (value === null) return;
    patchRect((el) => ({ ...el, link: value.trim() || null }));
  };

  const toggleAuthor = () => {
    patchRect((el) => ({
      ...el,
      customData: { ...(el.customData ?? {}), showAuthor: !showAuthor },
    }));
  };

  const currentPreset = STICKY_SIZE_PRESETS.find((p) => p.value === fontSize);

  // Converte bbox da nota para coords de tela
  const st = api?.getAppState?.();
  const zoom = st?.zoom?.value ?? 1;
  const scrollX = st?.scrollX ?? 0;
  const scrollY = st?.scrollY ?? 0;
  const topScreenX = (rect.x + rect.width / 2 + scrollX) * zoom;
  const topScreenY = (rect.y + scrollY) * zoom - 14;
  const authorScreenX = (rect.x + scrollX) * zoom + 10;
  const authorScreenY = (rect.y + rect.height + scrollY) * zoom - 22;

  return (
    <>
      {showAuthor && (
        <div
          data-mindmap-toolbar="true"
          onPointerDownCapture={(e) => e.stopPropagation()}
          className="pointer-events-none absolute z-30 text-[11px] font-medium text-neutral-800/80 select-none"
          style={{ left: authorScreenX, top: authorScreenY }}
        >
          {author}
        </div>
      )}
      <div
        data-mindmap-toolbar="true"
        onPointerDownCapture={(e) => e.stopPropagation()}
        className="pointer-events-none absolute z-30"
        style={{ left: topScreenX, top: topScreenY, transform: "translate(-50%, -100%)" }}
      >
        {openPop === "color" && (
          <div className="pointer-events-auto absolute bottom-full mb-2 left-0 flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-xl shadow-lg px-2 py-1.5">
            {STICKY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={
                  "h-6 w-6 rounded-md border transition-transform hover:scale-110 " +
                  (bg === c ? "ring-2 ring-primary border-primary" : "border-white/20")
                }
                style={{ background: c }}
                title={c}
              />
            ))}
            <input
              type="color"
              defaultValue={bg}
              onChange={(e) => patchRect((el) => ({ ...el, backgroundColor: e.target.value }))}
              className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0"
            />
          </div>
        )}

        {openPop === "font" && (
          <div className="pointer-events-auto absolute bottom-full mb-2 left-12 flex flex-col bg-neutral-900 border border-neutral-800 rounded-xl shadow-lg py-1 min-w-[140px]">
            {STICKY_FONT_FAMILIES.map((f) => (
              <button
                key={f.id}
                onClick={() => setFontFamily(f.id)}
                className={
                  "text-left px-3 py-1.5 text-xs hover:bg-white/10 transition-colors " +
                  (fontFamily === f.id ? "text-primary font-medium" : "text-neutral-200")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {openPop === "size" && (
          <div className="pointer-events-auto absolute bottom-full mb-2 left-24 flex flex-col bg-neutral-900 border border-neutral-800 rounded-xl shadow-lg py-1 min-w-[170px]">
            {STICKY_SIZE_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setFontSize(p.value);
                  setOpenPop(null);
                }}
                className={
                  "text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-white/10 transition-colors " +
                  (currentPreset?.id === p.id ? "text-primary font-medium" : "text-neutral-200")
                }
              >
                <span className="w-3">{currentPreset?.id === p.id ? "✓" : ""}</span>
                {p.label}
              </button>
            ))}
            <div className="px-2 pt-1 pb-1.5 border-t border-white/10 mt-1">
              <input
                type="number"
                min={8}
                max={200}
                value={fontSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v)) setFontSize(v);
                }}
                className="w-full h-7 text-[11px] text-center tabular-nums bg-primary/20 text-primary border border-primary/50 rounded outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        )}

        <div className="pointer-events-auto flex items-center gap-0.5 bg-neutral-900 text-neutral-100 border border-neutral-800 rounded-full shadow-xl px-1.5 py-1 text-xs">
          <button
            onClick={() => setOpenPop((v) => (v === "color" ? null : "color"))}
            className="h-8 pl-1 pr-1.5 rounded-full flex items-center gap-1 hover:bg-white/10 transition-colors"
            title="Cor da nota"
          >
            <span className="h-5 w-5 rounded-full border border-white/30" style={{ background: bg }} />
            <ChevronDown size={11} className="opacity-70" />
          </button>

          <div className="w-px h-5 bg-white/15 mx-0.5" />

          <button
            onClick={() => setOpenPop((v) => (v === "font" ? null : "font"))}
            className="h-8 px-2.5 rounded-full flex items-center gap-1 hover:bg-white/10 transition-colors"
            title="Fonte"
          >
            <span className="text-[13px] leading-none font-medium">A0</span>
            <ChevronDown size={11} className="opacity-70" />
          </button>

          <button
            onClick={() => setOpenPop((v) => (v === "size" ? null : "size"))}
            className="h-8 px-3 rounded-full flex items-center gap-1 hover:bg-white/10 transition-colors text-[12px] font-medium min-w-[92px] justify-between"
            title="Tamanho"
          >
            <span>{currentPreset?.label ?? `${fontSize}px`}</span>
            <ChevronDown size={11} className="opacity-70" />
          </button>

          <div className="w-px h-5 bg-white/15 mx-0.5" />

          <button
            onClick={toggleBold}
            className={
              "h-8 w-8 rounded-lg flex items-center justify-center transition-colors " +
              (bold ? "bg-primary text-primary-foreground" : "text-neutral-300 hover:bg-white/10")
            }
            title="Negrito"
          >
            <Bold size={14} strokeWidth={2.5} />
          </button>

          <button
            onClick={toggleStrike}
            className={
              "h-8 w-8 rounded-lg flex items-center justify-center transition-colors " +
              (strike ? "bg-primary text-primary-foreground" : "text-neutral-300 hover:bg-white/10")
            }
            title="Tachado"
          >
            <Strikethrough size={14} strokeWidth={2.5} />
          </button>

          <button
            onClick={setLink}
            className={
              "h-8 w-8 rounded-lg flex items-center justify-center transition-colors " +
              (link ? "bg-primary text-primary-foreground" : "text-neutral-300 hover:bg-white/10")
            }
            title={link ? `Link: ${link}` : "Adicionar link"}
          >
            <Link2 size={14} />
          </button>

          <button
            onClick={toggleList}
            className={
              "h-8 w-8 rounded-lg flex items-center justify-center transition-colors " +
              (list ? "bg-primary text-primary-foreground" : "text-neutral-300 hover:bg-white/10")
            }
            title="Lista"
          >
            <List size={14} />
          </button>

          <div className="w-px h-5 bg-white/15 mx-0.5" />

          <button
            onClick={toggleAuthor}
            className={
              "h-8 w-8 rounded-lg flex items-center justify-center transition-colors " +
              (showAuthor ? "bg-primary text-primary-foreground" : "text-neutral-300 hover:bg-white/10")
            }
            title="Exibir/ocultar autor"
          >
            <UserCircle2 size={15} />
          </button>
        </div>
      </div>
    </>
  );
}
