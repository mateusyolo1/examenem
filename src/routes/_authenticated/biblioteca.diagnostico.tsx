import { Fragment, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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

function DiagnosticoPage() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<null | boolean>(null);
  const [rows, setRows] = useState<RowState[]>(
    TEST_QUERIES.map((q) => ({ query: q, status: "pending", matches: [] })),
  );
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const searchFn = useServerFn(searchLibrary);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email?.toLowerCase();
      if (!email || !ALLOWLIST.has(email)) {
        navigate({ to: "/biblioteca", replace: true });
        setAuthorized(false);
      } else {
        setAuthorized(true);
      }
    })();
  }, [navigate]);

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

  if (authorized === null) {
    return <div className="p-8 text-sm text-muted-foreground">Verificando acesso…</div>;
  }
  if (authorized === false) return null;

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
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
              const hasFull = scores.length >= 5 ? true : false;
              return (
                <React.Fragment key={i}>
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
                      {hasFull ? fmt(minTop!) : "—"}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {hasFull ? fmt(avgTop!) : "—"}
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
                </React.Fragment>
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
    </div>
  );
}
