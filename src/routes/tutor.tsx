import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { askTutor } from "@/lib/ai.functions";

type Msg = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/tutor")({
  head: () => ({
    meta: [
      { title: "Tutor IA — Exame ENEM" },
      {
        name: "description",
        content:
          "Tire dúvidas das 4 áreas do ENEM com um tutor de IA em português. Explicações didáticas, passo a passo.",
      },
    ],
  }),
  component: Tutor,
});

const SUGGESTIONS = [
  "Explique a Lei dos Senos com um exemplo prático.",
  "Como interpretar gráficos de funções no ENEM?",
  "Qual a diferença entre metáfora e metonímia?",
  "Resuma o processo de fotossíntese em 5 linhas.",
];

function Tutor() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const ask = useServerFn(askTutor);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(content?: string) {
    const text = (content ?? input).trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await ask({ data: { messages: next } });
      setMessages([...next, { role: "assistant", content: res.text }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      let userMsg = "Não consegui responder agora. Tente novamente.";
      if (msg.includes("429")) userMsg = "Muitas requisições. Aguarde um momento.";
      if (msg.includes("402")) userMsg = "Créditos de IA esgotados.";
      setMessages([...next, { role: "assistant", content: `_${userMsg}_` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <Nav />
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 flex flex-col">
        <header className="mb-8 border-b border-border pb-6 flex justify-between items-end">
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Tutor IA
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">
              Pergunte. Aprenda.
            </h1>
          </div>
          <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-bold text-primary uppercase tracking-wider font-mono">
              Online
            </span>
          </div>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 border border-border bg-card p-6 overflow-y-auto min-h-[400px] max-h-[60vh] space-y-6"
        >
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm mb-6 font-mono uppercase tracking-widest">
                Comece com uma das sugestões:
              </p>
              <div className="grid sm:grid-cols-2 gap-2 max-w-2xl mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left p-4 border border-border hover:border-foreground transition-all text-sm leading-relaxed"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={
                "flex " + (m.role === "user" ? "justify-end" : "justify-start")
              }
            >
              <div
                className={
                  "max-w-[85%] p-4 text-sm leading-relaxed whitespace-pre-wrap " +
                  (m.role === "user"
                    ? "bg-foreground text-background"
                    : "bg-background border border-border")
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-background border border-border p-4 text-sm font-mono text-muted-foreground">
                Pensando<span className="animate-pulse">...</span>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="mt-4 flex gap-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua dúvida..."
            disabled={loading}
            className="flex-1 px-4 py-3 border border-border bg-card outline-none focus:border-foreground transition-all text-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-6 py-3 bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-primary transition-all disabled:opacity-30"
          >
            Enviar
          </button>
        </form>
      </main>
      <Footer />
    </div>
  );
}
