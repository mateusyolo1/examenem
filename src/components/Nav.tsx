import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useProgress, type Area } from "@/lib/storage";
import { useActiveClassroomTask } from "@/lib/study-plan";
import { computeXP, levelFor } from "@/lib/gamification";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StageIndicator } from "@/components/StageIndicator";
import { UserMenu } from "@/components/UserMenu";
import {
  Home,
  ListChecks,
  RotateCw,
  FileText,
  FileCheck,
  PenLine,
  Bot,
  User,
  Menu,
  X,
  Calendar,
  BookOpen,
  Youtube,
  Lightbulb,
  Trophy,
  CalendarDays,
  Settings as SettingsIcon,
  MoreHorizontal,
  GraduationCap,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ size?: number }>;
  search?: Record<string, unknown>;
  params?: Record<string, string>;
  badge?: string;
};

type NavSection = {
  key: string;
  label: string;
  items: NavItem[];
};

// FOCO ATIVO — o que o aluno tem que fazer hoje.
const FOCO_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", shortLabel: "Início", icon: Home },
  { to: "/cronograma", label: "Cronograma", shortLabel: "Hoje", icon: Calendar },
];

// BIBLIOTECA — onde o aluno consulta e organiza conteúdo.
const BIBLIOTECA_ITEMS: NavItem[] = [
  { to: "/estudos", label: "Hub de Estudos", shortLabel: "Estudar", icon: Youtube },
  { to: "/materias", label: "Matérias", icon: BookOpen },
  { to: "/temas", label: "Temas", icon: Lightbulb },
];

// TREINO — o que exige performance.
const TREINO_ITEMS: NavItem[] = [
  { to: "/questoes", label: "Questões", icon: ListChecks },
  { to: "/revisar", label: "Revisar Erros", shortLabel: "Revisar", icon: RotateCw },
  { to: "/simulados", label: "Simulados", icon: FileText },
  { to: "/simulados-reais", label: "Provas Reais ENEM", shortLabel: "Reais", icon: FileCheck },
  { to: "/redacao", label: "Redação", icon: PenLine },
];

// SUPORTE — apoio e configurações.
const SUPORTE_ITEMS: NavItem[] = [
  { to: "/tutor", label: "Tutor IA", icon: Bot },
  { to: "/plano", label: "Agenda", icon: CalendarDays },
  { to: "/conquistas", label: "Conquistas", icon: Trophy },
  { to: "/perfil", label: "Perfil", icon: User },
  { to: "/configuracoes", label: "Configurações", icon: SettingsIcon },
];

const MOBILE_PRIMARY: NavItem[] = [
  { to: "/", label: "Dashboard", shortLabel: "Início", icon: Home },
  { to: "/cronograma", label: "Hoje", icon: Calendar },
  { to: "/estudos", label: "Estudos", icon: Youtube },
  { to: "/questoes", label: "Questões", icon: ListChecks },
  { to: "/simulados", label: "Simulados", icon: FileText },
];

function useNavSections(activeTask: ReturnType<typeof useActiveClassroomTask>): NavSection[] {
  // Injeta "Sala de Aula" em FOCO ATIVO se há tarefa de aula pendente hoje.
  const foco: NavItem[] = [...FOCO_ITEMS];
  if (activeTask?.topicSlug) {
    foco.push({
      to: "/aula/$topicId",
      label: "Sala de Aula",
      shortLabel: "Aula",
      icon: GraduationCap,
      params: { topicId: activeTask.topicSlug },
      search: { taskId: activeTask.id, maxMinutes: activeTask.minutes },
      badge: "Agora",
    });
  }
  return [
    { key: "foco", label: "Foco ativo", items: foco },
    { key: "biblioteca", label: "Biblioteca", items: BIBLIOTECA_ITEMS },
    { key: "treino", label: "Treino", items: TREINO_ITEMS },
    { key: "suporte", label: "Suporte", items: SUPORTE_ITEMS },
  ];
}

export function Nav() {
  const { progress } = useProgress();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const xp = computeXP(progress);
  const lvl = levelFor(xp.total);
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeTask = useActiveClassroomTask();
  const sections = useNavSections(activeTask);
  const allItems = sections.flatMap((s) => s.items);

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  // "Mais" (mobile) fica ativo quando estamos em qualquer rota fora do primário mobile.
  const mobilePrimarySet = new Set(MOBILE_PRIMARY.map((m) => m.to));
  const moreActive = allItems.some((m) => !mobilePrimarySet.has(m.to) && isActive(m.to));

  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.add("has-sidebar");
    return () => document.body.classList.remove("has-sidebar");
  }, []);

  const renderLink = (l: NavItem, opts?: { compact?: boolean; onClick?: () => void }) => {
    const active = isActive(l.to);
    const Icon = l.icon;
    const tourId = l.to === "/" ? "nav-dashboard" : `nav${l.to.replace(/\//g, "-")}`;
    // TanStack Link precisa de `params`/`search` tipados por rota. Usamos
    // `as never` para acomodar ambos os casos (com/sem params) sem alargar
    // o tipo do NavItem.
    return (
      <Link
        key={l.to + (l.badge ?? "")}
        to={l.to as never}
        params={(l.params as never) ?? (undefined as never)}
        search={(l.search as never) ?? (undefined as never)}
        onClick={opts?.onClick}
        aria-current={active ? "page" : undefined}
        data-tour={tourId}
        className={
          "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors min-h-10 " +
          (active
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50")
        }
      >
        <Icon size={opts?.compact ? 16 : 18} />
        <span className="truncate flex-1">{l.label}</span>
        {l.badge && (
          <span className="shrink-0 text-[9px] font-mono uppercase tracking-widest bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
            {l.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-background focus:text-foreground focus:px-3 focus:py-2 focus:border focus:border-foreground focus:rounded-md"
      >
        Pular para o conteúdo
      </a>

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/" className="font-extrabold text-xl tracking-tighter uppercase">
            Exame.
          </Link>
          <div className="flex items-center gap-1.5">
            <div
              className="hidden sm:inline-flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1.5 rounded-full"
              title={`Streak de ${progress.streakDays} dia(s)`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
              <span className="text-xs font-bold uppercase tracking-wider font-mono tabular-nums">
                {progress.streakDays}d
              </span>
            </div>
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="Abrir menu"
              className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-border hover:bg-accent"
            >
              <Menu size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside
        aria-label="Navegação principal"
        className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bg-card border-r border-border"
      >
        <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-2">
          <Link to="/" className="font-extrabold text-2xl tracking-tighter uppercase">
            Exame.
          </Link>
          <ThemeToggle />
        </div>

        <div className="px-4 pb-4 flex items-center gap-2">
          <Link
            to="/conquistas"
            className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 rounded-md hover:border-foreground/30 hover:bg-accent transition-colors"
            title={`${xp.total.toLocaleString("pt-BR")} XP — ${lvl.title}`}
          >
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Nv
            </span>
            <span className="text-xs font-bold tracking-tight">{lvl.level}</span>
          </Link>
          <div
            className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1.5 rounded-full"
            title={`Streak de ${progress.streakDays} dia(s)`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
            <span className="text-xs font-bold uppercase tracking-wider font-mono tabular-nums">
              {progress.streakDays}d
            </span>
          </div>
        </div>

        <div className="px-4 pb-3">
          <StageIndicator />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
          {sections.map((sec) => (
            <div key={sec.key} data-tour={`nav-${sec.key}`}>
              <div className="px-3 pb-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {sec.label}
              </div>
              <div className="space-y-0.5">{sec.items.map((l) => renderLink(l))}</div>
            </div>
          ))}
        </nav>

        <div className="px-3 pt-2 pb-4 border-t border-border">
          <UserMenu />
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Navegação rápida"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-6 max-w-2xl mx-auto">
          {MOBILE_PRIMARY.map((l) => {
            const active = isActive(l.to);
            const Icon = l.icon;
            return (
              <li key={l.to}>
                <Link
                  to={l.to}
                  aria-current={active ? "page" : undefined}
                  className={
                    "flex flex-col items-center justify-center gap-0.5 min-h-14 py-2 text-[10px] font-medium tracking-wide transition-colors " +
                    (active ? "text-primary" : "text-muted-foreground hover:text-foreground")
                  }
                >
                  <Icon size={20} />
                  <span>{l.shortLabel ?? l.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="Mais opções"
              data-tour="nav-more-mobile"
              className={
                "w-full flex flex-col items-center justify-center gap-0.5 min-h-14 py-2 text-[10px] font-medium transition-colors " +
                (moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground")
              }
            >
              <MoreHorizontal size={20} />
              <span>Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Slide-up sheet (mobile only) */}
      {sheetOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
        >
          <div
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute bottom-0 inset-x-0 bg-card border-t border-border rounded-t-2xl shadow-2xl pb-[env(safe-area-inset-bottom)] animate-reveal">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Navegação
              </span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Fechar menu"
                className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-border hover:bg-accent"
              >
                <X size={16} />
              </button>
            </div>
            <ul className="px-2 pb-4 max-h-[70vh] overflow-y-auto">
              {ALL.map((l) => {
                const active = isActive(l.to);
                const Icon = l.icon;
                return (
                  <li key={l.to}>
                    <Link
                      to={l.to}
                      onClick={() => setSheetOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={
                        "flex items-center gap-3 px-3 py-3 min-h-11 rounded-md text-sm font-medium transition-colors " +
                        (active ? "bg-accent text-foreground" : "text-foreground hover:bg-accent")
                      }
                    >
                      <Icon size={18} />
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="px-3 pb-3 border-t border-border pt-3">
              <UserMenu />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
