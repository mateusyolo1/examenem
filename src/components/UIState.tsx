import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center text-center py-12 px-6 border border-dashed border-border rounded-lg bg-card/40"
    >
      <div className="h-12 w-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mb-4">
        {icon ?? <Inbox size={20} aria-hidden />}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground"
    >
      <span
        className="h-4 w-4 rounded-full border-2 border-border border-t-primary animate-spin"
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={"animate-pulse rounded-md bg-muted " + className}
    />
  );
}

export function ErrorState({
  title = "Algo deu errado",
  description = "Não conseguimos completar essa ação. Tente novamente.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center text-center py-10 px-6 border border-destructive/30 bg-destructive/5 rounded-lg"
    >
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center justify-center min-h-11 px-4 rounded-md bg-foreground text-background text-sm font-semibold hover:opacity-90"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
