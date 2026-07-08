import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { TutorToolResult } from "@/lib/ai.functions";

interface Props {
  result: TutorToolResult;
}

export function TutorToolCard({ result }: Props) {
  switch (result.kind) {
    case "nota_de_aula":
      return <NotaDeAula result={result} />;
    case "mini_quiz":
      return <MiniQuiz result={result} />;
    case "flashcards":
      return <Flashcards result={result} />;
    case "revisar_erro_passado":
      return <RevisarErro result={result} />;
    case "sugerir_aula_fraca":
      return <SugerirAula result={result} />;
    case "rascunho_redacao":
      return <RascunhoRedacao result={result} />;
  }
}

function NotaDeAula({ result }: { result: Extract<TutorToolResult, { kind: "nota_de_aula" }> }) {
  return (
    <div className="border-2 border-primary/40 bg-primary/5 p-4 rounded-lg space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold">
          Nota de aula
        </span>
        <span className="text-xs text-muted-foreground">•</span>
        <h3 className="font-bold text-sm">{result.titulo}</h3>
      </div>
      <p className="text-sm leading-relaxed">{result.definicao}</p>
      {result.pontosChave.length > 0 && (
        <ul className="space-y-1.5">
          {result.pontosChave.map((p, i) => (
            <li key={i} className="text-sm flex gap-2">
              <span className="text-primary font-bold shrink-0">•</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
      {result.exemplo && (
        <div className="text-xs bg-background border border-border p-3 rounded">
          <span className="font-mono uppercase text-[10px] tracking-widest text-muted-foreground">
            Exemplo
          </span>
          <p className="mt-1 leading-relaxed">{result.exemplo}</p>
        </div>
      )}
      {result.macete && (
        <div className="text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3 rounded">
          <span className="font-mono uppercase text-[10px] tracking-widest text-amber-700 dark:text-amber-400">
            Macete
          </span>
          <p className="mt-1 leading-relaxed">{result.macete}</p>
        </div>
      )}
    </div>
  );
}

function MiniQuiz({ result }: { result: Extract<TutorToolResult, { kind: "mini_quiz" }> }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  return (
    <div className="border-2 border-foreground bg-card p-4 rounded-lg space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-widest font-bold">
          Mini quiz
        </span>
        <span className="text-xs text-muted-foreground">•</span>
        <h3 className="font-bold text-sm">{result.titulo}</h3>
      </div>
      {result.perguntas.map((q, qi) => {
        const chosen = answers[qi];
        const shown = revealed[qi];
        return (
          <div key={qi} className="space-y-2 pb-3 border-b border-border last:border-0 last:pb-0">
            <p className="text-sm font-medium leading-relaxed">
              {qi + 1}. {q.pergunta}
            </p>
            <div className="grid gap-1.5">
              {q.alternativas.map((alt, ai) => {
                const isChosen = chosen === ai;
                const isCorrect = ai === q.correta;
                let cls = "border-border hover:border-foreground";
                if (shown && isCorrect) cls = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20";
                else if (shown && isChosen && !isCorrect)
                  cls = "border-destructive bg-destructive/10";
                else if (isChosen) cls = "border-foreground bg-foreground/5";
                return (
                  <button
                    key={ai}
                    disabled={shown}
                    onClick={() => setAnswers((a) => ({ ...a, [qi]: ai }))}
                    className={`text-left text-sm px-3 py-2 border transition-all ${cls} disabled:cursor-default`}
                  >
                    <span className="font-mono text-[10px] mr-2 text-muted-foreground">
                      {String.fromCharCode(65 + ai)}
                    </span>
                    {alt}
                  </button>
                );
              })}
            </div>
            {chosen !== undefined && !shown && (
              <button
                onClick={() => setRevealed((r) => ({ ...r, [qi]: true }))}
                className="text-xs font-mono uppercase tracking-widest px-3 py-1.5 border border-foreground hover:bg-foreground hover:text-background transition-all"
              >
                Verificar
              </button>
            )}
            {shown && (
              <div className="text-xs bg-background border border-border p-3 rounded leading-relaxed">
                <span className="font-bold">
                  {chosen === q.correta ? "✓ Correto! " : "✗ Não foi dessa vez. "}
                </span>
                {q.explicacao}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Flashcards({ result }: { result: Extract<TutorToolResult, { kind: "flashcards" }> }) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  return (
    <div className="border-2 border-purple-500/40 bg-purple-50/50 dark:bg-purple-950/10 p-4 rounded-lg space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-purple-700 dark:text-purple-400 font-bold">
          Flashcards
        </span>
        <span className="text-xs text-muted-foreground">•</span>
        <h3 className="font-bold text-sm">{result.titulo}</h3>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {result.cards.map((c, i) => {
          const isFlipped = !!flipped[i];
          return (
            <button
              key={i}
              onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))}
              className="text-left border border-border bg-background p-3 rounded min-h-[80px] hover:border-purple-500 transition-all"
            >
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                {isFlipped ? "Verso" : "Frente"} — clique
              </div>
              <p className="text-sm leading-relaxed">{isFlipped ? c.verso : c.frente}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RevisarErro({
  result,
}: {
  result: Extract<TutorToolResult, { kind: "revisar_erro_passado" }>;
}) {
  return (
    <div className="border-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/10 p-4 rounded-lg space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-amber-700 dark:text-amber-400 font-bold">
          Você errou isso antes — bora revisitar
        </span>
      </div>
      <p className="text-sm font-medium leading-relaxed">{result.pergunta}</p>
      <div className="text-sm bg-background border border-border p-3 rounded space-y-2">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Correta:
          </span>
          <p className="mt-0.5 font-medium">{result.respostaCorreta}</p>
        </div>
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Por quê:
          </span>
          <p className="mt-0.5 leading-relaxed">{result.explicacao}</p>
        </div>
      </div>
      <div className="text-xs bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-3 rounded">
        <span className="font-mono uppercase text-[10px] tracking-widest text-emerald-700 dark:text-emerald-400">
          Dica para não errar de novo
        </span>
        <p className="mt-1 leading-relaxed">{result.dica}</p>
      </div>
    </div>
  );
}

function SugerirAula({
  result,
}: {
  result: Extract<TutorToolResult, { kind: "sugerir_aula_fraca" }>;
}) {
  return (
    <div className="border border-border bg-card p-4 rounded-lg flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Sugestão de próxima aula
        </div>
        <div className="text-sm font-bold mt-0.5">{result.slug}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{result.area}</div>
        <p className="text-xs mt-2 leading-relaxed">{result.justificativa}</p>
      </div>
      <Link
        to="/aula/$topicId"
        params={{ topicId: result.slug }}
        className="text-xs font-mono uppercase tracking-widest px-4 py-2 bg-foreground text-background hover:bg-primary transition-all"
      >
        Ir para aula
      </Link>
    </div>
  );
}

function RascunhoRedacao({
  result,
}: {
  result: Extract<TutorToolResult, { kind: "rascunho_redacao" }>;
}) {
  return (
    <div className="border-2 border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/10 p-4 rounded-lg space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-blue-700 dark:text-blue-400 font-bold">
          Rascunho de redação
        </span>
        <span className="text-xs text-muted-foreground">•</span>
        <h3 className="font-bold text-sm">{result.tema}</h3>
      </div>
      <Section label="Tese">
        <p className="text-sm leading-relaxed">{result.tese}</p>
      </Section>
      <Section label="Argumentos">
        <ol className="space-y-1.5 list-decimal list-inside">
          {result.argumentos.map((a, i) => (
            <li key={i} className="text-sm leading-relaxed">
              {a}
            </li>
          ))}
        </ol>
      </Section>
      <Section label="Repertórios">
        <ul className="space-y-1">
          {result.repertorios.map((r, i) => (
            <li key={i} className="text-sm flex gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0">→</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section label="Proposta de intervenção">
        <p className="text-sm leading-relaxed">{result.propostaIntervencao}</p>
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-background border border-border p-3 rounded">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}
