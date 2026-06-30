import { useState } from "react";
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
} from "lucide-react";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ size?: number }> };

// Mobile bottom bar (5 slots + Mais)
const PRIMARY: NavItem[] = [
  { to: "/", label: "Início", icon: Home },
  { to: "/plano", label: "Plano", icon: Calendar },
  { to: "/questoes", label: "Questões", icon: ListChecks },
  { to: "/revisar", label: "Revisar", icon: RotateCw },
  { to: "/simulados", label: "Simulados", icon: FileText },
];

// Desktop top bar (primary)
const DESKTOP_MAIN: NavItem[] = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/plano", label: "Plano de Estudos", icon: Calendar },
  { to: "/questoes", label: "Questões", icon: ListChecks },
  { to: "/revisar", label: "Revisar Erros", icon: RotateCw },
  { to: "/simulados", label: "Simulados", icon: FileText },
  { to: "/redacao", label: "Redação", icon: PenLine },
  { to: "/tutor", label: "Tutor IA", icon: Bot },
  { to: "/perfil", label: "Perfil", icon: User },
];

// Grouped under "Mais"
const MORE: NavItem[] = [
  { to: "/configuracoes", label: "Configurações", icon: SettingsIcon },
  { to: "/materias", label: "Matérias", icon: BookOpen },
  { to: "/temas-redacao", label: "Temas de Redação", icon: Lightbulb },
  { to: "/conquistas", label: "Conquistas", icon: Trophy },
];

// Full list for slide-up sheet
const ALL: NavItem[] = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/plano", label: "Plano de Estudos", icon: Calendar },
  { to: "/questoes", label: "Questões", icon: ListChecks },
  { to: "/revisar", label: "Revisar Erros", icon: RotateCw },
  { to: "/simulados", label: "Simulados", icon: FileText },
  { to: "/redacao", label: "Redação", icon: PenLine },
  { to: "/tutor", label: "Tutor IA", icon: Bot },
  { to: "/perfil", label: "Perfil", icon: User },
  ...MORE,
];

export function Nav() {
  const { progress } = useProgress();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const xp = computeXP(progress);
  const lvl = levelFor(xp.total);
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

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
          <div className="flex items-center gap-6 min-w-0">
            <Link
              to="/"
              className="font-extrabold text-xl sm:text-2xl tracking-tighter uppercase shrink-0"
            >
              Exame.
            </Link>
            <div className="hidden lg:flex items-center gap-1 text-sm font-medium">
              {DESKTOP_MAIN.map((l) => {
                const active = isActive(l.to);
                const Icon = l.icon;
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={
                      "inline-flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors " +
                      (active
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50")
                    }
                  >
                    <Icon size={14} />
                    {l.label}
                  </Link>
                );
              })}
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
              onClick={() => setMenuOpen(true)}
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
          {PRIMARY.map((l) => {
            const active = isActive(l.to);
            const Icon = l.icon;
            return (
              <li key={l.to}>
                <Link
                  to={l.to}
                  aria-current={active ? "page" : undefined}
                  className={
                    "flex flex-col items-center justify-center gap-0.5 min-h-14 py-2 text-[10px] font-medium tracking-wide transition-colors " +
                    (active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  <Icon size={20} />
                  <span>{l.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Mais opções"
              className="w-full flex flex-col items-center justify-center gap-0.5 min-h-14 py-2 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Menu size={20} />
              <span>Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Slide-up menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
        >
          <div
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute bottom-0 inset-x-0 lg:inset-y-0 lg:right-0 lg:left-auto lg:w-80 bg-card border-t lg:border-l border-border rounded-t-2xl lg:rounded-none shadow-2xl pb-[env(safe-area-inset-bottom)] animate-reveal">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Navegação
              </span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
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
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={
                        "flex items-center gap-3 px-3 py-3 min-h-11 rounded-md text-sm font-medium transition-colors " +
                        (active
                          ? "bg-accent text-foreground"
                          : "text-foreground hover:bg-accent")
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
