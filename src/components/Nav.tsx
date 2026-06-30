import { Link, useRouterState } from "@tanstack/react-router";
import { useProgress } from "@/lib/storage";
import { computeXP, levelFor } from "@/lib/gamification";

const LINKS = [
  { to: "/", label: "Dashboard" },
  { to: "/plano", label: "Plano" },
  { to: "/materias", label: "Matérias" },
  { to: "/questoes", label: "Questões" },
  { to: "/revisar", label: "Revisar" },
  { to: "/simulados", label: "Simulados" },
  { to: "/redacao", label: "Redação" },
  { to: "/temas-redacao", label: "Temas" },
  { to: "/tutor", label: "Tutor IA" },
  { to: "/conquistas", label: "Conquistas" },
] as const;

export function Nav() {
  const { progress } = useProgress();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const xp = computeXP(progress);
  const lvl = levelFor(xp.total);

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="font-extrabold text-2xl tracking-tighter uppercase">
            Exame.
          </Link>
          <div className="hidden md:flex gap-6 text-sm font-medium">
            {LINKS.map((l) => {
              const active = pathname === l.to;
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground transition-colors"
                  }
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/conquistas"
            className="hidden sm:flex items-center gap-2 border border-border px-3 py-1.5 hover:border-foreground transition-colors"
            title={`${xp.total.toLocaleString("pt-BR")} XP — ${lvl.title}`}
          >
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Nv
            </span>
            <span className="text-xs font-bold tracking-tight">{lvl.level}</span>
            <span className="hidden md:inline text-[10px] font-mono text-muted-foreground">
              · {xp.total.toLocaleString("pt-BR")} XP
            </span>
          </Link>
          <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-bold text-primary uppercase tracking-wider font-mono">
              {progress.streakDays} {progress.streakDays === 1 ? "Dia" : "Dias"}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
