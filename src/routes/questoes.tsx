import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AREAS, recordAnswer, useProgress, type Area } from "@/lib/storage";
import {
  QUESTIONS,
  YEARS,
  MATERIAS,
  questionDifficulty,
  questionMateria,
  questionTopic,
  type Question,
  type Difficulty,
} from "@/lib/questions-data";
import { useSavedQuestions } from "@/lib/saved-questions";

const AREA_VALUES = ["todas", "linguagens", "humanas", "natureza", "matematica"] as const;
const DIFF_VALUES = ["todas", "Fácil", "Médio", "Difícil"] as const;
const STATUS_VALUES = ["todos", "errados", "nao-respondidos", "salvos"] as const;

const searchSchema = z.object({
  area: fallback(z.enum(AREA_VALUES), "todas").default("todas"),
  materia: fallback(z.string(), "todas").default("todas"),
  topico: fallback(z.string(), "todos").default("todos"),
  dif: fallback(z.enum(DIFF_VALUES), "todas").default("todas"),
  year: fallback(z.coerce.number().optional(), undefined),
  status: fallback(z.enum(STATUS_VALUES), "todos").default("todos"),
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/questoes")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Banco de Questões — Exame ENEM" },
      {
        name: "description",
        content:
          "Pratique questões do ENEM com filtros por área, matéria, assunto, dificuldade, ano e status. Salve questões para revisão.",
      },
    ],
  }),
  component: Questoes,
});

function Questoes() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { progress } = useProgress();
  const { isSaved, toggle: toggleSaved, saved } = useSavedQuestions();

  function update(patch: Partial<typeof search>) {
    navigate({ search: (prev: typeof search) => ({ ...prev, ...patch }) });
    setIndex(0);
    reset();
  }

  // Filtered list
  const list = useMemo(() => {
    const ans = progress.answers;
    const term = search.q.trim().toLowerCase();
    return QUESTIONS.filter((qq) => {
      if (search.area !== "todas" && qq.area !== search.area) return false;
      if (search.materia !== "todas" && questionMateria(qq) !== search.materia) return false;
      if (search.topico !== "todos" && questionTopic(qq) !== search.topico) return false;
      if (search.dif !== "todas" && questionDifficulty(qq) !== search.dif) return false;
      if (search.year && qq.year !== search.year) return false;
      const a = ans[qq.id];
      if (search.status === "errados" && (!a || a.correct)) return false;
      if (search.status === "nao-respondidos" && a) return false;
      if (search.status === "salvos" && !saved.includes(qq.id)) return false;
      if (term) {
        const hay = (
          qq.statement +
          " " +
          qq.subject +
          " " +
          qq.alternatives.map((x) => x.text).join(" ")
        ).toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [search, progress.answers, saved]);

  // Available topics depend on area + materia
  const availableTopics = useMemo(() => {
    const pool = QUESTIONS.filter(
      (qq) =>
        (search.area === "todas" || qq.area === search.area) &&
        (search.materia === "todas" || questionMateria(qq) === search.materia),
    );
    return Array.from(new Set(pool.map(questionTopic))).sort();
  }, [search.area, search.materia]);

  const availableMaterias = useMemo(() => {
    if (search.area === "todas") return MATERIAS;
    return Array.from(
      new Set(QUESTIONS.filter((qq) => qq.area === search.area).map(questionMateria)),
    ).sort();
  }, [search.area]);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const q = list[index];
  const answered = q ? progress.answers[q.id] : undefined;

  function reset() {
    setSelected(null);
    setRevealed(false);
  }

  function confirm() {
    if (!q || !selected) return;
    recordAnswer(q.id, selected, selected === q.correct);
    setRevealed(true);
  }

  function next() {
    setIndex((i) => (i + 1) % Math.max(list.length, 1));
    reset();
  }

  // Suggest a similar question (same matéria, not the current one, not yet correct)
  const suggestion = useMemo<Question | null>(() => {
    if (!q || !revealed || selected === q.correct) return null;
    const ans = progress.answers;
    const sameMateria = QUESTIONS.filter(
      (cand) =>
        cand.id !== q.id &&
        questionMateria(cand) === questionMateria(q) &&
        (!ans[cand.id] || !ans[cand.id].correct),
    );
    return sameMateria[0] || null;
  }, [q, revealed, selected, progress.answers]);

  function jumpTo(target: Question) {
    const idx = list.findIndex((x) => x.id === target.id);
    if (idx >= 0) {
      setIndex(idx);
    } else {
      // Reset filters minimally so the suggested question is reachable
      navigate({ search: (prev: typeof search) => ({ ...prev, status: "todos", q: "" }) });
      // After re-filter, the question may still not be in list; user can refilter
    }
    reset();
  }

  const isWrong = revealed && selected !== q?.correct;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Nav />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-8 border-b border-border pb-6">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Banco de Questões
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">
            Treine no estilo do ENEM.
          </h1>
        </header>

        {/* Filters */}
        <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Field label="Busca por palavra-chave">
            <input
              type="search"
              value={search.q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder="Ex.: Iluminismo, função, ecologia…"
              className="w-full bg-background border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
            />
          </Field>

          <Field label="Área">
            <Select
              value={search.area}
              onChange={(v) =>
                update({
                  area: v as (typeof AREA_VALUES)[number],
                  materia: "todas",
                  topico: "todos",
                })
              }
            >
              <option value="todas">Todas as áreas</option>
              {AREAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.short}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Matéria">
            <Select
              value={search.materia}
              onChange={(v) => update({ materia: v, topico: "todos" })}
            >
              <option value="todas">Todas as matérias</option>
              {availableMaterias.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Assunto">
            <Select value={search.topico} onChange={(v) => update({ topico: v })}>
              <option value="todos">Todos os assuntos</option>
              {availableTopics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Dificuldade">
            <Select
              value={search.dif}
              onChange={(v) => update({ dif: v as (typeof DIFF_VALUES)[number] })}
            >
              <option value="todas">Todas</option>
              <option value="Fácil">Fácil</option>
              <option value="Médio">Médio</option>
              <option value="Difícil">Difícil</option>
            </Select>
          </Field>

          <Field label="Ano">
            <Select
              value={search.year ? String(search.year) : ""}
              onChange={(v) => update({ year: v ? Number(v) : undefined })}
            >
              <option value="">Todos os anos</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>
        </section>

        {/* Status chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          {(
            [
              ["todos", "Todas"],
              ["errados", "Errei"],
              ["nao-respondidos", "Não respondidas"],
              ["salvos", `Salvas (${saved.length})`],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => update({ status: v })}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border transition-colors ${
                search.status === v
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto text-xs font-mono uppercase text-muted-foreground self-center">
            {list.length} {list.length === 1 ? "questão" : "questões"}
          </div>
        </div>

        {!q ? (
          <div className="border border-border p-12 bg-card text-center">
            <p className="font-mono text-sm text-muted-foreground">
              Nenhuma questão encontrada com esses filtros.
            </p>
            <button
              onClick={() =>
                navigate({
                  search: {
                    area: "todas",
                    materia: "todas",
                    topico: "todos",
                    dif: "todas",
                    year: undefined,
                    status: "todos",
                    q: "",
                  },
                })
              }
              className="mt-4 px-5 py-2 text-xs font-bold uppercase tracking-widest border border-border hover:border-foreground"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <article className="border border-border bg-card p-6 md:p-10">
            {/* Meta strip */}
            <div className="flex flex-wrap items-center gap-2 mb-6 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <span className="px-2 py-1 border border-border">
                {String(index + 1).padStart(2, "0")} / {String(list.length).padStart(2, "0")}
              </span>
              <span className="px-2 py-1 border border-border">{q.year}</span>
              <span className="px-2 py-1 border border-border">
                {questionMateria(q)}
              </span>
              <span className="px-2 py-1 border border-border text-foreground">
                {questionTopic(q)}
              </span>
              <DifficultyTag d={questionDifficulty(q)} />
              {answered && (
                <span
                  className={`px-2 py-1 border ${
                    answered.correct
                      ? "border-primary text-primary"
                      : "border-destructive text-destructive"
                  }`}
                >
                  {answered.correct ? "Já acertou" : "Já errou"}
                </span>
              )}
              <button
                onClick={() => toggleSaved(q.id)}
                className={`ml-auto px-3 py-1 border transition-colors ${
                  isSaved(q.id)
                    ? "border-primary text-primary"
                    : "border-border hover:border-foreground"
                }`}
              >
                {isSaved(q.id) ? "★ Salva" : "☆ Salvar"}
              </button>
            </div>

            <p className="text-lg md:text-xl leading-relaxed mb-8 whitespace-pre-wrap">
              {q.statement}
            </p>

            <div className="space-y-3">
              {q.alternatives.map((alt) => {
                const isSelected = selected === alt.key;
                const isCorrect = revealed && alt.key === q.correct;
                const wrongPick = revealed && isSelected && alt.key !== q.correct;
                return (
                  <button
                    key={alt.key}
                    onClick={() => !revealed && setSelected(alt.key)}
                    disabled={revealed}
                    className={
                      "w-full text-left p-4 border transition-colors flex items-start gap-4 " +
                      (isCorrect
                        ? "border-primary bg-primary/10"
                        : wrongPick
                          ? "border-destructive bg-destructive/10"
                          : isSelected
                            ? "border-foreground bg-foreground/5"
                            : "border-border hover:border-foreground/40")
                    }
                  >
                    <span
                      className={
                        "size-7 shrink-0 flex items-center justify-center text-xs font-bold border " +
                        (isCorrect
                          ? "border-primary bg-primary text-primary-foreground"
                          : wrongPick
                            ? "border-destructive bg-destructive text-destructive-foreground"
                            : isSelected
                              ? "border-foreground bg-foreground text-background"
                              : "border-border")
                      }
                    >
                      {alt.key}
                    </span>
                    <span className="pt-0.5">{alt.text}</span>
                  </button>
                );
              })}
            </div>

            {revealed && (
              <>
                <div
                  className={`mt-6 p-4 font-bold uppercase tracking-widest text-xs ${
                    selected === q.correct
                      ? "bg-primary/10 text-primary border border-primary"
                      : "bg-destructive/10 text-destructive border border-destructive"
                  }`}
                >
                  {selected === q.correct
                    ? `✓ Você acertou — resposta correta: ${q.correct}`
                    : `✕ Você errou — resposta correta: ${q.correct}`}
                </div>

                <div className="mt-4 p-6 border-l-2 border-primary bg-background">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-2">
                    Gabarito comentado
                  </span>
                  <p className="text-sm leading-relaxed">{q.explanation}</p>
                </div>

                {isWrong && suggestion && (
                  <div className="mt-4 p-6 border border-border bg-background">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-2">
                      Sugestão · questão parecida
                    </span>
                    <p className="text-sm font-bold leading-snug">{suggestion.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {suggestion.statement}
                    </p>
                    <button
                      onClick={() => jumpTo(suggestion)}
                      className="mt-3 px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-foreground text-background hover:bg-primary transition-colors"
                    >
                      Treinar similar →
                    </button>
                  </div>
                )}
              </>
            )}

            <div className="mt-8 pt-8 border-t border-border flex flex-wrap justify-between gap-3">
              <button
                onClick={next}
                className="px-6 py-3 border border-border font-bold text-xs uppercase tracking-widest hover:border-foreground transition-colors"
              >
                Pular questão
              </button>
              {!revealed ? (
                <button
                  onClick={confirm}
                  disabled={!selected}
                  className="px-8 py-3 bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Confirmar resposta
                </button>
              ) : (
                <button
                  onClick={next}
                  className="px-8 py-3 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors"
                >
                  Próxima questão →
                </button>
              )}
            </div>
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground block mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-background border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
    >
      {children}
    </select>
  );
}

function DifficultyTag({ d }: { d: Difficulty }) {
  const cls =
    d === "Fácil"
      ? "border-primary text-primary"
      : d === "Difícil"
        ? "border-destructive text-destructive"
        : "border-border text-muted-foreground";
  return <span className={`px-2 py-1 border ${cls}`}>{d}</span>;
}

// Suppress unused-area import warning when area constant isn't directly referenced.
export type _AreaUsed = Area;
