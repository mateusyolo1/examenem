import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  RefreshCcw,
  Sun,
  Moon,
  Volume2,
  MessageCircleQuestion,
  BookOpen,
  Search,
  Lightbulb,
  Languages,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/lousa")({
  head: () => ({
    meta: [
      { title: "Lousa Interativa — Tutor IA" },
      {
        name: "description",
        content:
          "Lousa interativa do Tutor IA para praticar em tempo real: leia, ouça, escreva, pratique e ensine.",
      },
    ],
  }),
  component: LousaPage,
});

type BoardMode = "white" | "dark";

type Exercise = {
  enunciado: string;
  resposta: string;
  comentario: string;
};

type LousaContent = {
  materia: string;
  tema: string;
  resumo: string[];
  exercicios: Exercise[];
  desafioEnsinar: { pergunta: string; respostaModelo: string };
};

const MOCK: LousaContent = {
  materia: "Matemática",
  tema: "Função afim — coeficientes e gráfico",
  resumo: [
    "Uma função afim tem a forma f(x) = ax + b, com a ≠ 0.",
    "O coeficiente a é a taxa de variação (inclinação da reta).",
    "O coeficiente b é o valor de f(0) — onde a reta cruza o eixo y.",
    "Se a > 0, a função é crescente. Se a < 0, decrescente.",
  ],
  exercicios: [
    {
      enunciado: "Dada f(x) = 3x − 5, calcule f(2).",
      resposta: "f(2) = 3·2 − 5 = 1.",
      comentario: "Substituição direta. Cuidado com o sinal do −5.",
    },
    {
      enunciado: "Qual o coeficiente angular de f(x) = −2x + 7?",
      resposta: "a = −2 (função decrescente).",
      comentario: "O coeficiente angular é sempre o número que acompanha o x.",
    },
    {
      enunciado: "Em que ponto a reta y = 4x − 8 corta o eixo x?",
      resposta: "x = 2, pois 4x − 8 = 0 ⇒ x = 2.",
      comentario: "Raiz da função afim: iguale a expressão a zero.",
    },
  ],
  desafioEnsinar: {
    pergunta: "Explique com suas palavras o que muda no gráfico se aumentarmos o valor de b.",
    respostaModelo:
      "A reta é deslocada verticalmente para cima (b maior) sem mudar a inclinação. O coeficiente a controla o ângulo; b controla a altura em que ela cruza o eixo y.",
  },
};

const STAGES = ["Ler", "Ouvir", "Escrever", "Praticar", "Ensinar"] as const;
type Stage = (typeof STAGES)[number];

function LousaPage() {
  const [mode, setMode] = useState<BoardMode>("white");
  const [done, setDone] = useState<Record<Stage, boolean>>({
    Ler: false,
    Ouvir: false,
    Escrever: false,
    Praticar: false,
    Ensinar: false,
  });
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [teachAnswer, setTeachAnswer] = useState("");
  const [teachRevealed, setTeachRevealed] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const [panel, setPanel] = useState<{
    action: "ask" | "source" | "learn" | "example" | "translate";
    text: string;
  } | null>(null);
  const content = MOCK;

  const onSelectionContextMenu = (e: React.MouseEvent) => {
    const sel = typeof window !== "undefined" ? window.getSelection()?.toString().trim() : "";
    if (!sel) return; // permite menu nativo quando não há seleção
    e.preventDefault();
    const pad = 8;
    const maxX = window.innerWidth - 260 - pad;
    const maxY = window.innerHeight - 240 - pad;
    setMenu({
      x: Math.min(e.clientX, Math.max(pad, maxX)),
      y: Math.min(e.clientY, Math.max(pad, maxY)),
      text: sel,
    });
  };

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("mousedown", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("mousedown", close);
    };
  }, [menu]);

  const isDark = mode === "dark";
  const bg = isDark ? "#051900" : "#fafafa";
  const grain = isDark
    ? "radial-gradient(circle at 30% 20%, rgba(255,255,255,.06), transparent 60%), radial-gradient(circle at 70% 80%, rgba(255,255,255,.04), transparent 55%)"
    : "radial-gradient(circle at 30% 20%, rgba(0,0,0,.03), transparent 60%), radial-gradient(circle at 70% 80%, rgba(0,0,0,.02), transparent 55%)";
  const fontWrite = isDark
    ? '"LousaWriteDark", cursive'
    : '"LousaWriteLight", cursive';
  const fontTitle = isDark
    ? '"LousaTitleDark", cursive'
    : '"LousaTitleLight", cursive';
  const cQuestion = isDark ? "#7dd3fc" : "#1d4ed8"; // azul
  const cAnswer = isDark ? "#fca5a5" : "#dc2626"; // vermelho
  const cText = isDark ? "#f3f4f6" : "#111827";
  const cMuted = isDark ? "rgba(243,244,246,.55)" : "rgba(17,24,39,.55)";
  const cBorder = isDark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.10)";

  const markDone = (s: Stage) => setDone((d) => ({ ...d, [s]: true }));

  const speak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
    markDone("Ouvir");
  };

  return (
    <div
      className="min-h-screen w-full transition-colors"
      style={{ background: bg, color: cText, backgroundImage: grain }}
      onContextMenu={onSelectionContextMenu}
    >
      {/* Barra superior */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 backdrop-blur"
        style={{
          background: isDark ? "rgba(5,25,0,.75)" : "rgba(250,250,250,.75)",
          borderBottom: `1px solid ${cBorder}`,
        }}
      >
        <Link
          to="/tutor"
          className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100"
        >
          <ArrowLeft size={16} /> Voltar ao Tutor
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode((m) => (m === "white" ? "dark" : "white"))}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: cBorder }}
            title="Alternar quadro branco / quadro negro"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
            {isDark ? "Quadro Branco" : "Quadro Negro"}
          </button>
          <button
            type="button"
            onClick={() => {
              setRevealed({});
              setAnswers({});
              setTeachAnswer("");
              setTeachRevealed(false);
              setDone({ Ler: false, Ouvir: false, Escrever: false, Praticar: false, Ensinar: false });
            }}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: cBorder }}
          >
            <RefreshCcw size={14} /> Nova lousa
          </button>
        </div>
      </div>

      {/* Selos das etapas */}
      <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-10 xl:px-16 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          {STAGES.map((s) => (
            <span
              key={s}
              className="rounded-full px-3 py-1 text-xs"
              style={{
                border: `1px solid ${cBorder}`,
                background: done[s]
                  ? isDark
                    ? "rgba(125,211,252,.15)"
                    : "rgba(29,78,216,.10)"
                  : "transparent",
                color: done[s] ? cQuestion : cMuted,
                fontFamily: fontTitle,
                letterSpacing: ".02em",
              }}
            >
              {done[s] ? "✓ " : ""}
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Corpo da lousa */}
      <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-10 xl:px-16 py-8">
        {/* Cabeçalho */}
        <header className="mb-8">
          <div style={{ color: cMuted, fontFamily: fontWrite, fontSize: 18 }}>
            {content.materia}
          </div>
          <h1
            style={{
              fontFamily: fontTitle,
              fontSize: "clamp(2rem, 5vw, 3.25rem)",
              lineHeight: 1.05,
              margin: "6px 0 0",
              color: cText,
            }}
          >
            {content.tema}
          </h1>
        </header>

        {/* LER */}
        <StreamSection
          onVisible={() => markDone("Ler")}
          fontTitle={fontTitle}
          fontWrite={fontWrite}
          titleColor={cText}
          title="1. Ler — Resumo da aula"
        >
          <ul className="space-y-3" style={{ fontFamily: fontWrite, fontSize: 22, lineHeight: 1.5 }}>
            {content.resumo.map((r, i) => (
              <StreamText key={i} text={"• " + r} color={cText} delay={i * 120} />
            ))}
          </ul>
          <button
            type="button"
            onClick={() => speak(content.resumo.join(" "))}
            className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: cBorder, color: cText, fontFamily: fontWrite }}
          >
            <Volume2 size={14} /> 2. Ouvir explicação
          </button>
        </StreamSection>

        {/* ESCREVER + PRATICAR */}
        <StreamSection
          onVisible={() => {
            markDone("Escrever");
            markDone("Praticar");
          }}
          fontTitle={fontTitle}
          fontWrite={fontWrite}
          titleColor={cText}
          title="3. Escrever no caderno · 4. Praticar respostas"
        >
          <p style={{ fontFamily: fontWrite, fontSize: 18, color: cMuted, marginBottom: 16 }}>
            Copie cada exercício no caderno, resolva à mão e depois passe a limpo aqui. Só então
            revele a resposta do professor.
          </p>
          <ol className="space-y-6">
            {content.exercicios.map((ex, i) => (
              <li key={i}>
                <StreamText
                  as="div"
                  text={`${i + 1}) ${ex.enunciado}`}
                  color={cQuestion}
                  delay={i * 200}
                  style={{ fontFamily: fontWrite, fontSize: 24, lineHeight: 1.35 }}
                />
                <textarea
                  value={answers[i] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                  placeholder="Passe a limpo sua resposta…"
                  rows={2}
                  className="mt-2 w-full rounded-md bg-transparent p-3 text-base outline-none focus:ring-2"
                  style={{
                    border: `1px dashed ${cBorder}`,
                    color: cText,
                    fontFamily: fontWrite,
                    fontSize: 20,
                  }}
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRevealed((r) => ({ ...r, [i]: !r[i] }))}
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                    style={{ borderColor: cBorder, color: cText, fontFamily: fontWrite }}
                  >
                    {revealed[i] ? <EyeOff size={14} /> : <Eye size={14} />}
                    {revealed[i] ? "Ocultar" : "Revelar resposta"}
                  </button>
                </div>
                {revealed[i] && (
                  <div className="mt-3 space-y-1 animate-reveal">
                    <div
                      style={{
                        fontFamily: fontWrite,
                        fontSize: 24,
                        color: cAnswer,
                        lineHeight: 1.35,
                      }}
                    >
                      ↳ {ex.resposta}
                    </div>
                    <div style={{ fontFamily: fontWrite, fontSize: 16, color: cMuted }}>
                      {ex.comentario}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </StreamSection>

        {/* ENSINAR */}
        <StreamSection
          onVisible={() => markDone("Ensinar")}
          fontTitle={fontTitle}
          fontWrite={fontWrite}
          titleColor={cText}
          title="5. Ensinar — Explique com suas palavras"
        >
          <StreamText
            as="div"
            text={content.desafioEnsinar.pergunta}
            color={cQuestion}
            style={{ fontFamily: fontWrite, fontSize: 24, lineHeight: 1.35 }}
          />
          <textarea
            value={teachAnswer}
            onChange={(e) => setTeachAnswer(e.target.value)}
            rows={4}
            placeholder="Ensine o professor com suas palavras…"
            className="mt-2 w-full rounded-md bg-transparent p-3 outline-none focus:ring-2"
            style={{
              border: `1px dashed ${cBorder}`,
              color: cText,
              fontFamily: fontWrite,
              fontSize: 20,
            }}
          />
          <button
            type="button"
            onClick={() => setTeachRevealed((v) => !v)}
            className="mt-2 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: cBorder, color: cText, fontFamily: fontWrite }}
          >
            {teachRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
            {teachRevealed ? "Ocultar modelo" : "Ver resposta-modelo"}
          </button>
          {teachRevealed && (
            <div
              className="mt-3 animate-reveal"
              style={{ fontFamily: fontWrite, fontSize: 22, color: cAnswer, lineHeight: 1.4 }}
            >
              ↳ {content.desafioEnsinar.respostaModelo}
            </div>
          )}
        </StreamSection>

        <p style={{ color: cMuted, fontFamily: fontWrite, fontSize: 14, marginTop: 40 }}>
          Conteúdo demonstrativo. Na próxima onda, o Professor IA vai gerar cada lousa a partir da
          sua última aula, seus erros recentes e seu plano de estudos.
        </p>
      </div>

      {/* Menu de contexto sobre seleção */}
      {menu && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-50 w-64 overflow-hidden rounded-lg shadow-xl animate-in fade-in zoom-in-95"
          style={{
            top: menu.y,
            left: menu.x,
            background: isDark ? "#0a2a05" : "#ffffff",
            border: `1px solid ${cBorder}`,
            color: cText,
          }}
        >
          <div
            className="truncate px-3 py-2 text-xs"
            style={{ borderBottom: `1px solid ${cBorder}`, color: cMuted }}
            title={menu.text}
          >
            "{menu.text}"
          </div>
          {[
            { k: "ask" as const, icon: MessageCircleQuestion, label: "Perguntar ao professor" },
            { k: "learn" as const, icon: BookOpen, label: "Aprender sobre isto" },
            { k: "example" as const, icon: Lightbulb, label: "Pedir um exemplo" },
            { k: "source" as const, icon: Search, label: "Fonte da questão" },
            { k: "translate" as const, icon: Languages, label: "Traduzir / simplificar" },
          ].map(({ k, icon: Icon, label }) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setPanel({ action: k, text: menu.text });
                setMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:opacity-80"
              style={{ color: cText }}
            >
              <Icon size={16} style={{ color: cQuestion }} />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Painel lateral com a "resposta" do professor */}
      {panel && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setPanel(null)}
          />
          <aside
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col shadow-2xl"
            style={{
              background: isDark ? "#051900" : "#ffffff",
              borderLeft: `1px solid ${cBorder}`,
              color: cText,
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: `1px solid ${cBorder}` }}
            >
              <div style={{ fontFamily: fontTitle, fontSize: 20 }}>
                {panel.action === "ask" && "Professor IA responde"}
                {panel.action === "learn" && "Aprender sobre"}
                {panel.action === "example" && "Exemplo prático"}
                {panel.action === "source" && "Fonte da questão"}
                {panel.action === "translate" && "Explicação simplificada"}
              </div>
              <button
                type="button"
                onClick={() => setPanel(null)}
                className="rounded p-1 hover:opacity-70"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div
                className="rounded-md p-3 text-sm"
                style={{
                  border: `1px dashed ${cBorder}`,
                  color: cMuted,
                  fontFamily: fontWrite,
                  fontSize: 18,
                }}
              >
                Trecho selecionado:
                <div style={{ color: cText, marginTop: 6 }}>"{panel.text}"</div>
              </div>
              <div
                style={{
                  fontFamily: fontWrite,
                  fontSize: 20,
                  color: cText,
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: cQuestion }}>Professor IA:</span>{" "}
                Em breve eu vou explicar isto pra você em tempo real. Quando o backend do Tutor
                estiver ligado a esta lousa, esta janela vai trazer a resposta usando a sua última
                aula, seus erros recentes e o seu plano de estudos como contexto.
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

/* ============ auxiliares ============ */

function StreamSection({
  title,
  children,
  fontTitle,
  fontWrite: _fontWrite,
  titleColor,
  onVisible,
}: {
  title: string;
  children: React.ReactNode;
  fontTitle: string;
  fontWrite: string;
  titleColor: string;
  onVisible?: () => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!onVisible || !ref.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) onVisible();
      },
      { threshold: 0.35 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [onVisible]);
  return (
    <section ref={ref} className="mb-12">
      <h2
        style={{
          fontFamily: fontTitle,
          fontSize: "clamp(1.5rem, 3vw, 2rem)",
          color: titleColor,
          margin: "0 0 16px",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function StreamText({
  text,
  color,
  delay = 0,
  style,
  as = "li",
}: {
  text: string;
  color: string;
  delay?: number;
  style?: React.CSSProperties;
  as?: "li" | "div" | "span";
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start = 0;
    const total = text.length;
    const speedPerChar = 18; // ms/char
    const tick = (t: number) => {
      if (!start) start = t + delay;
      const elapsed = t - start;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const nextN = Math.min(total, Math.floor(elapsed / speedPerChar));
      setN(nextN);
      if (nextN < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, delay]);
  const shown = text.slice(0, n);
  const caret = n < text.length;
  const content = (
    <>
      {shown}
      {caret && <span style={{ opacity: 0.5 }}>▍</span>}
    </>
  );
  const commonStyle = { color, ...style };
  if (as === "div") return <div style={commonStyle}>{content}</div>;
  if (as === "span") return <span style={commonStyle}>{content}</span>;
  return <li style={commonStyle}>{content}</li>;
}
