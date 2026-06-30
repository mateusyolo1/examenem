import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { correctEssay } from "@/lib/ai.functions";
import { useProgress } from "@/lib/storage";

const TEMA =
  "Caminhos para combater a insegurança alimentar no cenário brasileiro contemporâneo.";

export const Route = createFileRoute("/redacao")({
  head: () => ({
    meta: [
      { title: "Oficina de Redação — Exame ENEM" },
      {
        name: "description",
        content:
          "Envie sua redação e receba feedback instantâneo da IA, avaliada nas 5 competências do ENEM.",
      },
    ],
  }),
  component: Redacao,
});

function Redacao() {
  const { progress, update } = useProgress();
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = useServerFn(correctEssay);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  async function handle() {
    setError(null);
    setFeedback(null);
    if (text.trim().length < 50) {
      setError("Escreva ao menos 50 caracteres antes de enviar.");
      return;
    }
    setLoading(true);
    try {
      const res = await submit({ data: { theme: TEMA, text } });
      setFeedback(res.feedback);
      update((p) => ({
        ...p,
        essays: [
          ...p.essays,
          { id: crypto.randomUUID(), theme: TEMA, text, feedback: res.feedback, at: Date.now() },
        ],
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("429")) {
        setError("Muitas requisições. Tente novamente em instantes.");
      } else if (msg.includes("402")) {
        setError("Créditos de IA esgotados. Adicione créditos ao workspace.");
      } else {
        setError("Não foi possível corrigir agora. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10 border-b border-border pb-6 flex justify-between items-end">
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

        <div className="mb-8 p-6 bg-card border-l-2 border-primary border border-border">
          <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-2">
            Tema da Semana
          </span>
          <p className="font-bold text-lg leading-tight tracking-tight">{TEMA}</p>
        </div>

        <div className="border border-border bg-card">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Comece sua dissertação argumentativa aqui..."
            className="w-full min-h-[400px] p-6 bg-transparent resize-y outline-none font-sans text-base leading-relaxed placeholder:text-muted-foreground"
          />
          <div className="flex justify-between items-center px-6 py-3 border-t border-border font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <span>{words} palavras</span>
            <span>Recomendado: 250–350 palavras</span>
          </div>
        </div>

        {error && (
          <div className="mt-6 p-4 border border-destructive bg-destructive/10 text-destructive text-sm font-mono">
            {error}
          </div>
        )}

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={() => setText("")}
            disabled={loading}
            className="px-6 py-3 border border-border font-bold text-xs uppercase tracking-widest hover:border-foreground transition-all disabled:opacity-30"
          >
            Limpar
          </button>
          <button
            onClick={handle}
            disabled={loading}
            className="px-8 py-3 bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-primary transition-all disabled:opacity-50"
          >
            {loading ? "Corrigindo..." : "Corrigir com IA"}
          </button>
        </div>

        {feedback && (
          <section className="mt-12 border border-border bg-card p-8 md:p-10">
            <div className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-6">
              Feedback da IA
            </div>
            <Markdown text={feedback} />
          </section>
        )}

        {progress.essays.length > 0 && (
          <section className="mt-16">
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-4 mb-6">
              Suas Redações Anteriores
            </h2>
            <div className="space-y-2">
              {[...progress.essays].reverse().slice(0, 5).map((e) => (
                <details
                  key={e.id}
                  className="border border-border bg-card p-4 group"
                >
                  <summary className="cursor-pointer flex justify-between items-center font-mono text-xs uppercase tracking-widest">
                    <span className="text-muted-foreground">
                      {new Date(e.at).toLocaleString("pt-BR")}
                    </span>
                    <span>{e.text.trim().split(/\s+/).length} palavras</span>
                  </summary>
                  <div className="mt-4 pt-4 border-t border-border space-y-4">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{e.text}</p>
                    {e.feedback && (
                      <div className="pt-4 border-t border-border">
                        <Markdown text={e.feedback} />
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

// Minimal Markdown renderer (headings, lists, bold) — avoids extra dependency.
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuf: string[] = [];
  const flushList = (key: number) => {
    if (listBuf.length === 0) return;
    out.push(
      <ul key={`ul-${key}`} className="list-disc pl-6 space-y-1 my-3 text-sm leading-relaxed">
        {listBuf.map((li, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: inline(li) }} />
        ))}
      </ul>,
    );
    listBuf = [];
  };
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flushList(i);
      out.push(
        <h2 key={i} className="text-2xl font-extrabold tracking-tighter mt-6 mb-2">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      flushList(i);
      out.push(
        <h3
          key={i}
          className="text-sm font-mono uppercase tracking-widest text-primary mt-5 mb-1"
        >
          {line.slice(4)}
        </h3>,
      );
    } else if (line.startsWith("- ")) {
      listBuf.push(line.slice(2));
    } else if (line.trim() === "") {
      flushList(i);
    } else {
      flushList(i);
      out.push(
        <p
          key={i}
          className="text-sm leading-relaxed my-2"
          dangerouslySetInnerHTML={{ __html: inline(line) }}
        />,
      );
    }
  });
  flushList(lines.length);
  return <div>{out}</div>;
}

function inline(s: string) {
  const esc = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
