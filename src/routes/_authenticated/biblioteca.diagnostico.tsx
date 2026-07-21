import { Fragment, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { searchLibrary } from "@/lib/library.functions";
import { toast } from "sonner";

const ALLOWLIST = new Set<string>([
  "mateusyolo@agenciaskills.com.br",
  "mateusyolo1@gmail.com",
]);

const TEST_QUERIES = [
  "Explique o que é uma função do segundo grau",
  "O que é mitose e meiose",
  "Qual a diferença entre Brasil Colônia e Brasil Império",
  "Quando usar 'mas' ou 'mais' em uma frase",
  "Como dizer 'obrigado' em inglês",
] as const;

type Subject = "matematica" | "biologia" | "historia";

const CALIBRATION_QUERIES: { text: string; subject: Subject }[] = [
  { text: "explique função do segundo grau", subject: "matematica" },
  { text: "o que é logaritmo", subject: "matematica" },
  { text: "como calcular área de triângulo", subject: "matematica" },
  { text: "diferença entre média mediana e moda", subject: "matematica" },
  { text: "teorema de pitágoras", subject: "matematica" },
  { text: "mitose e meiose diferença", subject: "biologia" },
  { text: "o que é fotossíntese", subject: "biologia" },
  { text: "estrutura do DNA", subject: "biologia" },
  { text: "sistema digestivo humano", subject: "biologia" },
  { text: "célula animal e vegetal", subject: "biologia" },
  { text: "Brasil Colônia e Brasil Império", subject: "historia" },
  { text: "Revolução Francesa causas", subject: "historia" },
  { text: "Primeira Guerra Mundial", subject: "historia" },
  { text: "Era Vargas resumo", subject: "historia" },
  { text: "ditadura militar no Brasil", subject: "historia" },
];

// Regra de classificação on-topic pelo título do livro do top-1 match.
// Historia inclui "geograf" porque Brasil Colônia costuma cair em Geografia
// no acervo atual do admin.
const SUBJECT_BOOK_PATTERNS: Record<Subject, RegExp> = {
  matematica: /matem[aá]t/i,
  biologia: /biolo?g/i,
  historia: /hist[oó]r|geograf/i,
};

type ScopeKey = "1" | "3" | "7";

type Match = {
  id: string;
  book_id: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
};

type RowState = {
  query: string;
  status: "pending" | "running" | "done" | "failed";
  matches: Match[];
  error?: string;
};

type CalibRow = {
  query: string;
  subject: Subject;
  status: "pending" | "running" | "done" | "failed";
  match?: Match;
  error?: string;
};

type BookRow = { id: string; title: string };

export const Route = createFileRoute("/_authenticated/biblioteca/diagnostico")({
  component: DiagnosticoPage,
});

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function fmt(n: number | null | undefined) {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(3) : "—";
}

function meta(m: Match | undefined, key: string): string {
  const v = m?.metadata?.[key];
  return v === undefined || v === null || v === "" ? "—" : String(v);
}

function classifyOnTopic(row: CalibRow): "on" | "off" | "n/a" {
  if (!row.match) return "n/a";
  const title = String(row.match.metadata?.bookTitle ?? "");
  if (!title) return "n/a";
  return SUBJECT_BOOK_PATTERNS[row.subject].test(title) ? "on" : "off";
}

function DiagnosticoPage() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<null | boolean>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<RowState[]>(
    TEST_QUERIES.map((q) => ({ query: q, status: "pending", matches: [] })),
  );
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const searchFn = useServerFn(searchLibrary);

  // Calibração
  const [books, setBooks] = useState<BookRow[]>([]);
  const [scope, setScope] = useState<ScopeKey | null>(null);
  const [scopeBusy, setScopeBusy] = useState(false);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [calibRows, setCalibRows] = useState<CalibRow[]>(
    CALIBRATION_QUERIES.map((q) => ({
      query: q.text,
      subject: q.subject,
      status: "pending",
    })),
  );
  const [calibRunning, setCalibRunning] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email?.toLowerCase();
      if (!email || !ALLOWLIST.has(email)) {
        navigate({ to: "/biblioteca", replace: true });
        setAuthorized(false);
      } else {
        setAuthorized(true);
        setUserId(data.user!.id);
      }
    })();
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [{ data: bs }, { data: st }] = await Promise.all([
        supabase.from("library_books").select("id, title").eq("user_id", userId).order("title"),
        supabase.from("user_study_settings").select("rag_book_ids").eq("user_id", userId).maybeSingle(),
      ]);
      setBooks((bs ?? []) as BookRow[]);
      setActiveIds((st?.rag_book_ids as string[] | null) ?? []);
    })();
  }, [userId]);

  const doneCount = rows.filter((r) => r.status === "done" || r.status === "failed").length;

  const summary = useMemo(() => {
    const done = rows.filter((r) => r.status === "done" && r.matches.length > 0);
    const tops = done.map((r) => r.matches[0].similarity);
    const avg = tops.length ? tops.reduce((a, b) => a + b, 0) / tops.length : NaN;
    const min = tops.length ? Math.min(...tops) : NaN;
    const gt06 = tops.filter((s) => s > 0.6).length;
    const lt03 = tops.filter((s) => s < 0.3).length;
    return { avg, min, gt06, lt03, total: rows.length };
  }, [rows]);

  async function runAll() {
    setRunning(true);
    setRows((prev) =>
      prev.map((r) => ({ ...r, status: "running", matches: [], error: undefined })),
    );
    await Promise.all(
      TEST_QUERIES.map(async (q, idx) => {
        try {
          const res = await searchFn({ data: { query: q, matchCount: 5 } });
          const matches = (res?.matches ?? []) as Match[];
          setRows((prev) => {
            const next = [...prev];
            next[idx] = { query: q, status: "done", matches };
            return next;
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "erro";
          toast.error(`Falhou: ${truncate(q, 40)} — ${msg}`);
          setRows((prev) => {
            const next = [...prev];
            next[idx] = { query: q, status: "failed", matches: [], error: msg };
            return next;
          });
        }
      }),
    );
    setRunning(false);
  }

  function pickByRegex(list: BookRow[], re: RegExp): string | null {
    const hit = list.find((b) => re.test(b.title));
    return hit?.id ?? null;
  }

  async function applyScope(next: ScopeKey) {
    if (!userId) return;
    setScopeBusy(true);
    try {
      let ids: string[] = [];
      if (next === "7") {
        ids = books.map((b) => b.id);
      } else if (next === "1") {
        const geo = pickByRegex(books, /geograf/i);
        if (!geo) throw new Error("Livro de Geografia não encontrado");
        ids = [geo];
      } else {
        const geo = pickByRegex(books, /geograf/i);
        const mat = pickByRegex(books, /matem[aá]t/i);
        const port = pickByRegex(books, /portug/i);
        ids = [geo, mat, port].filter((x): x is string => !!x);
        if (ids.length === 0) throw new Error("Nenhum dos 3 livros encontrado");
      }
      const { error } = await supabase
        .from("user_study_settings")
        .upsert({ user_id: userId, rag_book_ids: ids }, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
      setActiveIds(ids);
      setScope(next);
      toast.success(`Escopo aplicado: ${ids.length} livro(s) ativo(s)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erro";
      toast.error(`Falhou ao aplicar escopo: ${msg}`);
    } finally {
      setScopeBusy(false);
    }
  }

  async function runCalibration() {
    setCalibRunning(true);
    setCalibRows((prev) =>
      prev.map((r) => ({ ...r, status: "running", match: undefined, error: undefined })),
    );
    await Promise.all(
      CALIBRATION_QUERIES.map(async (q, idx) => {
        try {
          const res = await searchFn({ data: { query: q.text, matchCount: 1 } });
          const matches = (res?.matches ?? []) as Match[];
          setCalibRows((prev) => {
            const next = [...prev];
            next[idx] = {
              query: q.text,
              subject: q.subject,
              status: "done",
              match: matches[0],
            };
            return next;
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "erro";
          setCalibRows((prev) => {
            const next = [...prev];
            next[idx] = {
              query: q.text,
              subject: q.subject,
              status: "failed",
              error: msg,
            };
            return next;
          });
        }
      }),
    );
    setCalibRunning(false);
  }

  const calibSummary = useMemo(() => {
    const finished = calibRows.filter((r) => r.status === "done");
    const classified = finished.map((r) => ({ row: r, kind: classifyOnTopic(r) }));
    const onTopic = classified.filter((c) => c.kind === "on");
    const offTopic = classified.filter((c) => c.kind === "off");
    const noMatch = finished.filter((r) => !r.match).length;

    const onGt06 = onTopic.filter((c) => (c.row.match?.similarity ?? 0) > 0.6).length;
    const offGt05 = offTopic.filter((c) => (c.row.match?.similarity ?? 0) > 0.5).length;

    const onScores = onTopic.map((c) => c.row.match!.similarity);
    const offScores = offTopic.map((c) => c.row.match!.similarity);
    const avgOn = onScores.length ? onScores.reduce((a, b) => a + b, 0) / onScores.length : NaN;
    const avgOff = offScores.length ? offScores.reduce((a, b) => a + b, 0) / offScores.length : NaN;
    const delta =
      Number.isFinite(avgOn) && Number.isFinite(avgOff) ? avgOn - avgOff : NaN;

    return {
      total: calibRows.length,
      onGt06,
      offGt05,
      noMatch,
      avgOn,
      avgOff,
      delta,
      onCount: onTopic.length,
      offCount: offTopic.length,
    };
  }, [calibRows]);

  const calibDone = calibRows.filter((r) => r.status === "done" || r.status === "failed").length;

  if (authorized === null) {
    return <div className="p-8 text-sm text-muted-foreground">Verificando acesso…</div>;
  }
  if (authorized === false) return null;

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">Diagnóstico do RAG — uso interno</h1>
        <p className="text-sm text-muted-foreground">
          5 consultas de teste para auditar a busca vetorial da biblioteca do aluno.
        </p>
      </header>

      <div className="flex items-center gap-3">
        <button
          onClick={runAll}
          disabled={running}
          className="px-5 py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
        >
          {running ? `Rodando… ${doneCount}/${TEST_QUERIES.length}` : "Rodar 5 consultas de teste"}
        </button>
        {running && (
          <span className="text-xs text-muted-foreground">
            Executando em paralelo…
          </span>
        )}
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left p-2">Pergunta</th>
              <th className="text-right p-2">Top</th>
              <th className="text-left p-2">Livro #1</th>
              <th className="text-right p-2">Pg</th>
              <th className="text-left p-2">Trecho #1</th>
              <th className="text-right p-2">Min top-5</th>
              <th className="text-right p-2">Média top-5</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const top = r.matches[0];
              const scores = r.matches.map((m) => m.similarity);
              const minTop = scores.length >= 1 ? Math.min(...scores) : null;
              const avgTop = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
              const n = scores.length;
              return (
                <Fragment key={i}>
                  <tr className="border-t border-border align-top">
                    <td className="p-2">{truncate(r.query, 60)}</td>
                    <td className="p-2 text-right font-mono">
                      {r.status === "running" ? "…" :
                        r.status === "failed" ? "falhou" :
                        top ? fmt(top.similarity) : "sem matches"}
                    </td>
                    <td className="p-2">{top ? meta(top, "bookTitle") : "—"}</td>
                    <td className="p-2 text-right">{top ? meta(top, "page") : "—"}</td>
                    <td className="p-2 text-muted-foreground">
                      {top ? truncate(top.content, 120) : "—"}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {n > 0 ? `${fmt(minTop!)} (n=${n})` : "—"}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {n > 0 ? `${fmt(avgTop!)} (n=${n})` : "—"}
                    </td>
                    <td className="p-2 text-right">
                      {r.matches.length > 0 && (
                        <button
                          onClick={() => setExpanded((e) => ({ ...e, [i]: !e[i] }))}
                          className="text-xs underline"
                        >
                          {expanded[i] ? "ocultar" : `ver todos os ${r.matches.length}`}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded[i] && (
                    <tr className="border-t border-border bg-muted/20">
                      <td colSpan={8} className="p-3">
                        <ol className="space-y-2 list-decimal list-inside">
                          {r.matches.map((m, j) => (
                            <li key={j} className="text-xs">
                              <span className="font-mono">{fmt(m.similarity)}</span>
                              {" · "}
                              <span className="font-medium">{meta(m, "bookTitle")}</span>
                              {" · pg "}
                              {meta(m, "page")}
                              <div className="text-muted-foreground mt-1 pl-4">
                                {truncate(m.content, 200)}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-border p-4 text-sm space-y-1 bg-muted/20">
        <div>Média geral dos top scores: <span className="font-mono">{fmt(summary.avg)}</span></div>
        <div>Mínimo geral: <span className="font-mono">{fmt(summary.min)}</span></div>
        <div>Perguntas com score &gt; 0.6: <span className="font-mono">{summary.gt06}/{summary.total}</span></div>
        <div>Perguntas com score &lt; 0.3: <span className="font-mono">{summary.lt03}/{summary.total}</span></div>
      </div>

      {/* =================== MODO 2: BATERIA DE CALIBRAÇÃO =================== */}
      <section className="space-y-4 pt-6 border-t border-border">
        <header>
          <h2 className="text-xl font-semibold">Bateria de calibração (15 queries)</h2>
          <p className="text-sm text-muted-foreground">
            5 matemática · 5 biologia · 5 história. Marca on-topic pelo título do livro do top-1.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Escopo:</span>
          <button
            disabled={scopeBusy}
            onClick={() => applyScope("1")}
            className={`px-3 py-1.5 rounded border text-xs ${scope === "1" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
          >
            1 livro (Geografia)
          </button>
          <button
            disabled={scopeBusy}
            onClick={() => applyScope("3")}
            className={`px-3 py-1.5 rounded border text-xs ${scope === "3" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
          >
            3 livros (Geo + Mat + Port)
          </button>
          <button
            disabled={scopeBusy}
            onClick={() => applyScope("7")}
            className={`px-3 py-1.5 rounded border text-xs ${scope === "7" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
          >
            Todos ({books.length} livros)
          </button>
          <span className="text-xs text-muted-foreground ml-2">
            Ativos agora: {activeIds.length}
          </span>
        </div>

        <div>
          <button
            onClick={runCalibration}
            disabled={calibRunning || activeIds.length === 0}
            className="px-5 py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
          >
            {calibRunning
              ? `Rodando… ${calibDone}/${CALIBRATION_QUERIES.length}`
              : "Rodar bateria de calibração (15 queries)"}
          </button>
          {activeIds.length === 0 && (
            <span className="ml-3 text-xs text-muted-foreground">
              Aplique um escopo antes de rodar.
            </span>
          )}
        </div>

        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left p-2">Matéria</th>
                <th className="text-left p-2">Pergunta</th>
                <th className="text-right p-2">Score top-1</th>
                <th className="text-left p-2">Livro</th>
                <th className="text-right p-2">Pg</th>
                <th className="text-center p-2">Classificação</th>
              </tr>
            </thead>
            <tbody>
              {calibRows.map((r, i) => {
                const kind = classifyOnTopic(r);
                const kindLabel =
                  r.status === "running"
                    ? "…"
                    : !r.match
                      ? "sem match"
                      : kind === "on"
                        ? "on-topic"
                        : kind === "off"
                          ? "off-topic (falso positivo)"
                          : "n/a";
                const kindColor =
                  kind === "on"
                    ? "text-emerald-500"
                    : kind === "off"
                      ? "text-rose-500"
                      : "text-muted-foreground";
                return (
                  <tr key={i} className="border-t border-border align-top">
                    <td className="p-2 uppercase text-xs text-muted-foreground">{r.subject}</td>
                    <td className="p-2">{truncate(r.query, 60)}</td>
                    <td className="p-2 text-right font-mono">
                      {r.status === "running"
                        ? "…"
                        : r.status === "failed"
                          ? "falhou"
                          : r.match
                            ? fmt(r.match.similarity)
                            : "sem matches"}
                    </td>
                    <td className="p-2">{r.match ? meta(r.match, "bookTitle") : "—"}</td>
                    <td className="p-2 text-right">{r.match ? meta(r.match, "page") : "—"}</td>
                    <td className={`p-2 text-center text-xs ${kindColor}`}>{kindLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-md border border-border p-4 text-sm space-y-1 bg-muted/20">
          <div>
            On-topic com score &gt; 0.6:{" "}
            <span className="font-mono">
              {calibSummary.onGt06}/{calibSummary.total}
            </span>{" "}
            <span className="text-xs text-muted-foreground">(n on-topic = {calibSummary.onCount})</span>
          </div>
          <div>
            Off-topic com score &gt; 0.5 (falso positivo):{" "}
            <span className="font-mono">
              {calibSummary.offGt05}/{calibSummary.total}
            </span>{" "}
            <span className="text-xs text-muted-foreground">(n off-topic = {calibSummary.offCount})</span>
          </div>
          <div>
            Sem matches:{" "}
            <span className="font-mono">
              {calibSummary.noMatch}/{calibSummary.total}
            </span>
          </div>
          <div>
            Média on-topic: <span className="font-mono">{fmt(calibSummary.avgOn)}</span>
          </div>
          <div>
            Média off-topic: <span className="font-mono">{fmt(calibSummary.avgOff)}</span>
          </div>
          <div>
            Delta (on − off): <span className="font-mono">{fmt(calibSummary.delta)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
