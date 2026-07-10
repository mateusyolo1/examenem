import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useProgress } from "@/lib/storage";
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
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ size?: number }>;
};

const PRIMARY: NavItem[] = [
  { to: "/", label: "Dashboard", shortLabel: "Início", icon: Home },
  { to: "/cronograma", label: "Cronograma", shortLabel: "Hoje", icon: Calendar },
  { to: "/estudos", label: "Hub de Estudos", shortLabel: "Estudar", icon: Youtube },
  { to: "/questoes", label: "Questões", icon: ListChecks },
  { to: "/revisar", label: "Revisar Erros", shortLabel: "Revisar", icon: RotateCw },
  { to: "/simulados", label: "Simulados", icon: FileText },
  { to: "/simulados-reais", label: "Provas Reais ENEM", shortLabel: "Reais", icon: FileCheck },
  { to: "/redacao", label: "Redação", icon: PenLine },
  { to: "/tutor", label: "Tutor IA", icon: Bot },
];

const SECONDARY: NavItem[] = [
  { to: "/plano", label: "Agenda", icon: CalendarDays },
  { to: "/materias", label: "Matérias", icon: BookOpen },
  { to: "/temas", label: "Temas", icon: Lightbulb },
  { to: "/conquistas", label: "Conquistas", icon: Trophy },
  { to: "/perfil", label: "Perfil", icon: User },
  { to: "/configuracoes", label: "Configurações", icon: SettingsIcon },
];

const MOBILE_PRIMARY: NavItem[] = [
  { to: "/", label: "Dashboard", shortLabel: "Início", icon: Home },
  { to: "/estudos", label: "Estudos", icon: Youtube },
  { to: "/questoes", label: "Questões", icon: ListChecks },
  { to: "/simulados", label: "Simulados", icon: FileText },
  { to: "/simulados-reais", label: "Reais", icon: FileCheck },
];

const ALL: NavItem[] = [...PRIMARY, ...SECONDARY];

export function Nav() {
  const { progress } = useProgress();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const xp = computeXP(progress);
  const lvl = levelFor(xp.total);
  const [sheetOpen, setSheetOpen] = useState(false);

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  const moreActive = SECONDARY.some((m) => isActive(m.to));

  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  const renderLink = (l: NavItem, opts?: { compact?: boolean }) => {
    const active = isActive(l.to);
    const Icon = l.icon;
    const tourId = l.to === "/" ? "nav-dashboard" : `nav${l.to.replace(/\//g, "-")}`;
    return (
      <Link
        key={l.to}
        to={l.to}
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
        <span className="truncate">{l.label}</span>
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
          <div>
            <div className="px-3 pb-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Estudo
            </div>
            <div className="space-y-0.5">{PRIMARY.map((l) => renderLink(l))}</div>
          </div>
          <div>
            <div className="px-3 pb-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Mais
            </div>
            <div className="space-y-0.5">{SECONDARY.map((l) => renderLink(l))}</div>
          </div>
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
