import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useProgress } from "@/lib/storage";
import { computeXP, levelFor } from "@/lib/gamification";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Home,
  ListChecks,
  RotateCw,
  FileText,
  PenLine,
  Bot,
  User,
  Menu,
  X,
  Calendar,
  BookOpen,
  Lightbulb,
  Trophy,
  Settings as SettingsIcon,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ size?: number }>;
};

// Desktop primary menu (always visible on lg+)
const DESKTOP_MAIN: NavItem[] = [
  { to: "/", label: "Dashboard", shortLabel: "Dashboard", icon: Home },
  { to: "/plano", label: "Plano de Estudos", shortLabel: "Plano", icon: Calendar },
  { to: "/questoes", label: "Questões", icon: ListChecks },
  { to: "/revisar", label: "Revisar Erros", shortLabel: "Revisar", icon: RotateCw },
  { to: "/simulados", label: "Simulados", icon: FileText },
  { to: "/redacao", label: "Redação", icon: PenLine },
  { to: "/tutor", label: "Tutor IA", icon: Bot },
  { to: "/perfil", label: "Perfil", icon: User },
];

// Items inside the "Mais" dropdown / sheet
const MORE: NavItem[] = [
  { to: "/materias", label: "Matérias", icon: BookOpen },
  { to: "/temas-redacao", label: "Temas", icon: Lightbulb },
  { to: "/conquistas", label: "Conquistas", icon: Trophy },
  { to: "/configuracoes", label: "Configurações", icon: SettingsIcon },
];

// Mobile bottom bar — 5 priority + Mais
const MOBILE_PRIMARY: NavItem[] = [
  { to: "/", label: "Dashboard", shortLabel: "Início", icon: Home },
  { to: "/plano", label: "Plano", icon: Calendar },
  { to: "/questoes", label: "Questões", icon: ListChecks },
  { to: "/revisar", label: "Revisar", icon: RotateCw },
  { to: "/simulados", label: "Simulados", icon: FileText },
];

// Full list for mobile sheet
const ALL: NavItem[] = [...DESKTOP_MAIN, ...MORE];

export function Nav() {
  const { progress } = useProgress();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const xp = computeXP(progress);
  const lvl = levelFor(xp.total);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  const moreActive = MORE.some((m) => isActive(m.to));

  // Close desktop "Mais" dropdown on outside click / esc / route change
  useEffect(() => {
    if (!moreOpen) return;
    const onClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  useEffect(() => {
    setMoreOpen(false);
    setSheetOpen(false);
  }, [pathname]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-background focus:text-foreground focus:px-3 focus:py-2 focus:border focus:border-foreground focus:rounded-md"
      >
        Pular para o conteúdo
      </a>

      {/* Top bar */}
      <nav
        aria-label="Navegação principal"
        className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-border"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              to="/"
              className="font-extrabold text-xl sm:text-2xl tracking-tighter uppercase shrink-0"
            >
              Exame.
            </Link>
            <div className="hidden lg:flex items-center gap-0.5 text-sm font-medium">
              {DESKTOP_MAIN.map((l) => {
                const active = isActive(l.to);
                const Icon = l.icon;
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    aria-current={active ? "page" : undefined}
                    className={
                      "inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md transition-colors whitespace-nowrap " +
                      (active
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50")
                    }
                  >
                    <Icon size={14} />
                    <span className="hidden xl:inline">{l.label}</span>
                    <span className="xl:hidden">{l.shortLabel ?? l.label}</span>
                  </Link>
                );
              })}

              {/* Desktop "Mais" dropdown */}
              <div className="relative" ref={moreRef}>
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  className={
                    "inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md transition-colors " +
                    (moreActive || moreOpen
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50")
                  }
                >
                  <MoreHorizontal size={14} />
                  Mais
                  <ChevronDown size={12} className={moreOpen ? "rotate-180 transition-transform" : "transition-transform"} />
                </button>
                {moreOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 bg-popover border border-border rounded-md shadow-lg overflow-hidden"
                  >
                    {MORE.map((l) => {
                      const active = isActive(l.to);
                      const Icon = l.icon;
                      return (
                        <Link
                          key={l.to}
                          to={l.to}
                          role="menuitem"
                          aria-current={active ? "page" : undefined}
                          className={
                            "flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors " +
                            (active
                              ? "bg-accent text-foreground"
                              : "text-foreground hover:bg-accent")
                          }
                        >
                          <Icon size={16} />
                          {l.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/conquistas"
              className="hidden sm:inline-flex items-center gap-1.5 border border-border px-2.5 py-1.5 rounded-md hover:border-foreground/30 hover:bg-accent transition-colors"
              title={`${xp.total.toLocaleString("pt-BR")} XP — ${lvl.title}`}
              aria-label={`Nível ${lvl.level}, ${xp.total} XP`}
            >
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Nv
              </span>
              <span className="text-xs font-bold tracking-tight">{lvl.level}</span>
            </Link>
            <div
              className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1.5 rounded-full"
              title={`Streak de ${progress.streakDays} dia(s)`}
              aria-label={`Streak ${progress.streakDays} dias`}
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
              className="lg:hidden inline-flex items-center justify-center h-9 w-9 rounded-md border border-border hover:bg-accent"
            >
              <Menu size={16} />
            </button>
          </div>
        </div>
      </nav>

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

      {/* Slide-up / side sheet */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
        >
          <div
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute bottom-0 inset-x-0 lg:inset-y-0 lg:right-0 lg:left-auto lg:w-80 bg-card border-t lg:border-l border-border rounded-t-2xl lg:rounded-none shadow-2xl pb-[env(safe-area-inset-bottom)] animate-reveal">
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
          </div>
        </div>
      )}
    </>
  );
}
