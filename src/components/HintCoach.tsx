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

function useTargetTracker(
  selector: string | null,
  frameRef: React.RefObject<HTMLDivElement | null>,
) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!selector) return;

    let cancelled = false;
    let el: Element | null = null;
    let ro: ResizeObserver | null = null;
    let rafId = 0;
    let pending = false;

    const apply = () => {
      pending = false;
      if (!el || cancelled) return;
      const frame = frameRef.current;
      if (!frame) return;
      const r = el.getBoundingClientRect();
      // Use transform + width/height for GPU-accelerated positioning.
      frame.style.transform = `translate3d(${r.left - 6}px, ${r.top - 6}px, 0)`;
      frame.style.width = `${r.width + 12}px`;
      frame.style.height = `${r.height + 12}px`;
      if (!ready) setReady(true);
    };

    const schedule = () => {
      if (pending) return;
      pending = true;
      rafId = requestAnimationFrame(apply);
    };

    const find = () => {
      const found = document.querySelector(selector);
      if (found) {
        el = found;
        apply();
        ro = new ResizeObserver(schedule);
        ro.observe(el);
        window.addEventListener("scroll", schedule, { passive: true, capture: true });
        window.addEventListener("resize", schedule, { passive: true });
        return true;
      }
      return false;
    };

    let pollId = 0;
    if (!find()) {
      let attempts = 0;
      pollId = window.setInterval(() => {
        attempts++;
        if (find() || attempts > 40 || cancelled) {
          window.clearInterval(pollId);
        }
      }, 250);
    }

    return () => {
      cancelled = true;
      if (pollId) window.clearInterval(pollId);
      if (rafId) cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selector]);

  return ready;
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
  const frameRef = useRef<HTMLDivElement | null>(null);
  const frameReady = useTargetTracker(current?.targetSelector ?? null, frameRef);
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
      <div
        ref={frameRef}
        className="hint-scan-frame fixed top-0 left-0 will-change-transform"
        style={{ opacity: frameReady ? 1 : 0 }}
      >
        <span className="hint-scan-line" />
      </div>


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
