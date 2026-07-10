import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  X,
  Rocket,
  Home,
  Calendar,
  Youtube,
  ListChecks,
  RotateCw,
  FileText,
  PenLine,
  Bot,
  Trophy,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const TUTORIAL_KEY = "tutorial:seen:v2";

type StepTarget = string | { desktop?: string; mobile?: string };

type Step = {
  icon: LucideIcon;
  title: string;
  description: string;
  bullets?: string[];
  route?: string;
  target?: StepTarget;
  padding?: number;
};

const STEPS: Step[] = [
  {
    icon: Rocket,
    title: "Bem-vindo(a) ao Exame ENEM 👋",
    description:
      "Vou destacar cada parte importante do app para você. É rápido — menos de 1 minuto.",
    bullets: [
      "Vamos passear pelo menu e pelas telas principais",
      "Você pode pular a qualquer momento",
      "Reabra o tutorial pelo rodapé quando quiser",
    ],
  },
  {
    icon: Home,
    route: "/",
    target: { desktop: '[data-tour="nav-dashboard"]', mobile: '[data-tour="nav-dashboard"]' },
    title: "Dashboard",
    description:
      "Sua base de operações. Aqui aparecem seu progresso, próximo passo recomendado e as tarefas do dia.",
  },
  {
    icon: Calendar,
    route: "/",
    target: { desktop: '[data-tour="nav-cronograma"]' },
    title: "Cronograma",
    description:
      "Sua agenda diária de estudos, adaptada automaticamente ao seu plano. Abra todos os dias para saber o que fazer.",
  },
  {
    icon: Youtube,
    target: { desktop: '[data-tour="nav-estudos"]' },
    title: "Hub de Estudos",
    description:
      "Aulas do YouTube com resumos, flashcards e mapas mentais gerados por IA em cima do conteúdo.",
  },
  {
    icon: ListChecks,
    target: { desktop: '[data-tour="nav-questoes"]', mobile: '[data-tour="nav-questoes"]' },
    title: "Questões",
    description:
      "Banco de questões filtrável por matéria e tópico. Cada erro entra automaticamente na fila de revisão espaçada.",
  },
  {
    icon: FileText,
    target: { desktop: '[data-tour="nav-simulados"]', mobile: '[data-tour="nav-simulados"]' },
    title: "Simulados & Provas Reais",
    description:
      "Simulados temáticos cronometrados e as provas reais do ENEM, com correção e análise por área.",
  },
  {
    icon: RotateCw,
    target: { desktop: '[data-tour="nav-revisar"]' },
    title: "Revisar Erros",
    description:
      "Repetição espaçada dos seus erros. O algoritmo decide o que você precisa rever hoje.",
  },
  {
    icon: PenLine,
    target: { desktop: '[data-tour="nav-redacao"]' },
    title: "Redação",
    description:
      "Escreva redações e receba correção comentada nas 5 competências do ENEM.",
  },
  {
    icon: Bot,
    target: { desktop: '[data-tour="nav-tutor"]' },
    title: "Tutor IA",
    description:
      "Tire dúvidas 24/7 em linguagem natural. O Tutor conhece seu progresso e o conteúdo do ENEM.",
  },
  {
    icon: Trophy,
    target: {
      desktop: '[data-tour="nav-secondary"]',
      mobile: '[data-tour="nav-more-mobile"]',
    },
    title: "Perfil, Conquistas & Configurações",
    description:
      "Seu perfil, medalhas desbloqueadas e ajustes do app. No mobile ficam dentro do botão \"Mais\" no rodapé.",
  },
  {
    icon: Wand2,
    route: "/plano",
    target: '[data-tour="plano-gerar"]',
    title: "Gere seu plano de estudos",
    description:
      "Este é o botão mais importante do início: ele cria um cronograma personalizado com base no seu tempo, foco e meta.",
    bullets: [
      "Escolha o foco (áreas prioritárias)",
      "Defina horas por dia e data da prova",
      "Toque em Gerar plano — o Cronograma é liberado",
    ],
  },
  {
    icon: Sparkles,
    title: "Tudo pronto!",
    description:
      "Você já conhece os principais recursos. Bons estudos — e lembre: o segredo é constância, não pressa. 🚀",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

function resolveSelector(target: StepTarget | undefined, isMobile: boolean): string | null {
  if (!target) return null;
  if (typeof target === "string") return target;
  return (isMobile ? target.mobile : target.desktop) ?? target.desktop ?? target.mobile ?? null;
}

async function waitForElement(selector: string, timeoutMs = 2500): Promise<HTMLElement | null> {
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) return resolve(el);
      if (Date.now() - start > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

interface TutorialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Tutorial({ open, onOpenChange }: TutorialProps) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isMobile = useIsMobile();
  const cancelRef = useRef(0);

  useEffect(() => {
    if (open) {
      setStep(0);
    }
  }, [open]);

  const current = STEPS[step];

  // Resolve target for current step (navigate + wait for element)
  useEffect(() => {
    if (!open) return;
    const token = ++cancelRef.current;
    setReady(false);
    // Keep previous rect visible while we resolve the next target — avoids
    // a flash where the tooltip centers before jumping to the new element.

    let cancelled = false;
    const run = async () => {
      if (current.route && pathname !== current.route) {
        await navigate({ to: current.route });
      }
      const selector = resolveSelector(current.target, isMobile);
      if (!selector) {
        if (token === cancelRef.current && !cancelled) {
          setRect(null);
          setReady(true);
        }
        return;
      }
      const el = await waitForElement(selector);
      if (cancelled || token !== cancelRef.current) return;
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        // small delay to let scroll settle
        await new Promise((r) => setTimeout(r, 280));
        if (cancelled || token !== cancelRef.current) return;
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setRect(null);
      }
      setReady(true);
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, open, isMobile]);

  // Track element geometry on resize/scroll
  useLayoutEffect(() => {
    if (!open) return;
    const selector = resolveSelector(current.target, isMobile);
    if (!selector) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(selector);
        if (!el) return;
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      });
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step, open, isMobile, current.target]);

  if (!open) return null;

  const finish = () => {
    try {
      localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {
      /* ignore */
    }
    onOpenChange(false);
  };

  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const Icon = current.icon;
  const pad = current.padding ?? 8;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;

  const highlight = rect
    ? {
        top: Math.max(4, rect.top - pad),
        left: Math.max(4, rect.left - pad),
        width: Math.min(vw - 8, rect.width + pad * 2),
        height: Math.min(vh - 8, rect.height + pad * 2),
      }
    : null;

  // Tooltip position: pick best side (right → left → below → above → center)
  const TOOLTIP_W = Math.min(400, vw - 24);
  const TOOLTIP_H_EST = 260;
  const GAP = 14;
  let tooltip: { top: number; left: number } = {
    top: vh / 2 - TOOLTIP_H_EST / 2,
    left: vw / 2 - TOOLTIP_W / 2,
  };
  if (highlight) {
    const spaceRight = vw - (highlight.left + highlight.width);
    const spaceLeft = highlight.left;
    const spaceBelow = vh - (highlight.top + highlight.height);
    const spaceAbove = highlight.top;

    if (spaceRight >= TOOLTIP_W + GAP + 8) {
      tooltip = {
        top: Math.min(vh - TOOLTIP_H_EST - 12, Math.max(12, highlight.top)),
        left: highlight.left + highlight.width + GAP,
      };
    } else if (spaceLeft >= TOOLTIP_W + GAP + 8) {
      tooltip = {
        top: Math.min(vh - TOOLTIP_H_EST - 12, Math.max(12, highlight.top)),
        left: highlight.left - TOOLTIP_W - GAP,
      };
    } else if (spaceBelow >= TOOLTIP_H_EST + GAP + 8) {
      tooltip = {
        top: highlight.top + highlight.height + GAP,
        left: Math.min(vw - TOOLTIP_W - 12, Math.max(12, highlight.left)),
      };
    } else if (spaceAbove >= TOOLTIP_H_EST + GAP + 8) {
      tooltip = {
        top: highlight.top - TOOLTIP_H_EST - GAP,
        left: Math.min(vw - TOOLTIP_W - 12, Math.max(12, highlight.left)),
      };
    } else {
      // fallback: center
      tooltip = {
        top: vh / 2 - TOOLTIP_H_EST / 2,
        left: vw / 2 - TOOLTIP_W / 2,
      };
    }
  }

  const overlay = (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label={current.title}
    >
      {/* Dark overlay with SVG mask cutout */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        aria-hidden
        onClick={(e) => e.stopPropagation()}
      >
        <defs>
          <mask id="tutorial-mask">
            <rect width="100%" height="100%" fill="white" />
            {highlight && ready && (
              <rect
                x={highlight.left}
                y={highlight.top}
                width={highlight.width}
                height={highlight.height}
                rx={10}
                ry={10}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.72)"
          mask="url(#tutorial-mask)"
        />
      </svg>

      {/* Highlight ring */}
      {highlight && ready && (
        <div
          className="absolute pointer-events-none rounded-[10px] ring-2 ring-primary shadow-[0_0_0_4px_rgba(59,130,246,0.25)] animate-pulse"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      )}

      {/* Tooltip card — only after target is resolved to avoid center-flash */}
      <div
        className="absolute bg-card border border-border rounded-xl shadow-2xl p-5 pointer-events-auto transition-opacity duration-150"
        style={{
          top: Math.max(12, tooltip.top),
          left: Math.max(12, tooltip.left),
          width: TOOLTIP_W,
          opacity: ready ? 1 : 0,
          visibility: ready ? "visible" : "hidden",
        }}
      >
        <button
          type="button"
          onClick={finish}
          aria-label="Fechar tutorial"
          className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 pr-8">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Passo {step + 1} de {STEPS.length}
            </div>
            <h2 className="text-base font-bold tracking-tight truncate">
              {current.title}
            </h2>
          </div>
        </div>

        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          {current.description}
        </p>

        {current.bullets && (
          <ul className="mt-3 space-y-1.5">
            {current.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-xs">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1 pt-4">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === step ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30")
              }
              aria-hidden
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-3">
          <Button variant="ghost" size="sm" onClick={finish}>
            Pular
          </Button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                <ArrowLeft size={14} />
                Anterior
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={finish}>
                <Sparkles size={14} />
                Começar
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Próximo
                <ArrowRight size={14} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}

export function TutorialTrigger() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(TUTORIAL_KEY)) {
        const t = setTimeout(() => setOpen(true), 800);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
      >
        <Sparkles className="h-3 w-3" />
        Tutorial
      </button>
      <Tutorial open={open} onOpenChange={setOpen} />
    </>
  );
}
