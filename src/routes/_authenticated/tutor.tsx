import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Nav } from "@/components/Nav";
import { HintCoach, type HintDef } from "@/components/HintCoach";
import { Footer } from "@/components/Footer";
import { Markdown } from "@/components/Markdown";
import { CurrentStageCard } from "@/components/CurrentStageCard";
import { TutorToolCard } from "@/components/TutorToolCard";
import { askTutor, type TutorToolResult } from "@/lib/ai.functions";
import { useProgress, AREAS, areaStats, daysUntilExam, answersToday, type Area } from "@/lib/storage";
import { QUESTION_AREA_MAP } from "@/lib/questions-data";
import { getExamOption } from "@/lib/exams";
import {
  useActiveLearning,
  evaluateAdvance,
  LEARNING_STAGES,
} from "@/lib/learning-progress";

type Msg = {
  role: "user" | "assistant";
  content: string;
  toolResults?: TutorToolResult[];
};
type Mode =
  | "livre"
  | "explicar"
  | "resolver"
  | "plano"
  | "redacao"
  | "revisao"
  | "questoes"
  | "erro";

const HISTORY_KEY = "exame:tutor:history:v2";

const TUTOR_HINTS: HintDef[] = [
  {
    key: "tutor.lousa.v1",
    targetSelector: '[data-hint="tutor.lousa"]',
    title: "Lousa Interativa",
    description:
      "Abre a Lousa: pratique lendo, ouvindo, escrevendo e ensinando. Quadro branco ou negro com fontes de giz e lápis.",
  },
];

export const Route = createFileRoute("/_authenticated/tutor")({
  validateSearch: (search: Record<string, unknown>) =>
    z
      .object({
        prompt: z.string().max(2000).optional(),
        autoSend: z.boolean().optional(),
      })
      .parse(search),
  head: () => ({
    meta: [
      { title: "Tutor IA — Professor particular de ENEM" },
      {
        name: "description",
        content:
          "Professor particular de IA para o ENEM: explica conteúdo, resolve questões passo a passo, monta plano de estudos, corrige redação e mais.",
      },
    ],
  }),
  component: Tutor,
});

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "livre", label: "Livre", hint: "Pergunte qualquer dúvida" },
  { id: "explicar", label: "Explicar conteúdo", hint: "Aula sobre um tema" },
  { id: "resolver", label: "Resolver questão", hint: "Passo a passo" },
  { id: "plano", label: "Plano de estudos", hint: "Roteiro personalizado" },
  { id: "redacao", label: "Corrigir redação", hint: "5 competências" },
  { id: "revisao", label: "Revisão rápida", hint: "Resumo + autoteste" },
  { id: "questoes", label: "Criar questões", hint: "No estilo ENEM" },
  { id: "erro", label: "Explicar erro", hint: "Por que eu errei?" },
];

const SUGGESTIONS_BY_MODE: Record<Mode, string[]> = {
  livre: [
    "Explique esse assunto como se eu fosse iniciante",
    "Me faça 5 perguntas sobre esse tema",
    "Crie um resumo para revisão",
    "Monte um plano de 7 dias",
    "Explique por que errei essa questão",
    "Me dê repertórios para redação",
  ],
  explicar: [
    "Explique funções do 2º grau como se eu fosse iniciante",
    "Explique a Revolução Industrial em 5 tópicos",
    "Explique figuras de linguagem com exemplos",
    "Explique leis de Newton com analogias",
  ],
  resolver: [
    "Resolva: 'Se 2x + 3 = 11, qual o valor de x²?'",
    "Resolva passo a passo uma questão de interpretação textual",
    "Resolva uma questão de estequiometria com 0,5 mol de O₂",
  ],
  plano: [
    "Monte um plano de 7 dias com 2h por dia",
    "Plano de 30 dias focando em Matemática e Natureza",
    "Cronograma de revisão para a última semana antes do ENEM",
  ],
  redacao: [
    "Corrija minha redação sobre desinformação",
    "Quais repertórios usar sobre meio ambiente?",
    "Como melhorar a proposta de intervenção?",
  ],
  revisao: [
    "Revisão rápida de mitose e meiose",
    "Resumo relâmpago da Era Vargas",
    "Resumo de funções exponenciais com fórmulas",
  ],
  questoes: [
    "Crie 5 questões sobre genética mendeliana",
    "Crie 3 questões de interpretação sobre charges",
    "Crie 5 questões de porcentagem no estilo ENEM",
  ],
  erro: [
    "Errei uma questão sobre logaritmos — me explique o conceito",
    "Errei em concordância verbal — onde costumo confundir?",
    "Por que errei essa questão de termoquímica?",
  ],
};

function loadHistory(): Msg[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function Tutor() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("livre");
  const [useContext, setUseContext] = useState(true);
  const [timeAvail, setTimeAvail] = useState("2h por dia");
  const ask = useServerFn(askTutor);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { progress } = useProgress();
  const activeLearning = useActiveLearning();

  useEffect(() => {
    setMessages(loadHistory());
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode, loading]);

  const studentContext = useMemo(() => {
    const lines: string[] = [];
    const examLabel = progress.examName || getExamOption(progress.examId).label;
    lines.push(`Meta diária: ${progress.dailyGoal} questões`);
    lines.push(`Respondidas hoje: ${answersToday(progress)}`);
    lines.push(`Sequência de estudos: ${progress.streakDays} dia(s)`);
    lines.push(`Prova alvo: ${examLabel}`);
    lines.push(`Dias até a prova: ${daysUntilExam(progress.examDate)}`);
    lines.push(`Tempo disponível informado: ${timeAvail}`);

    const stats = AREAS.map((a) => {
      const s = areaStats(progress, a.id as Area, QUESTION_AREA_MAP);
      return { area: a.short, ...s };
    }).filter((s) => s.total > 0);
    if (stats.length) {
      lines.push("Desempenho por área:");
      stats
        .sort((a, b) => a.accuracy - b.accuracy)
        .forEach((s) =>
          lines.push(`- ${s.area}: ${s.correct}/${s.total} (${s.accuracy}%)`),
        );
      const worst = stats[0];
      if (worst) lines.push(`Área com mais erros: ${worst.area}`);
    }

    if (progress.simulados.length) {
      const last = progress.simulados.slice(-3).reverse();
      lines.push(`Simulados feitos: ${progress.simulados.length}`);
      last.forEach((s) =>
        lines.push(
          `- ${new Date(s.at).toLocaleDateString("pt-BR")}: ${s.score}/${s.total}${s.mode ? ` (${s.mode})` : ""}`,
        ),
      );
    }

    if (progress.essays.length) {
      const last = progress.essays[progress.essays.length - 1];
      const f = (last.feedback ?? {}) as { notaFinal?: number };
      lines.push(
        `Última redação: "${last.theme}"${f?.notaFinal ? ` — nota ${f.notaFinal}/1000` : ""}`,
      );
    }

    return lines.join("\n");
  }, [progress, timeAvail]);

  async function send(content?: string) {
    const text = (content ?? input).trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const stagePayload = activeLearning
        ? (() => {
            const crit = evaluateAdvance(activeLearning);
            const atual = LEARNING_STAGES.find((s) => s.id === activeLearning.etapaAtual);
            const prox = LEARNING_STAGES.find((s) => s.id === activeLearning.etapaAtual + 1);
            return {
              assunto: activeLearning.assunto,
              etapaAtual: activeLearning.etapaAtual,
              etapaAtualLabel: atual?.label ?? String(activeLearning.etapaAtual),
              proximaEtapaLabel: prox?.label,
              prontoParaAvancar: activeLearning.prontoParaAvancar,
              faltam: crit.faltam,
              taxaDeAcerto: activeLearning.taxaDeAcerto,
              questoesRespondidas: activeLearning.questoesRespondidas,
              revisoesPendentes: activeLearning.revisoesPendentes,
            };
          })()
        : undefined;
      const res = await ask({
        data: {
          messages: next.slice(-20).map((m) => ({ role: m.role, content: m.content })),
          mode,
          context: useContext ? studentContext : undefined,
          stage: stagePayload,
        },
      });
      setMessages([
        ...next,
        {
          role: "assistant",
          content: res.text,
          toolResults: res.toolResults?.length ? res.toolResults : undefined,
        },
      ]);
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

  function clearHistory() {
    if (!confirm("Apagar todo o histórico desta conversa?")) return;
    setMessages([]);
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <Nav />
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 flex flex-col">
        <header className="mb-6 border-b border-border pb-6 flex flex-wrap justify-between items-end gap-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Tutor IA
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mt-2">
              Seu professor particular de ENEM.
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Escolha um modo, faça sua pergunta e use seu próprio desempenho como contexto.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-bold text-primary uppercase tracking-wider font-mono">
              Online
            </span>
          </div>
        </header>

        <Link
          to="/lousa"
          data-hint="tutor.lousa"
          className="mb-6 group relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 flex items-center justify-between hover:border-primary transition-colors"
        >
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-primary">Novidade</div>
            <div className="text-lg font-bold mt-1">Lousa Interativa — pratique como se estivesse em aula</div>
            <div className="text-sm text-muted-foreground mt-1">
              Ler, ouvir, escrever, praticar e ensinar. Quadro branco ou negro, com fontes de giz e lápis.
            </div>
          </div>
          <span className="text-primary text-2xl font-bold group-hover:translate-x-1 transition-transform">→</span>
        </Link>

        <div className="grid lg:grid-cols-[260px_1fr] gap-6 flex-1">
          {/* Sidebar */}
          <aside className="space-y-6">
            <CurrentStageCard />
            <section>
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                Modos
              </h2>
              <div className="grid gap-1.5">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={
                      "text-left p-3 border transition-all " +
                      (mode === m.id
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground")
                    }
                  >
                    <div className="text-sm font-bold">{m.label}</div>
                    <div
                      className={
                        "text-[11px] mt-0.5 " +
                        (mode === m.id ? "text-background/70" : "text-muted-foreground")
                      }
                    >
                      {m.hint}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="border border-border p-4">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                Contexto do aluno
              </h2>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useContext}
                  onChange={(e) => setUseContext(e.target.checked)}
                />
                Usar meu desempenho
              </label>
              <label className="block mt-3 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Tempo disponível
              </label>
              <input
                value={timeAvail}
                onChange={(e) => setTimeAvail(e.target.value)}
                className="mt-1 w-full px-2 py-1.5 text-sm border border-border bg-background"
                placeholder="2h por dia"
              />
              {useContext && (
                <pre className="mt-3 text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto font-mono">
                  {studentContext}
                </pre>
              )}
            </section>

            <button
              onClick={clearHistory}
              className="w-full text-xs font-mono uppercase tracking-widest py-2 border border-border hover:border-destructive hover:text-destructive transition-all"
            >
              Limpar histórico
            </button>
          </aside>

          {/* Chat */}
          <section className="flex flex-col">
            <div
              ref={scrollRef}
              className="flex-1 border border-border bg-card p-6 overflow-y-auto min-h-[400px] max-h-[60vh] space-y-6"
            >
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm mb-4 font-mono uppercase tracking-widest">
                    Sugestões rápidas
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2 max-w-2xl mx-auto">
                    {SUGGESTIONS_BY_MODE[mode].map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="text-left p-3 border border-border hover:border-foreground transition-all text-sm leading-relaxed"
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
                  className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={
                      "max-w-[85%] " +
                      (m.role === "user"
                        ? "p-4 rounded-lg bg-foreground text-background text-sm leading-relaxed whitespace-pre-wrap"
                        : "space-y-3")
                    }
                  >
                    {m.role === "user" ? (
                      m.content
                    ) : (
                      <>
                        {m.toolResults?.map((tr, ti) => (
                          <TutorToolCard key={ti} result={tr} />
                        ))}
                        {m.content && (
                          <div className="p-4 rounded-lg bg-background border border-border">
                            <Markdown>{m.content}</Markdown>
                          </div>
                        )}
                      </>
                    )}
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

            {messages.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTIONS_BY_MODE[mode].slice(0, 4).map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={loading}
                    className="text-xs px-3 py-1.5 border border-border hover:border-foreground transition-all disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="mt-3 flex gap-3 items-end"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder={`Modo: ${MODES.find((m) => m.id === mode)?.label}. Digite sua mensagem... (Enter envia, Shift+Enter quebra linha)`}
                disabled={loading}
                className="flex-1 resize-none px-4 py-3 border border-border bg-card outline-none focus:border-foreground transition-all text-sm disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-primary transition-all disabled:opacity-30"
              >
                Enviar
              </button>
            </form>
          </section>
        </div>
      </main>
      <Footer />
      <HintCoach hints={TUTOR_HINTS} />
    </div>
  );
}
