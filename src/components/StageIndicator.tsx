import { useEffect, useRef, useState } from "react";
import {
  nextStepHint,
  stageById,
  studentStatus,
  useActiveLearning,
} from "@/lib/learning-progress";
import { GraduationCap } from "lucide-react";

/**
 * Indicador compacto "Etapa: X/7" na top bar.
 * Ao clicar, abre um popover com: assunto, etapa atual, próxima etapa e o que falta.
 */
export function StageIndicator() {
  const active = useActiveLearning();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const etapa = active ? active.etapaAtual : 0;
  const stage = active ? stageById(active.etapaAtual) : null;
  const proxima =
    active && active.etapaAtual < 7
      ? stageById((active.etapaAtual + 1) as 2 | 3 | 4 | 5 | 6 | 7)
      : null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={active ? `Etapa ${etapa}/7 — ${stage?.label}` : "Nenhum assunto ativo"}
        className="hidden sm:inline-flex items-center gap-1.5 border border-border px-2.5 py-1.5 rounded-md hover:border-foreground/30 hover:bg-accent transition-colors"
      >
        <GraduationCap size={12} className="text-primary" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Etapa
        </span>
        <span className="text-xs font-bold tabular-nums">{etapa}/7</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Resumo da etapa atual"
          className="absolute left-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50"
        >
          {!active ? (
            <div className="p-4 text-sm text-muted-foreground">
              Nenhum assunto ativo. Abra o{" "}
              <a href="/tutor" className="text-primary underline underline-offset-2">
                Tutor IA
              </a>{" "}
              e escolha um assunto para começar.
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Assunto atual
                </div>
                <div className="text-sm font-bold leading-tight">{active.assunto}</div>
                <div className="text-[11px] text-muted-foreground">{active.materia}</div>
              </div>
              <div className="border-t border-border pt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Etapa atual
                  </div>
                  <div className="text-sm font-bold">{stage?.label}</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {etapa}/7 · {active.progressoPercentual}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Próxima etapa
                  </div>
                  <div className="text-sm font-bold">{proxima ? proxima.label : "—"}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {proxima ? "Em sequência" : "Dominado"}
                  </div>
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                  O que falta
                </div>
                <p className="text-xs leading-relaxed">{nextStepHint(active)}</p>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span
                  className={
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider " +
                    (active.prontoParaAvancar
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {studentStatus(active)}
                </span>
                <a
                  href="/tutor"
                  className="text-[11px] font-bold text-primary hover:underline"
                  onClick={() => setOpen(false)}
                >
                  Abrir tutor →
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StageIndicator;
