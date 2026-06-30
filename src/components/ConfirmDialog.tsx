import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive,
  confirmDisabled,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby={description ? "confirm-desc" : undefined}
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative w-full sm:max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 animate-reveal">
        <div className="flex items-start gap-3">
          {destructive && (
            <div
              className="h-10 w-10 shrink-0 rounded-full bg-destructive/10 text-destructive flex items-center justify-center"
              aria-hidden
            >
              <AlertTriangle size={18} />
            </div>
          )}
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base font-bold text-foreground">
              {title}
            </h2>
            {description && (
              typeof description === "string" ? (
                <p id="confirm-desc" className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              ) : (
                <div id="confirm-desc" className="mt-1 text-sm text-muted-foreground">
                  {description}
                </div>
              )
            )}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center min-h-11 px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-accent"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={
              "inline-flex items-center justify-center min-h-11 px-4 rounded-md text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed " +
              (destructive
                ? "bg-destructive text-destructive-foreground hover:opacity-90"
                : "bg-primary text-primary-foreground hover:opacity-90")
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
