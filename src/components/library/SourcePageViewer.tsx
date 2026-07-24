import { useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Maximize2, ZoomIn, ZoomOut, RotateCcw, ExternalLink } from "lucide-react";

interface SourcePageViewerProps {
  url: string;
  bookTitle: string;
  page: number;
  /** Trecho da citação (Fase B: será destacado; hoje aparece como legenda). */
  excerpt?: string | null;
  /** Thumb clicável. Se ausente, renderiza a imagem completa (uso legado). */
  children?: React.ReactNode;
}

/**
 * Abre a página real do livro em modal com pan/zoom.
 * Fase A: imagem inteira da página (já é o formato armazenado em library_figures).
 * Fase B (planejada): highlight do bbox do trecho citado.
 */
export function SourcePageViewer({
  url,
  bookTitle,
  page,
  excerpt,
  children,
}: SourcePageViewerProps) {
  const [open, setOpen] = useState(false);

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
              <img
                src={url}
                alt={`Página ${page} de ${bookTitle}`}
                loading="lazy"
                className="w-full max-h-80 object-contain bg-muted"
              />
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
                    <img
                      src={url}
                      alt={`Página ${page} de ${bookTitle}`}
                      className="max-w-full max-h-full object-contain select-none"
                      draggable={false}
                    />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
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
