import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import {
  QUESTIONS,
  questionMateria,
  questionDifficulty,
  type Difficulty,
  type Question,
} from "@/lib/questions-data";
import { AREAS, recordAnswer, useProgress, type Area, type SimuladoRecord } from "@/lib/storage";
import { recordReviewAnswer } from "@/lib/review";

export const Route = createFileRoute("/_authenticated/simulados")({
  head: () => ({
    meta: [
      { title: "Simulados Cronometrados — Exame ENEM" },
      {
        name: "description",
        content:
          "Simulados rápidos, médios, completos e personalizados nos moldes do ENEM, com gabarito, relatório por área e histórico salvo localmente.",
      },
    ],
  }),
  component: Simulados,
});

// -------- Modes --------
type ModeId = "rapido" | "medio" | "completo" | "personalizado";

interface ModeConfig {
  id: ModeId;
  label: string;
  questions: number;
  minutes: number;
  description: string;
}

const PRESETS: ModeConfig[] = [
  { id: "rapido", label: "Rápido", questions: 10, minutes: 20, description: "Aquecimento veloz." },
  { id: "medio", label: "Médio", questions: 30, minutes: 60, description: "Treino consistente." },
  { id: "completo", label: "Completo", questions: 90, minutes: 270, description: "Resistência ENEM." },
];

interface BucketStat { correct: number; total: number; wrong: number }
interface ResultData {
  score: number;
  total: number;
  spentSec: number;
  byArea: Record<string, BucketStat>;
  bySubject: Record<string, BucketStat>;
  byDifficulty: Record<Difficulty, BucketStat>;
  wrongIds: string[];
  unansweredIds: string[];
  questions: Question[];
  answers: Record<string, string>;
}

// -------- Helpers --------
function pickQuestions(count: number, areas: Area[]): Question[] {
  const pool = areas.length ? QUESTIONS.filter((q) => areas.includes(q.area)) : QUESTIONS;
  const src = pool.length ? pool : QUESTIONS;
  const shuffled = [...src].sort(() => Math.random() - 0.5);
  if (count <= shuffled.length) return shuffled.slice(0, count);
  // Repeat with new ids to reach desired count.
  const out: Question[] = [];
  let i = 0;
  while (out.length < count) {
    const base = shuffled[i % shuffled.length];
    out.push(i < shuffled.length ? base : { ...base, id: `${base.id}#${Math.floor(i / shuffled.length)}` });
    i++;
  }
  return out;
}

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function areaLabel(a: string): string {
  return AREAS.find((x) => x.id === a)?.short ?? a;
}

// -------- Component --------
function Simulados() {
  const { progress, update } = useProgress();
  const [mode, setMode] = useState<ModeConfig | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);

  // Custom mode form state
  const [customCount, setCustomCount] = useState(15);
  const [customMin, setCustomMin] = useState(45);
  const [customAreas, setCustomAreas] = useState<Area[]>(AREAS.map((a) => a.id));

  const submittedRef = useRef(false);

  function start(cfg: ModeConfig, areas: Area[] = []) {
    const qs = pickQuestions(cfg.questions, areas);
    setQuestions(qs);
    setAnswers({});
    setFlags({});
    setIndex(0);
    setTimeLeft(cfg.minutes * 60);
    setStartedAt(Date.now());
    setResult(null);
    setMode(cfg);
    submittedRef.current = false;
  }

  // Timer
  useEffect(() => {
    if (!mode || result) return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          finalize(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, result]);

  function finalize(force = false) {
    if (submittedRef.current) return;
    const unansweredIds = questions.filter((q) => !answers[q.id]).map((q) => q.id);
    if (!force && unansweredIds.length > 0) {
      setConfirmFinish(true);
      return;
    }
    submittedRef.current = true;
    setConfirmFinish(false);

    const mk = (): BucketStat => ({ correct: 0, total: 0, wrong: 0 });
    const byArea: Record<string, BucketStat> = {};
    const bySubject: Record<string, BucketStat> = {};
    const byDifficulty: Record<Difficulty, BucketStat> = {
      "Fácil": mk(), "Médio": mk(), "Difícil": mk(),
    };
    const wrongIds: string[] = [];
    let score = 0;

    questions.forEach((q) => {
      const given = answers[q.id];
      const ok = given === q.correct;
      if (ok) score++;
      if (given && !ok) wrongIds.push(q.id);

      const a = q.area;
      byArea[a] ??= mk();
      byArea[a].total++;
      if (ok) byArea[a].correct++; else if (given) byArea[a].wrong++;

      const s = questionMateria(q);
      bySubject[s] ??= mk();
      bySubject[s].total++;
      if (ok) bySubject[s].correct++; else if (given) bySubject[s].wrong++;

      const d = questionDifficulty(q);
      byDifficulty[d].total++;
      if (ok) byDifficulty[d].correct++; else if (given) byDifficulty[d].wrong++;

      if (given) {
        recordAnswer(q.id, given, ok);
        recordReviewAnswer(q.id, ok);
      }
    });

    const spentSec = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;

    const record: SimuladoRecord = {
      id: crypto.randomUUID(),
      score,
      total: questions.length,
      at: Date.now(),
      mode: mode?.label,
      durationSec: (mode?.minutes ?? 0) * 60,
      spentSec,
      byArea,
      bySubject,
      wrongIds,
      unansweredIds,
    };

    update((p) => ({ ...p, simulados: [...p.simulados, record] }));
    setResult({
      score, total: questions.length, spentSec,
      byArea, bySubject, byDifficulty,
      wrongIds, unansweredIds,
      questions, answers: { ...answers },
    });
  }

  function reset() {
    setMode(null);
    setQuestions([]);
    setAnswers({});
    setFlags({});
    setIndex(0);
    setResult(null);
    setStartedAt(null);
    submittedRef.current = false;
  }

  // -------- Render --------
  if (result) {
    return <ResultView result={result} mode={mode!} history={progress.simulados} onReset={reset} />;
  }

  if (mode) {
    return (
      <RunView
        mode={mode}
        questions={questions}
        index={index}
        setIndex={setIndex}
        answers={answers}
        setAnswers={setAnswers}
        flags={flags}
        setFlags={setFlags}
        timeLeft={timeLeft}
        onFinish={() => finalize(false)}
        onAbort={reset}
        confirmFinish={confirmFinish}
        onConfirmFinish={() => finalize(true)}
        onCancelFinish={() => setConfirmFinish(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Nav />
      <main className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-10 border-b border-border pb-6">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Simulados
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">
            Treine sob pressão.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            Escolha um formato pronto ou monte um simulado personalizado. Erros vão direto para a fila de revisão.
          </p>
        </header>

        <div className="mb-8 border border-primary/30 bg-primary/5 rounded-md p-5 flex flex-wrap items-center gap-4 justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-primary mb-1">
              Novo
            </div>
            <h2 className="text-lg font-extrabold tracking-tight">Provas Reais do ENEM</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Questões oficiais de 2009 a 2024, prova completa ou por área, com nota TRI aproximada.
            </p>
          </div>
          <a
            href="/simulados-reais"
            className="px-4 py-2 bg-foreground text-background text-xs font-bold uppercase tracking-widest whitespace-nowrap"
          >
            Ir para Provas Reais →
          </a>
        </div>


        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {PRESETS.map((d) => (
            <button
              key={d.id}
              onClick={() => start(d)}
              className="group border border-border p-6 bg-card hover:border-foreground transition-all text-left flex flex-col"
            >
              <div className="text-xs font-mono text-muted-foreground mb-1">
                {d.questions} questões
              </div>
              <h3 className="text-2xl font-extrabold tracking-tighter">{d.label}</h3>
              <p className="text-xs text-muted-foreground mt-1">{d.description}</p>
              <div className="mt-10 flex justify-between items-end">
                <span className="font-mono text-lg">{d.minutes} min</span>
                <span className="text-xs font-bold uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Iniciar →
                </span>
              </div>
            </button>
          ))}

          <div className="border border-dashed border-border p-6 bg-card flex flex-col">
            <div className="text-xs font-mono text-muted-foreground mb-1">Você define</div>
            <h3 className="text-2xl font-extrabold tracking-tighter">Personalizado</h3>

            <label className="mt-4 text-[10px] font-mono uppercase text-muted-foreground">
              Questões: {customCount}
            </label>
            <input
              type="range"
              min={5}
              max={90}
              value={customCount}
              onChange={(e) => setCustomCount(Number(e.target.value))}
              className="w-full accent-primary"
            />

            <label className="mt-3 text-[10px] font-mono uppercase text-muted-foreground">
              Minutos: {customMin}
            </label>
            <input
              type="range"
              min={5}
              max={300}
              step={5}
              value={customMin}
              onChange={(e) => setCustomMin(Number(e.target.value))}
              className="w-full accent-primary"
            />

            <div className="mt-3 flex flex-wrap gap-1">
              {AREAS.map((a) => {
                const on = customAreas.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() =>
                      setCustomAreas((prev) =>
                        on ? prev.filter((x) => x !== a.id) : [...prev, a.id],
                      )
                    }
                    className={
                      "text-[10px] font-mono uppercase px-2 py-1 border transition-colors " +
                      (on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground")
                    }
                  >
                    {a.short}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() =>
                start(
                  {
                    id: "personalizado",
                    label: "Personalizado",
                    questions: customCount,
                    minutes: customMin,
                    description: "",
                  },
                  customAreas,
                )
              }
              disabled={customAreas.length === 0}
              className="mt-4 px-4 py-2 bg-foreground text-background text-xs font-bold uppercase tracking-widest hover:bg-primary transition-all disabled:opacity-40"
            >
              Iniciar →
            </button>
          </div>
        </div>

        {progress.simulados.length > 0 && (
          <section>
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-4 mb-6">
              Histórico
            </h2>
            <div className="space-y-2">
              {[...progress.simulados]
                .reverse()
                .slice(0, 15)
                .map((s) => {
                  const pct = Math.round((s.score / s.total) * 100);
                  return (
                    <div
                      key={s.id}
                      className="flex flex-wrap justify-between items-center border border-border p-4 bg-card font-mono text-sm gap-3"
                    >
                      <span className="text-muted-foreground text-xs uppercase">
                        {new Date(s.at).toLocaleString("pt-BR")}
                      </span>
                      <span className="text-xs uppercase text-muted-foreground">
                        {s.mode ?? "—"}
                        {s.spentSec ? ` · ${fmt(s.spentSec)}` : ""}
                      </span>
                      <span className="font-bold">
                        {s.score}/{s.total}{" "}
                        <span className="text-primary">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

// -------- Run view --------
function RunView(props: {
  mode: ModeConfig;
  questions: Question[];
  index: number;
  setIndex: (n: number) => void;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  flags: Record<string, boolean>;
  setFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  timeLeft: number;
  onFinish: () => void;
  onAbort: () => void;
  confirmFinish: boolean;
  onConfirmFinish: () => void;
  onCancelFinish: () => void;
}) {
  const {
    mode, questions, index, setIndex, answers, setAnswers,
    flags, setFlags, timeLeft, onFinish, onAbort,
    confirmFinish, onConfirmFinish, onCancelFinish,
  } = props;

  const q = questions[index];
  const answered = Object.keys(answers).length;
  const flagged = Object.values(flags).filter(Boolean).length;
  const unanswered = questions.length - answered;
  const pct = Math.round((answered / questions.length) * 100);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Sticky control bar */}
        <div className="sticky top-16 z-40 -mx-6 px-6 py-3 bg-background/95 backdrop-blur-md border-b border-border mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-mono uppercase text-muted-foreground">
              {mode.label} · {answered}/{questions.length} respondidas · {flagged} marcadas
            </span>
            <span className="font-mono text-2xl font-extrabold tracking-tighter text-primary">
              {fmt(timeLeft)}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-border overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Question grid navigator */}
        <div className="mb-6 flex flex-wrap gap-1.5">
          {questions.map((qq, i) => {
            const isCur = i === index;
            const isAns = !!answers[qq.id];
            const isFlag = !!flags[qq.id];
            return (
              <button
                key={qq.id}
                onClick={() => setIndex(i)}
                className={
                  "size-8 text-[11px] font-mono font-bold border transition-all relative " +
                  (isCur
                    ? "border-foreground bg-foreground text-background"
                    : isAns
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-foreground")
                }
              >
                {i + 1}
                {isFlag && (
                  <span className="absolute -top-1 -right-1 size-2 rounded-full bg-amber-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Question card */}
        <article className="border border-border bg-card p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-mono uppercase text-muted-foreground">
              Questão {index + 1} · {q.subject} · {q.year}
            </div>
            <button
              onClick={() => setFlags((p) => ({ ...p, [q.id]: !p[q.id] }))}
              className={
                "text-[10px] font-mono uppercase px-2 py-1 border transition-colors " +
                (flags[q.id]
                  ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-border text-muted-foreground hover:border-foreground")
              }
            >
              {flags[q.id] ? "★ Marcada" : "☆ Marcar para revisar"}
            </button>
          </div>

          <p className="text-base leading-relaxed mb-6 whitespace-pre-wrap">{q.statement}</p>

          <div className="space-y-2">
            {q.alternatives.map((alt) => {
              const isSelected = answers[q.id] === alt.key;
              return (
                <button
                  key={alt.key}
                  onClick={() =>
                    setAnswers((prev) => ({ ...prev, [q.id]: alt.key }))
                  }
                  className={
                    "w-full text-left p-3 border transition-all flex items-start gap-3 " +
                    (isSelected
                      ? "border-foreground bg-foreground/5"
                      : "border-border hover:border-foreground/40")
                  }
                >
                  <span
                    className={
                      "size-6 shrink-0 flex items-center justify-center text-xs font-bold border " +
                      (isSelected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border")
                    }
                  >
                    {alt.key}
                  </span>
                  <span className="pt-0.5 text-sm">{alt.text}</span>
                </button>
              );
            })}
          </div>

          {answers[q.id] && (
            <button
              onClick={() => setAnswers((p) => {
                const n = { ...p }; delete n[q.id]; return n;
              })}
              className="mt-3 text-[11px] font-mono uppercase text-muted-foreground hover:text-foreground"
            >
              Limpar resposta
            </button>
          )}
        </article>

        {/* Navigation */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setIndex(Math.max(0, index - 1))}
              disabled={index === 0}
              className="px-4 py-2 border border-border font-bold text-xs uppercase tracking-widest hover:border-foreground transition-all disabled:opacity-30"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setIndex(Math.min(questions.length - 1, index + 1))}
              disabled={index === questions.length - 1}
              className="px-4 py-2 border border-border font-bold text-xs uppercase tracking-widest hover:border-foreground transition-all disabled:opacity-30"
            >
              Próxima →
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAbort}
              className="px-4 py-2 border border-border font-bold text-xs uppercase tracking-widest hover:border-foreground transition-all"
            >
              Desistir
            </button>
            <button
              onClick={onFinish}
              className="px-6 py-2 bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-primary transition-all"
            >
              Finalizar
            </button>
          </div>
        </div>
      </main>

      {confirmFinish && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border max-w-md w-full p-6">
            <h3 className="text-lg font-extrabold tracking-tight mb-2">
              Finalizar simulado?
            </h3>
            <p className="text-sm text-muted-foreground">
              Você ainda tem <strong className="text-foreground">{unanswered}</strong>{" "}
              {unanswered === 1 ? "questão sem responder" : "questões sem responder"}. Deseja
              finalizar mesmo assim?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={onCancelFinish}
                className="px-4 py-2 border border-border text-xs font-bold uppercase tracking-widest hover:border-foreground"
              >
                Continuar
              </button>
              <button
                onClick={onConfirmFinish}
                className="px-4 py-2 bg-foreground text-background text-xs font-bold uppercase tracking-widest hover:bg-primary"
              >
                Finalizar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

// -------- Result view --------
function ResultView(props: {
  result: ResultData;
  mode: ModeConfig;
  history: SimuladoRecord[];
  onReset: () => void;
}) {
  const { result, mode, history, onReset } = props;
  const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
  const errors = result.total - result.score - result.unansweredIds.length;
  const estimatedScore = Math.round(300 + pct * 7); // 300 (zero) → 1000 (100%)
  const avgSec = result.total ? Math.round(result.spentSec / result.total) : 0;

  const areaRows = Object.entries(result.byArea).sort((a, b) => b[1].total - a[1].total);
  const subjectRows = Object.entries(result.bySubject).sort((a, b) => b[1].total - a[1].total);

  // Best / worst area by accuracy (need ≥2 questions to be meaningful)
  const rankableAreas = areaRows
    .filter(([, v]) => v.total >= 1)
    .map(([k, v]) => ({ key: k, acc: v.correct / v.total, ...v }));
  const best = [...rankableAreas].sort((a, b) => b.acc - a.acc)[0];
  const worst = [...rankableAreas].sort((a, b) => a.acc - b.acc)[0];

  // Top wrong subjects
  const topWrongSubjects = subjectRows
    .filter(([, v]) => v.wrong > 0)
    .sort((a, b) => b[1].wrong - a[1].wrong)
    .slice(0, 5);

  // Wrong question list
  const qById = new Map(result.questions.map((q) => [q.id, q]));
  const wrongList = result.wrongIds
    .map((id) => qById.get(id))
    .filter((q): q is Question => !!q);

  // Recommendation
  const recommendations: string[] = [];
  if (topWrongSubjects.length > 0) {
    const [name, v] = topWrongSubjects[0];
    recommendations.push(
      `Foque em ${name}: ${v.wrong} ${v.wrong === 1 ? "erro" : "erros"} neste simulado. Refaça questões e revise a teoria do assunto.`,
    );
  }
  const FAST_THRESHOLD = 45; // sec/questão
  const SLOW_THRESHOLD = 180;
  if (avgSec > 0 && avgSec < FAST_THRESHOLD && errors >= Math.max(2, Math.floor(result.total * 0.2))) {
    recommendations.push(
      `Você respondeu rápido (${avgSec}s/questão) e errou bastante. Treine leitura atenta e interpretação antes de marcar a alternativa.`,
    );
  }
  if (avgSec > SLOW_THRESHOLD) {
    recommendations.push(
      `Tempo médio alto (${avgSec}s/questão). Faça simulados cronometrados curtos para ganhar ritmo de prova.`,
    );
  }
  if (worst && worst.acc < 0.5) {
    recommendations.push(
      `Sua pior área foi ${areaLabel(worst.key)} (${Math.round(worst.acc * 100)}%). Priorize-a nos próximos estudos.`,
    );
  }
  if (recommendations.length === 0) {
    recommendations.push("Desempenho equilibrado. Mantenha o ritmo com simulados regulares.");
  }

  // Evolution data: include this run too (already saved to history)
  const evolution = [...history].sort((a, b) => a.at - b.at).slice(-10);

  // By difficulty
  const diffOrder: Difficulty[] = ["Fácil", "Médio", "Difícil"];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-8 border-b border-border pb-6">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Resultado · {mode.label}
          </span>
          <div className="flex items-end justify-between flex-wrap gap-4 mt-2">
            <div>
              <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter text-primary">
                {result.score}/{result.total}
              </h1>
              <div className="text-xs font-mono uppercase text-muted-foreground mt-2">
                Nota estimada (0–1000) ·{" "}
                <span className="text-foreground text-base font-bold">{estimatedScore}</span>
              </div>
            </div>
            <div className="font-mono text-xs uppercase text-muted-foreground text-right">
              <div>Tempo total: <span className="text-foreground">{fmt(result.spentSec)}</span></div>
              <div className="mt-1">Média por questão: <span className="text-foreground">{fmt(avgSec)}</span></div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <Stat label="Taxa de acerto" value={`${pct}%`} />
          <Stat label="Acertos" value={String(result.score)} />
          <Stat label="Erros" value={String(errors)} />
          <Stat label="Em branco" value={String(result.unansweredIds.length)} />
        </div>

        <div className="grid md:grid-cols-2 gap-3 mb-10">
          <div className="border border-border bg-card p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Melhor área</div>
            <div className="text-2xl font-extrabold tracking-tighter mt-1">
              {best ? areaLabel(best.key) : "—"}
            </div>
            {best && (
              <div className="text-xs font-mono text-primary mt-1">
                {Math.round(best.acc * 100)}% · {best.correct}/{best.total}
              </div>
            )}
          </div>
          <div className="border border-border bg-card p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Pior área</div>
            <div className="text-2xl font-extrabold tracking-tighter mt-1">
              {worst ? areaLabel(worst.key) : "—"}
            </div>
            {worst && (
              <div className="text-xs font-mono text-destructive mt-1">
                {Math.round(worst.acc * 100)}% · {worst.correct}/{worst.total}
              </div>
            )}
          </div>
        </div>

        {/* Recommendation */}
        <section className="mb-10 border border-primary/40 bg-primary/5 p-5">
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-primary mb-3">
            Recomendação de estudo
          </h2>
          <ul className="space-y-2 text-sm">
            {recommendations.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary font-bold">→</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Chart: by area */}
        <section className="mb-10">
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-3 mb-4">
            Desempenho por área
          </h2>
          <div className="space-y-2">
            {areaRows.map(([a, v]) => {
              const p = Math.round((v.correct / v.total) * 100);
              return (
                <div key={a} className="border border-border bg-card p-4">
                  <div className="flex justify-between items-center mb-2 font-mono text-xs uppercase">
                    <span>{areaLabel(a)}</span>
                    <span className="text-muted-foreground">
                      {v.correct}/{v.total} · {p}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-border overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${p}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Chart: evolution */}
        {evolution.length >= 2 && (
          <section className="mb-10">
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-3 mb-4">
              Evolução dos simulados
            </h2>
            <EvolutionChart data={evolution} />
          </section>
        )}

        {/* Chart: by difficulty */}
        <section className="mb-10">
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-3 mb-4">
            Acertos por dificuldade
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {diffOrder.map((d) => {
              const v = result.byDifficulty[d];
              const p = v.total ? Math.round((v.correct / v.total) * 100) : 0;
              const color =
                d === "Fácil" ? "bg-emerald-500"
                : d === "Médio" ? "bg-amber-500"
                : "bg-rose-500";
              return (
                <div key={d} className="border border-border bg-card p-4 flex flex-col items-center">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">{d}</div>
                  <div className="text-3xl font-extrabold tracking-tighter mt-1">{p}%</div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    {v.correct}/{v.total}
                  </div>
                  <div className="h-1.5 w-full bg-border mt-3 overflow-hidden">
                    <div className={"h-full " + color} style={{ width: `${p}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Top wrong subjects */}
        {topWrongSubjects.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-3 mb-4">
              Assuntos com mais erros
            </h2>
            <div className="space-y-2">
              {topWrongSubjects.map(([name, v]) => (
                <div
                  key={name}
                  className="flex justify-between items-center border border-border bg-card p-3 font-mono text-xs"
                >
                  <span className="truncate pr-3">{name}</span>
                  <span className="text-destructive shrink-0">
                    {v.wrong} {v.wrong === 1 ? "erro" : "erros"} de {v.total}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Wrong questions list */}
        {wrongList.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-3 mb-4">
              Questões erradas
            </h2>
            <div className="space-y-2">
              {wrongList.map((q) => (
                <div key={q.id} className="border border-border bg-card p-4">
                  <div className="flex justify-between items-center mb-1 font-mono text-[11px] uppercase text-muted-foreground">
                    <span>{q.subject} · {q.year}</span>
                    <span>
                      Sua resposta:{" "}
                      <span className="text-destructive font-bold">{result.answers[q.id]}</span>{" "}
                      · Correta:{" "}
                      <span className="text-primary font-bold">{q.correct}</span>
                    </span>
                  </div>
                  <p className="text-sm line-clamp-2">{q.statement}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="border border-border bg-card p-5 mb-8 text-sm">
          <strong className="font-bold">{result.wrongIds.length}</strong>{" "}
          {result.wrongIds.length === 1 ? "questão errada foi enviada" : "questões erradas foram enviadas"}{" "}
          automaticamente para a fila de revisão espaçada.
        </div>

        <div className="flex gap-3">
          <button
            onClick={onReset}
            className="px-6 py-3 bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-primary transition-all"
          >
            Voltar aos simulados
          </button>
          <a
            href="/revisar"
            className="px-6 py-3 border border-border font-bold text-xs uppercase tracking-widest hover:border-foreground transition-all"
          >
            Ir para revisão
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="text-3xl font-extrabold tracking-tighter mt-1">{value}</div>
    </div>
  );
}

function EvolutionChart({ data }: { data: SimuladoRecord[] }) {
  const W = 600;
  const H = 160;
  const PAD = 24;
  const points = data.map((s, i) => {
    const pct = s.total ? (s.score / s.total) * 100 : 0;
    const x = PAD + (i * (W - PAD * 2)) / Math.max(1, data.length - 1);
    const y = H - PAD - (pct / 100) * (H - PAD * 2);
    return { x, y, pct, s };
  });
  const path = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
  return (
    <div className="border border-border bg-card p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40">
        {[0, 25, 50, 75, 100].map((g) => {
          const y = H - PAD - (g / 100) * (H - PAD * 2);
          return (
            <g key={g}>
              <line x1={PAD} x2={W - PAD} y1={y} y2={y} className="stroke-border" strokeWidth={1} />
              <text x={4} y={y + 3} className="fill-muted-foreground" fontSize={9} fontFamily="monospace">
                {g}
              </text>
            </g>
          );
        })}
        <path d={path} className="stroke-primary" strokeWidth={2} fill="none" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3.5} className="fill-primary" />
            <text x={p.x} y={H - 6} textAnchor="middle" className="fill-muted-foreground" fontSize={9} fontFamily="monospace">
              {new Date(p.s.at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-2 text-[10px] font-mono uppercase text-muted-foreground text-center">
        Últimos {data.length} simulados · % de acerto
      </div>
    </div>
  );
}
