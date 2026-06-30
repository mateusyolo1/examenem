import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AREAS, recordAnswer } from "@/lib/storage";
import {
  QUESTIONS,
  questionDifficulty,
  questionMateria,
  questionTopic,
  type Question,
} from "@/lib/questions-data";
import {
  useReviews,
  markMastered,
  recordReviewAnswer,
  nextIntervalLabel,
  type ReviewEntry,
  INTERVALS_DAYS,
} from "@/lib/review";
import { subjectIdForQuestion } from "@/lib/subjects";
import { recordReviewAnswer as recordLearningReview } from "@/lib/learning-progress";

export const Route = createFileRoute("/revisar")({
  head: () => ({
    meta: [
      { title: "Revisar erros — Exame ENEM" },
      {
        name: "description",
        content:
          "Revisão espaçada das questões que você errou: intervalos crescentes, refazer e marcar como dominada.",
      },
    ],
  }),
  component: RevisarPage,
});

const QMAP: Record<string, Question> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

function RevisarPage() {
  const { reviews } = useReviews();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"hoje" | "todos" | "dominadas">("hoje");
  const [openId, setOpenId] = useState<string | null>(null);
  const [retryId, setRetryId] = useState<string | null>(null);
  const [retrySel, setRetrySel] = useState<string | null>(null);
  const [retryDone, setRetryDone] = useState(false);

  const now = Date.now();
  const entries = Object.values(reviews).filter((r) => QMAP[r.questionId]);
  const pending = entries.filter((r) => !r.mastered && r.nextReviewAt <= now);
  const upcoming = entries.filter((r) => !r.mastered && r.nextReviewAt > now);
  const mastered = entries.filter((r) => r.mastered);

  const list =
    tab === "hoje"
      ? pending.sort((a, b) => b.errorCount - a.errorCount)
      : tab === "dominadas"
        ? mastered
        : [...pending, ...upcoming].sort((a, b) => a.nextReviewAt - b.nextReviewAt);

  function openExplanation(id: string) {
    setOpenId((cur) => (cur === id ? null : id));
    setRetryId(null);
  }
  function startRetry(id: string) {
    setRetryId(id);
    setRetrySel(null);
    setRetryDone(false);
    setOpenId(null);
  }
  function confirmRetry(q: Question) {
    if (!retrySel) return;
    const ok = retrySel === q.correct;
    recordAnswer(q.id, retrySel, ok);
    recordReviewAnswer(q.id, ok);
    setRetryDone(true);
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Nav />

      <main className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-8 border-b border-border pb-6">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Revisão espaçada
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">
            Revisar erros.
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Intervalos de revisão: {INTERVALS_DAYS.join(" → ")} dias. Cada vez que você
            errar de novo, o próximo retorno é mais espaçado — até dominar.
          </p>
        </header>

        {/* Counters */}
        <div className="grid grid-cols-3 gap-px bg-border border border-border mb-8">
          <Stat label="Pendentes hoje" value={pending.length} accent />
          <Stat label="Em fila" value={upcoming.length} />
          <Stat label="Dominadas" value={mastered.length} />
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(
            [
              ["hoje", `Hoje (${pending.length})`],
              ["todos", `Todas (${pending.length + upcoming.length})`],
              ["dominadas", `Dominadas (${mastered.length})`],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border transition-colors ${
                tab === v
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="border border-border p-12 bg-card text-center">
            <p className="font-mono text-sm text-muted-foreground">
              {tab === "hoje"
                ? "Nada pendente para hoje. Boa! Continue praticando questões novas."
                : tab === "dominadas"
                  ? "Você ainda não marcou nenhuma questão como dominada."
                  : "Nenhuma questão na fila de revisão."}
            </p>
            <button
              onClick={() => navigate({ to: "/questoes" })}
              className="mt-4 px-5 py-2 text-xs font-bold uppercase tracking-widest border border-border hover:border-foreground"
            >
              Ir treinar questões →
            </button>
          </div>
        ) : (
          <div className="space-y-px bg-border border border-border">
            {list.map((r) => (
              <ReviewRow
                key={r.questionId}
                entry={r}
                open={openId === r.questionId}
                retryActive={retryId === r.questionId}
                retrySel={retrySel}
                retryDone={retryDone}
                onSelect={setRetrySel}
                onConfirmRetry={confirmRetry}
                onOpenExplanation={() => openExplanation(r.questionId)}
                onStartRetry={() => startRetry(r.questionId)}
                onMaster={() => markMastered(r.questionId, true)}
                onUnmaster={() => markMastered(r.questionId, false)}
              />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-background p-5">
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-3 text-4xl font-extrabold tracking-tighter ${
          accent ? "text-primary" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ReviewRow({
  entry,
  open,
  retryActive,
  retrySel,
  retryDone,
  onSelect,
  onConfirmRetry,
  onOpenExplanation,
  onStartRetry,
  onMaster,
  onUnmaster,
}: {
  entry: ReviewEntry;
  open: boolean;
  retryActive: boolean;
  retrySel: string | null;
  retryDone: boolean;
  onSelect: (k: string) => void;
  onConfirmRetry: (q: Question) => void;
  onOpenExplanation: () => void;
  onStartRetry: () => void;
  onMaster: () => void;
  onUnmaster: () => void;
}) {
  const q = QMAP[entry.questionId];
  if (!q) return null;
  const areaLabel = AREAS.find((a) => a.id === q.area)?.short || q.area;
  const lastWrong = new Date(entry.lastWrongAt).toLocaleDateString("pt-BR");
  const now = Date.now();
  const due = entry.nextReviewAt <= now;
  const daysToReview = Math.max(0, Math.ceil((entry.nextReviewAt - now) / 86400000));

  return (
    <div className="bg-background p-5">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div className="flex-1 min-w-[260px]">
          <div className="flex flex-wrap gap-1.5 text-[10px] font-mono uppercase tracking-widest mb-2">
            <Tag>{areaLabel}</Tag>
            <Tag>{questionMateria(q)}</Tag>
            <Tag accent>{questionTopic(q)}</Tag>
            <Tag>{questionDifficulty(q)}</Tag>
            <Tag>{q.year}</Tag>
            {entry.mastered ? (
              <Tag tone="primary">Dominada</Tag>
            ) : due ? (
              <Tag tone="destructive">Revisar hoje</Tag>
            ) : (
              <Tag>em {daysToReview}d</Tag>
            )}
          </div>
          <p className="text-sm md:text-base leading-snug line-clamp-2">{q.statement}</p>
          <div className="mt-2 text-[11px] font-mono text-muted-foreground">
            Última vez errada: {lastWrong} · errou {entry.errorCount}{" "}
            {entry.errorCount === 1 ? "vez" : "vezes"} · próxima revisão em{" "}
            {nextIntervalLabel(entry.errorCount)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionBtn onClick={onStartRetry}>Refazer questão</ActionBtn>
          <ActionBtn onClick={onOpenExplanation} variant="outline">
            Ver explicação
          </ActionBtn>
          {entry.mastered ? (
            <ActionBtn onClick={onUnmaster} variant="outline">
              Desmarcar
            </ActionBtn>
          ) : (
            <ActionBtn onClick={onMaster} variant="primary">
              ★ Dominada
            </ActionBtn>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-4 p-4 border-l-2 border-primary bg-card text-sm leading-relaxed">
          <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">
            Gabarito: {q.correct}
          </div>
          {q.explanation}
        </div>
      )}

      {retryActive && (
        <div className="mt-4 p-4 border border-border bg-card">
          <div className="text-sm font-medium mb-3 whitespace-pre-wrap">{q.statement}</div>
          <div className="space-y-2">
            {q.alternatives.map((alt) => {
              const isSel = retrySel === alt.key;
              const isCorrect = retryDone && alt.key === q.correct;
              const wrongPick = retryDone && isSel && alt.key !== q.correct;
              return (
                <button
                  key={alt.key}
                  onClick={() => !retryDone && onSelect(alt.key)}
                  disabled={retryDone}
                  className={
                    "w-full text-left p-3 border text-sm flex items-start gap-3 " +
                    (isCorrect
                      ? "border-primary bg-primary/10"
                      : wrongPick
                        ? "border-destructive bg-destructive/10"
                        : isSel
                          ? "border-foreground bg-foreground/5"
                          : "border-border hover:border-foreground/40")
                  }
                >
                  <span className="font-bold">{alt.key}.</span>
                  <span>{alt.text}</span>
                </button>
              );
            })}
          </div>
          {!retryDone ? (
            <button
              onClick={() => onConfirmRetry(q)}
              disabled={!retrySel}
              className="mt-3 px-6 py-2 bg-foreground text-background text-xs font-bold uppercase tracking-widest hover:bg-primary disabled:opacity-30"
            >
              Confirmar
            </button>
          ) : (
            <div
              className={`mt-3 p-3 text-xs font-bold uppercase tracking-widest ${
                retrySel === q.correct
                  ? "bg-primary/10 text-primary border border-primary"
                  : "bg-destructive/10 text-destructive border border-destructive"
              }`}
            >
              {retrySel === q.correct
                ? "✓ Acertou! Próxima revisão foi adiada."
                : `✕ Errou. Resposta correta: ${q.correct}. Reagendada.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Tag({
  children,
  accent,
  tone,
}: {
  children: React.ReactNode;
  accent?: boolean;
  tone?: "primary" | "destructive";
}) {
  const cls =
    tone === "primary"
      ? "border-primary text-primary"
      : tone === "destructive"
        ? "border-destructive text-destructive"
        : accent
          ? "border-foreground text-foreground"
          : "border-border text-muted-foreground";
  return <span className={`px-2 py-0.5 border ${cls}`}>{children}</span>;
}

function ActionBtn({
  children,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "outline" | "primary";
}) {
  const cls =
    variant === "outline"
      ? "border border-border hover:border-foreground"
      : variant === "primary"
        ? "bg-primary text-primary-foreground hover:bg-foreground hover:text-background"
        : "bg-foreground text-background hover:bg-primary";
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${cls}`}
    >
      {children}
    </button>
  );
}
