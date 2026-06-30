import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useProgress } from "@/lib/storage";
import { useReviews } from "@/lib/review";
import {
  ACHIEVEMENTS,
  categoryLabel,
  computeXP,
  levelFor,
  XP,
} from "@/lib/gamification";

export const Route = createFileRoute("/conquistas")({
  head: () => ({
    meta: [
      { title: "Conquistas — Exame ENEM" },
      {
        name: "description",
        content:
          "Acompanhe seu XP, nível e medalhas conquistadas estudando para o ENEM.",
      },
    ],
  }),
  component: Conquistas,
});

function Conquistas() {
  const { progress } = useProgress();
  const { reviews } = useReviews();
  const reviewsCompleted = Object.values(reviews).filter((r) => r.mastered).length;

  const xp = useMemo(() => computeXP(progress), [progress]);
  const lvl = useMemo(() => levelFor(xp.total), [xp.total]);

  const ctx = { progress, reviewsCompleted };
  const checked = ACHIEVEMENTS.map((a) => ({ ...a, ...a.check(ctx) }));
  const unlocked = checked.filter((a) => a.unlocked);
  const locked = checked.filter((a) => !a.unlocked);

  const grouped = checked.reduce<Record<string, typeof checked>>((acc, a) => {
    (acc[a.category] ||= []).push(a);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <Nav />
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-10">
        <header className="border-b border-border pb-6">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Conquistas
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">
            Sua jornada em números.
          </h1>
        </header>

        {/* Level card */}
        <section className="border border-border bg-card p-6 md:p-8 grid md:grid-cols-[1fr_auto] gap-6 items-center">
          <div className="flex-1">
            <div className="flex items-baseline gap-3">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Nível {lvl.level}
              </span>
              <span className="text-xs font-mono uppercase text-primary">{lvl.title}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <h2 className="text-5xl md:text-6xl font-extrabold tracking-tighter">
                {xp.total.toLocaleString("pt-BR")}
              </h2>
              <span className="text-sm font-mono text-muted-foreground">XP total</span>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-[10px] font-mono uppercase text-muted-foreground mb-1.5">
                <span>Progresso para nível {lvl.level + 1}</span>
                <span>
                  {lvl.xpToNext.toLocaleString("pt-BR")} XP restantes
                </span>
              </div>
              <div className="h-2 bg-border">
                <div
                  className="h-full bg-foreground transition-all"
                  style={{ width: `${lvl.progress}%` }}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border border border-border min-w-[260px]">
            <XPLine label="Questões" value={xp.answers} />
            <XPLine label="Acertos" value={xp.correct} />
            <XPLine label="Redações" value={xp.essays} />
            <XPLine label="Simulados" value={xp.simulados} />
            <XPLine label="Streak" value={xp.streak} />
            <XPLine
              label="Por questão"
              value={`+${XP.perAnswer}/+${XP.perCorrect}`}
              isInfo
            />
          </div>
        </section>

        {/* Achievements summary */}
        <section className="grid sm:grid-cols-3 gap-px bg-border border border-border">
          <Stat label="Conquistadas" value={`${unlocked.length}`} unit={`de ${checked.length}`} />
          <Stat label="Em progresso" value={`${locked.length}`} />
          <Stat
            label="Próxima"
            value={locked[0]?.title ?? "—"}
            unit={locked[0] ? `${locked[0].progress ?? 0}/${locked[0].target ?? "?"}` : ""}
            small
          />
        </section>

        {/* Achievement grid by category */}
        {Object.entries(grouped).map(([cat, items]) => (
          <section key={cat}>
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 border-b border-border pb-2">
              {categoryLabel(cat as never)}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((a) => (
                <Medal
                  key={a.id}
                  title={a.title}
                  description={a.description}
                  unlocked={a.unlocked}
                  progress={a.progress ?? 0}
                  target={a.target ?? 1}
                />
              ))}
            </div>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}

function XPLine({
  label,
  value,
  isInfo,
}: {
  label: string;
  value: number | string;
  isInfo?: boolean;
}) {
  return (
    <div className="bg-background p-3">
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={"font-extrabold tracking-tight " + (isInfo ? "text-sm" : "text-xl")}>
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  small,
}: {
  label: string;
  value: string;
  unit?: string;
  small?: boolean;
}) {
  return (
    <div className="bg-background p-5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={
            "font-extrabold tracking-tighter " + (small ? "text-xl" : "text-3xl")
          }
        >
          {value}
        </span>
        {unit && (
          <span className="text-[10px] font-mono uppercase text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function Medal({
  title,
  description,
  unlocked,
  progress,
  target,
}: {
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  target: number;
}) {
  const pct = target ? Math.min(100, Math.round((progress / target) * 100)) : 0;
  return (
    <div
      className={
        "border p-4 transition-all " +
        (unlocked
          ? "border-foreground bg-card"
          : "border-border bg-card/40 opacity-80")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={
              "w-10 h-10 flex items-center justify-center border text-xs font-mono " +
              (unlocked
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground")
            }
          >
            {unlocked ? "✓" : "◯"}
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">{title}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{description}</div>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-[9px] font-mono uppercase text-muted-foreground mb-1">
          <span>{unlocked ? "Conquistada" : "Progresso"}</span>
          <span>
            {Math.min(progress, target)}/{target}
          </span>
        </div>
        <div className="h-1 bg-border">
          <div
            className={"h-full transition-all " + (unlocked ? "bg-primary" : "bg-foreground/60")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
