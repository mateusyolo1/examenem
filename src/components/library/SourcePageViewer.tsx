import { useEffect, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { signLibraryPageUrl } from "@/lib/library.functions";
import { Maximize2, ZoomIn, ZoomOut, RotateCcw, ExternalLink, Loader2 } from "lucide-react";

export type SourceRect = { x: number; y: number; w: number; h: number };
export type SourceBBox = {
  page: number;
  /** Dimensões do viewport@scale=1 usadas na hora do bbox (para normalizar em %). */
  pageW: number;
  pageH: number;
  rects: SourceRect[];
};

interface SourcePageViewerProps {
  /** Legado: URL já assinada. Se ausente, usa `bookId` para buscar sob demanda. */
  url?: string;
  bookId?: string;
  bookTitle: string;
  page: number;
  /** Trecho da citação (aparece no rodapé). */
  excerpt?: string | null;
  /** Rects para highlight amarelo (Fase B). Ausência = só imagem, sem highlight. */
  bbox?: SourceBBox | null;
  /** Thumb clicável. Se ausente, renderiza a imagem/caixa padrão. */
  children?: React.ReactNode;
}

/**
 * Abre a página real do livro em modal com pan/zoom.
 * - Fase A: `url` direto (figura já assinada).
 * - Fase B: `bookId+page` → busca URL fresca via server fn ao abrir + renderiza
 *   rects amarelos sobre o trecho citado (proporcional em %).
 */
export function SourcePageViewer({
  url,
  bookId,
  bookTitle,
  page,
  excerpt,
  bbox,
  children,
}: SourcePageViewerProps) {
  const [open, setOpen] = useState(false);
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(url ?? null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const signFn = useServerFn(signLibraryPageUrl);

  // Sempre busca fresca ao abrir quando temos bookId (evita cache expirado).
  useEffect(() => {
    if (!open) return;
    if (url && !bookId) {
      setFetchedUrl(url);
      return;
    }
    if (!bookId) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    signFn({ data: { bookId, page } })
      .then((r) => {
        if (!cancelled) setFetchedUrl(r.url);
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, bookId, page, url, signFn]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group block w-full text-left"
        aria-label={`Ver página ${page} de ${bookTitle}`}
      >
        {children ?? (
          <figure className="border border-border rounded-lg overflow-hidden bg-background transition group-hover:border-primary/50">
            <div className="relative">
              {url ? (
                <img
                  src={url}
                  alt={`Página ${page} de ${bookTitle}`}
                  loading="lazy"
                  className="w-full max-h-80 object-contain bg-muted"
                />
              ) : (
                <div className="w-full h-40 grid place-items-center bg-muted text-xs text-muted-foreground">
                  Clique para abrir a página
                </div>
              )}
              <div className="absolute top-2 right-2 grid place-items-center rounded-md bg-background/90 border border-border p-1.5 opacity-0 group-hover:opacity-100 transition">
                <Maximize2 size={14} />
              </div>
            </div>
            <figcaption className="px-3 py-1.5 text-[11px] font-mono text-muted-foreground border-t border-border flex items-center justify-between gap-2">
              <span className="truncate">
                {bookTitle} · p. {page}
              </span>
              <span className="shrink-0 flex items-center gap-1 text-primary/80">
                <ExternalLink size={11} /> ver na página
              </span>
            </figcaption>
          </figure>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
          <DialogTitle className="sr-only">
            {bookTitle} — página {page}
          </DialogTitle>
          <header className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Fonte
              </div>
              <div className="text-sm font-semibold truncate">
                {bookTitle} · página {page}
              </div>
            </div>
          </header>

          <div className="flex-1 min-h-0 bg-muted/40 relative">
            {loading && (
              <div className="absolute inset-0 grid place-items-center z-10 text-xs text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {err && !loading && (
              <div className="absolute inset-0 grid place-items-center z-10 p-6 text-center text-sm text-destructive">
                {err}
              </div>
            )}
            {fetchedUrl && !err && (
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={6}
                centerOnInit
                wheel={{ step: 0.15 }}
                doubleClick={{ mode: "zoomIn", step: 0.8 }}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-md border border-border bg-background/95 shadow-sm p-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => zoomOut()}
                        aria-label="Diminuir zoom"
                      >
                        <ZoomOut size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => zoomIn()}
                        aria-label="Aumentar zoom"
                      >
                        <ZoomIn size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => resetTransform()}
                        aria-label="Redefinir zoom"
                      >
                        <RotateCcw size={14} />
                      </Button>
                    </div>
                    <TransformComponent
                      wrapperClass="!w-full !h-full"
                      contentClass="!w-full !h-full grid place-items-center"
                    >
                      <div className="relative inline-block">
                        <img
                          src={fetchedUrl}
                          alt={`Página ${page} de ${bookTitle}`}
                          className="max-w-full max-h-[80vh] object-contain select-none block"
                          draggable={false}
                        />
                        {bbox && bbox.pageW > 0 && bbox.pageH > 0 && (
                          <div className="absolute inset-0 pointer-events-none">
                            {bbox.rects.map((r, i) => (
                              <span
                                key={i}
                                className="absolute bg-yellow-300/45 ring-1 ring-yellow-500/70 rounded-sm mix-blend-multiply"
                                style={{
                                  left: `${(r.x / bbox.pageW) * 100}%`,
                                  top: `${(r.y / bbox.pageH) * 100}%`,
                                  width: `${(r.w / bbox.pageW) * 100}%`,
                                  height: `${(r.h / bbox.pageH) * 100}%`,
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
            )}
          </div>

          {excerpt && (
            <footer className="px-4 py-3 border-t border-border bg-card shrink-0 max-h-32 overflow-auto">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                Trecho citado
              </div>
              <p className="text-xs leading-relaxed text-foreground/90 italic">
                “{excerpt}”
              </p>
            </footer>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
