import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X, ArrowRight } from "lucide-react";
import { getSeenHints, markHintSeen } from "@/lib/hints.functions";

export interface HintDef {
  key: string;
  targetSelector: string; // e.g. '[data-hint="dashboard.recommend"]'
  title: string;
  description: string;
}

interface HintCoachProps {
  hints: HintDef[];
}

const TUTORIAL_KEY = "tutorial:seen:v2";

function useTutorialDone(): boolean {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const check = () => {
      try {
        setDone(!!localStorage.getItem(TUTORIAL_KEY));
      } catch {
        setDone(false);
      }
    };
    check();
    const id = window.setInterval(check, 1000);
    return () => window.clearInterval(id);
  }, []);
  return done;
}

function useTargetRect(selector: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    let cancelled = false;
    let el: Element | null = null;
    let ro: ResizeObserver | null = null;

    const update = () => {
      if (!el || cancelled) return;
      setRect(el.getBoundingClientRect());
    };

    const find = () => {
      const found = document.querySelector(selector);
      if (found) {
        el = found;
        update();
        ro = new ResizeObserver(update);
        ro.observe(el);
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);
        return true;
      }
      return false;
    };

    if (!find()) {
      // Poll until it appears (max ~10s)
      let attempts = 0;
      const id = window.setInterval(() => {
        attempts++;
        if (find() || attempts > 40 || cancelled) {
          window.clearInterval(id);
        }
      }, 250);
      return () => {
        cancelled = true;
        window.clearInterval(id);
      };
    }

    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [selector]);

  return rect;
}

export function HintCoach({ hints }: HintCoachProps) {
  const tutorialDone = useTutorialDone();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const seenFn = useServerFn(getSeenHints);
  const markFn = useServerFn(markHintSeen);
  const qc = useQueryClient();

  const { data: seen } = useQuery({
    queryKey: ["hints", "seen"],
    queryFn: () => seenFn(),
    staleTime: 5 * 60_000,
    enabled: mounted && tutorialDone,
  });

  const mark = useMutation({
    mutationFn: (key: string) => markFn({ data: { key } }),
    onSuccess: (_r, key) => {
      qc.setQueryData<string[]>(["hints", "seen"], (prev) =>
        prev ? Array.from(new Set([...prev, key])) : [key],
      );
    },
  });

  // Pending queue: not-yet-seen hints, in order.
  const pending = useMemo(() => {
    if (!seen) return [];
    const set = new Set(seen);
    return hints.filter((h) => !set.has(h.key));
  }, [hints, seen]);

  const current = pending[0] ?? null;
  const rect = useTargetRect(current?.targetSelector ?? null);
  const total = pending.length;

  if (!mounted || !tutorialDone || !current) return null;

  const handleAdvance = () => {
    mark.mutate(current.key);
  };

  const handleSkipAll = () => {
    // Mark all pending as seen so they don't come back.
    pending.forEach((h) => mark.mutate(h.key));
  };

  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-[1000]"
    >
      {rect ? (
        <div
          className="hint-scan-frame absolute"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        >
          <span className="hint-scan-line" />
        </div>
      ) : null}

      <div className="pointer-events-auto absolute top-4 right-4 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-border bg-background/95 backdrop-blur shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-2 text-[10px] font-mono uppercase tracking-widest text-primary">
              Dica {hints.length - total + 1}/{hints.length}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSkipAll}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Pular todas as dicas"
          >
            <X size={16} />
          </button>
        </div>
        <h3 className="text-base font-extrabold tracking-tight text-foreground">
          {current.title}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          {current.description}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleSkipAll}
            className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            Pular tudo
          </button>
          <button
            type="button"
            onClick={handleAdvance}
            disabled={mark.isPending}
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {total > 1 ? "Próxima" : "Entendi"}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
