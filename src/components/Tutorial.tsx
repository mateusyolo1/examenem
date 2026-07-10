import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Home,
  Calendar,
  Youtube,
  ListChecks,
  RotateCw,
  FileText,
  FileCheck,
  PenLine,
  Bot,
  Trophy,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const TUTORIAL_KEY = "tutorial:seen:v1";

type Step = {
  icon: LucideIcon;
  title: string;
  description: string;
  bullets?: string[];
  cta?: { to: string; label: string };
};

const STEPS: Step[] = [
  {
    icon: Rocket,
    title: "Bem-vindo(a) ao Exame ENEM 👋",
    description:
      "Um tour rápido para você conhecer os principais recursos do app e começar a estudar hoje.",
    bullets: [
      "5 passos, menos de 1 minuto",
      "Você pode pular a qualquer momento",
      "Reabra o tutorial pelo rodapé quando quiser",
    ],
  },
  {
    icon: Home,
    title: "Dashboard — sua base de operações",
    description:
      "Veja seu progresso, streak, nível e o próximo passo recomendado assim que abrir o app.",
    bullets: [
      "Estágio atual do seu plano",
      "Tarefas de hoje em destaque",
      "Atalhos para tudo que importa",
    ],
    cta: { to: "/", label: "Ir para o Dashboard" },
  },
  {
    icon: Calendar,
    title: "Cronograma & Hub de Estudos",
    description:
      "O Cronograma organiza o que estudar hoje. O Hub de Estudos reúne vídeos, resumos, flashcards e mapas mentais gerados por IA a partir de aulas do YouTube.",
    bullets: [
      "Cronograma: agenda diária adaptativa",
      "Hub: aulas + materiais gerados",
      "Marque tarefas concluídas para ganhar XP",
    ],
    cta: { to: "/cronograma", label: "Abrir Cronograma" },
  },
  {
    icon: ListChecks,
    title: "Praticar: Questões, Simulados & Revisão",
    description:
      "Treine com questões por matéria, faça simulados temáticos ou provas reais do ENEM. Erros vão para a fila de revisão espaçada automaticamente.",
    bullets: [
      "Questões: banco filtrável por matéria/tópico",
      "Simulados & Provas Reais: cronometrados",
      "Revisar: repetição espaçada dos seus erros",
    ],
    cta: { to: "/questoes", label: "Praticar Questões" },
  },
  {
    icon: PenLine,
    title: "Redação & Tutor IA",
    description:
      "Escreva redações e receba correção nas 5 competências do ENEM. Tire dúvidas em linguagem natural com o Tutor IA.",
    bullets: [
      "Temas atualizados de redação",
      "Correção comentada por competência",
      "Tutor IA para tirar dúvidas 24/7",
    ],
    cta: { to: "/tutor", label: "Conversar com o Tutor" },
  },
  {
    icon: Trophy,
    title: "Perfil, Conquistas & Configurações",
    description:
      "Acompanhe seu nível, desbloqueie conquistas e ajuste o app do seu jeito. Tudo isso fica em Mais no menu inferior (mobile) ou na barra lateral (desktop).",
    bullets: [
      "Perfil: seu progresso completo",
      "Conquistas: metas e recompensas",
      "Configurações: preferências e tema",
    ],
    cta: { to: "/conquistas", label: "Ver Conquistas" },
  },
];

interface TutorialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Tutorial({ open, onOpenChange }: TutorialProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const finish = () => {
    try {
      localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {
      /* ignore */
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : finish())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon size={20} />
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Passo {step + 1} de {STEPS.length}
              </div>
              <DialogTitle className="text-left">{current.title}</DialogTitle>
            </div>
          </div>
          <DialogDescription className="pt-2 text-left text-base">
            {current.description}
          </DialogDescription>
        </DialogHeader>

        {current.bullets && (
          <ul className="space-y-2 pt-1">
            {current.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm">
                <Check size={16} className="mt-0.5 shrink-0 text-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {current.cta && (
          <div className="pt-1">
            <Link
              to={current.cta.to}
              onClick={finish}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {current.cta.label}
              <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30")
              }
              aria-hidden
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={finish}>
            Pular tutorial
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
                Começar a estudar
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Próximo
                <ArrowRight size={14} />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TutorialTrigger() {
  const [open, setOpen] = useState(false);

  // Auto-open once
  useEffect(() => {
    try {
      if (!localStorage.getItem(TUTORIAL_KEY)) {
        const t = setTimeout(() => setOpen(true), 600);
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
