import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { correctEssay, type EssayFeedback } from "@/lib/ai.functions";
import { useProgress } from "@/lib/storage";
import { findTheme } from "@/lib/essay-themes";

const TEMA_PADRAO =
  "Caminhos para combater a insegurança alimentar no cenário brasileiro contemporâneo.";

const DRAFT_KEY = "exame:redacao:draft";
const CHARS_PER_LINE = 70; // aprox. linhas da folha oficial

const searchSchema = z.object({ tema: z.string().optional() });

export const Route = createFileRoute("/redacao")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Oficina de Redação — Exame ENEM" },
      {
        name: "description",
        content:
          "Escreva sua redação, salve rascunhos e receba correção didática da IA nas 5 competências do ENEM.",
      },
    ],
  }),
  component: Redacao,
});

function Redacao() {
  const { progress, update } = useProgress();
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<EssayFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const submit = useServerFn(correctEssay);

  // Load draft once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as { text: string; at: number };
        if (d.text) {
          setText(d.text);
          setSavedAt(d.at);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const words = useMemo(
    () => (text.trim() ? text.trim().split(/\s+/).length : 0),
    [text],
  );
  const lines = Math.max(0, Math.ceil(text.length / CHARS_PER_LINE));
  const chars = text.length;

  function saveDraft() {
    const at = Date.now();
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ text, at }));
    setSavedAt(at);
  }

  async function handleCorrect() {
    setError(null);
    setFeedback(null);
    if (text.trim().length < 50) {
      setError("Escreva ao menos 50 caracteres antes de enviar para correção.");
      return;
    }
    setLoading(true);
    try {
      const res = await submit({ data: { theme: TEMA, text } });
      const fb = res.feedback as EssayFeedback;
      setFeedback(fb);
      update((p) => ({
        ...p,
        essays: [
          ...p.essays,
          { id: crypto.randomUUID(), theme: TEMA, text, feedback: fb, at: Date.now() },
        ],
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("429")) setError("Muitas requisições. Tente novamente em instantes.");
      else if (msg.includes("402")) setError("Créditos de IA esgotados. Adicione créditos ao workspace.");
      else setError("Não foi possível corrigir agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-8 border-b border-border pb-6 flex justify-between items-end flex-wrap gap-3">
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Oficina de Redação
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">
              Corrigida por IA.
            </h1>
          </div>
          <div className="bg-foreground text-background px-3 py-1 rounded-sm flex items-center gap-2">
            <span className="size-1.5 bg-primary rounded-full" />
            <span className="text-[10px] font-mono uppercase">5 Competências</span>
          </div>
        </header>

        {/* Tema da semana */}
        <div className="mb-6 p-6 bg-card border-l-2 border-primary border border-border">
          <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-2">
            Tema da semana
          </span>
          <p className="font-bold text-lg leading-tight tracking-tight">{TEMA}</p>
        </div>

        {/* Editor */}
        <div className="border border-border bg-card">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Comece sua dissertação argumentativa aqui..."
            className="w-full min-h-[420px] p-6 bg-transparent resize-y outline-none font-sans text-base leading-relaxed placeholder:text-muted-foreground"
          />
          <div className="flex flex-wrap justify-between items-center gap-3 px-6 py-3 border-t border-border font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <div className="flex gap-4">
              <span>{words} palavras</span>
              <span>~{lines} linhas</span>
              <span className="hidden md:inline">{chars} caracteres</span>
            </div>
            <span>Recomendado: 7–30 linhas · 250–350 palavras</span>
          </div>
        </div>

        {savedAt && (
          <div className="mt-2 text-[11px] font-mono text-muted-foreground">
            Rascunho salvo {new Date(savedAt).toLocaleString("pt-BR")}
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 border border-destructive bg-destructive/10 text-destructive text-sm font-mono">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            onClick={() => {
              setText("");
              localStorage.removeItem(DRAFT_KEY);
              setSavedAt(null);
            }}
            disabled={loading}
            className="px-5 py-3 border border-border font-bold text-xs uppercase tracking-widest hover:border-foreground transition-all disabled:opacity-30"
          >
            Limpar
          </button>
          <button
            onClick={saveDraft}
            disabled={loading || !text.trim()}
            className="px-5 py-3 border border-border font-bold text-xs uppercase tracking-widest hover:border-foreground transition-all disabled:opacity-30"
          >
            Salvar rascunho
          </button>
          <button
            onClick={handleCorrect}
            disabled={loading}
            className="px-8 py-3 bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-primary transition-all disabled:opacity-50"
          >
            {loading ? "Corrigindo..." : "Corrigir redação"}
          </button>
        </div>

        {loading && (
          <div className="mt-10 border border-border bg-card p-8 text-center text-sm text-muted-foreground font-mono">
            Analisando sua redação nas 5 competências…
          </div>
        )}

        {feedback && <FeedbackView fb={feedback} />}

        {progress.essays.length > 0 && (
          <section className="mt-16">
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-4 mb-6">
              Suas redações anteriores
            </h2>
            <div className="space-y-2">
              {[...progress.essays].reverse().slice(0, 8).map((e) => {
                const fb = e.feedback as EssayFeedback | undefined;
                return (
                  <details key={e.id} className="border border-border bg-card p-4 group">
                    <summary className="cursor-pointer flex justify-between items-center font-mono text-xs uppercase tracking-widest gap-3">
                      <span className="text-muted-foreground truncate">
                        {new Date(e.at).toLocaleString("pt-BR")}
                      </span>
                      <span className="flex items-center gap-3">
                        {fb?.notaFinal != null && (
                          <span className="text-primary font-bold">{fb.notaFinal}/1000</span>
                        )}
                        <span>{e.text.trim().split(/\s+/).length} palavras</span>
                      </span>
                    </summary>
                    <div className="mt-4 pt-4 border-t border-border space-y-4">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{e.text}</p>
                      {fb && (
                        <div className="pt-4 border-t border-border">
                          <FeedbackView fb={fb} compact />
                        </div>
                      )}
                    </div>
                  </details>
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

// -------- Feedback view --------
function FeedbackView({ fb, compact = false }: { fb: EssayFeedback; compact?: boolean }) {
  if (fb.raw) {
    return (
      <section className="mt-10 border border-border bg-card p-6">
        <div className="text-xs font-mono uppercase text-muted-foreground mb-3">
          Feedback da IA
        </div>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{fb.raw}</p>
      </section>
    );
  }

  const nota = fb.notaFinal ?? 0;
  const competencias = fb.competencias ?? [];
  const repertorios = fb.repertorios ?? [];

  return (
    <section className={compact ? "space-y-6" : "mt-12 space-y-8"}>
      {/* Nota final + diagnóstico */}
      {!compact && (
        <div className="border border-border bg-card p-8 flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Nota final
            </div>
            <div className="text-6xl md:text-7xl font-extrabold tracking-tighter text-primary mt-1">
              {nota}
              <span className="text-2xl text-muted-foreground font-mono">/1000</span>
            </div>
          </div>
          <ScoreBar value={nota} max={1000} />
        </div>
      )}

      {fb.diagnosticoGeral && (
        <div className="border-l-2 border-primary bg-primary/5 p-5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-primary mb-2">
            Diagnóstico geral
          </div>
          <p className="text-sm leading-relaxed">{fb.diagnosticoGeral}</p>
        </div>
      )}

      {/* Competências */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-3">
          Competências
        </h3>
        {competencias.map((c) => (
          <details key={c.numero} className="border border-border bg-card p-5 group" open={!compact}>
            <summary className="cursor-pointer flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <span className="text-[10px] font-mono uppercase text-muted-foreground">
                  C{c.numero}
                </span>
                <span className="font-bold tracking-tight">{c.titulo}</span>
              </div>
              <div className="flex items-center gap-3 min-w-[160px]">
                <ScoreBar value={c.nota} max={200} />
                <span className="font-mono text-sm font-bold text-primary shrink-0">
                  {c.nota}/200
                </span>
              </div>
            </summary>

            <div className="mt-4 pt-4 border-t border-border space-y-4 text-sm">
              <p className="leading-relaxed">{c.comentario}</p>

              {c.pontosFortes?.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase text-emerald-600 dark:text-emerald-400 mb-1">
                    Pontos fortes
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {c.pontosFortes.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}

              {c.pontosMelhorar?.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase text-amber-600 dark:text-amber-400 mb-1">
                    Pontos a melhorar
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {c.pontosMelhorar.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}

              {c.sugestaoReescrita && (
                <div className="border-l-2 border-primary pl-3">
                  <div className="text-[10px] font-mono uppercase text-primary mb-1">
                    Sugestão de reescrita
                  </div>
                  <p className="italic leading-relaxed">{c.sugestaoReescrita}</p>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>

      {/* Repertórios */}
      {repertorios.length > 0 && (
        <div>
          <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-3 mb-3">
            Repertórios possíveis para o tema
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {repertorios.map((r, i) => (
              <div key={i} className="border border-border bg-card p-4">
                <div className="font-bold tracking-tight">{r.titulo}</div>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{r.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nova versão */}
      {fb.novaVersao && (
        <div>
          <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-3 mb-3">
            Sugestão de nova versão
          </h3>
          <div className="border border-border bg-card p-6">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{fb.novaVersao}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function ScoreBar({ value, max }: { value: number; max: number }) {
  const p = Math.max(0, Math.min(100, (value / max) * 100));
  const color =
    p >= 80 ? "bg-emerald-500" : p >= 60 ? "bg-primary" : p >= 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="h-1.5 w-full max-w-[200px] bg-border overflow-hidden">
      <div className={"h-full " + color} style={{ width: `${p}%` }} />
    </div>
  );
}
