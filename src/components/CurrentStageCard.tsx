import { useMemo, useState } from "react";
import { SUBJECTS } from "@/lib/subjects";
import {
  LEARNING_STAGES,
  STAGE_TARGETS,
  advanceStage,
  evaluateAdvance,
  markIntroConcluida,
  markTeoriaConcluida,
  recordGuidedAnswer,
  recordIndepAnswer,
  recordMiniSimuladoResult,
  recordQuickQuestion,
  recordReviewAnswer,
  setActiveSubject,
  stageById,
  startSubject,
  studentStatus,
  useActiveLearning,
} from "@/lib/learning-progress";
import { ArrowRight, BookOpen, Check, Sparkles, Target, TrendingUp, X } from "lucide-react";

/**
 * Card "Etapa atual do aluno" — exibido na sidebar do Tutor IA.
 * Mostra assunto, etapa, progresso, taxa de acerto e o que falta para avançar.
 * Inclui um seletor de assunto para definir/alterar o assunto ativo.
 */
export function CurrentStageCard() {
  const active = useActiveLearning();
  const [picking, setPicking] = useState(false);
  const selectId = useMemo(() => `stage-card-subject-${Math.random().toString(36).slice(2, 7)}`, []);

  const stage = active ? stageById(active.etapaAtual) : null;
  const proximaEtapa =
    active && active.etapaAtual < 7 ? stageById((active.etapaAtual + 1) as 2 | 3 | 4 | 5 | 6 | 7) : null;

  function handlePick(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (!id) return;
    setActiveSubject(id);
    startSubject(id);
    setPicking(false);
  }

  return (
    <section className="border border-border rounded-xl bg-gradient-to-br from-primary/5 via-card to-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/15 text-primary inline-flex items-center justify-center">
            <Sparkles size={14} />
          </div>
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Etapa atual do aluno
          </h2>
        </div>
        {active && (
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {picking ? "Cancelar" : "Trocar"}
          </button>
        )}
      </div>

      {(!active || picking) && (
        <div className="mb-3">
          <label htmlFor={selectId} className="block text-[11px] text-muted-foreground mb-1.5">
            Escolha o assunto que você está estudando:
          </label>
          <select
            id={selectId}
            defaultValue=""
            onChange={handlePick}
            className="w-full text-sm border border-border bg-background rounded-md px-2.5 py-2 focus:outline-none focus:border-foreground"
          >
            <option value="" disabled>
              Selecionar assunto…
            </option>
            {SUBJECTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {active && stage && !picking && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <BookOpen size={11} /> Assunto
            </div>
            <div className="text-base font-bold leading-tight mt-0.5">{active.assunto}</div>
            <div className="text-[11px] text-muted-foreground">{active.materia}</div>
          </div>

          <div className="border-t border-border pt-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Etapa atual
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-sm font-bold">{stage.label}</div>
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                {active.etapaAtual}/7
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${active.progressoPercentual}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {active.progressoPercentual}% do plano de aprendizado
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <StageCounter active={active} />
            <div className="rounded-lg border border-border p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <TrendingUp size={10} /> Acerto
              </div>
              <div className="text-sm font-bold tabular-nums mt-0.5">{active.taxaDeAcerto}%</div>
            </div>
          </div>

          <StageActions subjectId={active.subjectId} stage={active.etapaAtual} />

          <div className="rounded-lg bg-muted/50 border border-border p-2.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
              O que falta para avançar
            </div>
            {(() => {
              const crit = evaluateAdvance(active);
              if (crit.faltam.length === 0) {
                return <p className="text-xs leading-relaxed">{crit.proximoPasso}</p>;
              }
              return (
                <ul className="text-xs leading-relaxed space-y-1">
                  {crit.faltam.map((f) => (
                    <li key={f} className="flex gap-1.5">
                      <span className="text-muted-foreground">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>

          <div className="flex items-center justify-between gap-2">
            <span
              className={
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider " +
                (active.prontoParaAvancar
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground")
              }
            >
              <span
                className={
                  "w-1.5 h-1.5 rounded-full " +
                  (active.prontoParaAvancar ? "bg-primary animate-pulse" : "bg-muted-foreground/60")
                }
              />
              {studentStatus(active)}
            </span>
            {proximaEtapa && (
              <div className="text-[10px] text-muted-foreground">
                Próxima: <span className="font-medium text-foreground">{proximaEtapa.label}</span>
              </div>
            )}
          </div>

          <NextStageButtons active={active} />
        </div>
      )}

      {!active && !picking && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Selecione um assunto acima para o tutor saber em qual das {LEARNING_STAGES.length} etapas
          você está e o que falta para avançar.
        </p>
      )}
    </section>
  );
}

// ---- subcomponentes -------------------------------------------------

function StageCounter({ active }: { active: NonNullable<ReturnType<typeof useActiveLearning>> }) {
  const ss = active.stageStats;
  let label = "Questões";
  let value: string = String(active.questoesRespondidas);
  switch (active.etapaAtual) {
    case 2:
      label = "Perguntas rápidas";
      value = `${ss.perguntasRapidas} / ${STAGE_TARGETS.perguntasRapidasMin}`;
      break;
    case 3:
      label = "Guiadas";
      value = `${ss.guidedTotal} / ${STAGE_TARGETS.guiadasMin}`;
      break;
    case 4:
      label = "Independentes";
      value = `${ss.indepTotal} / ${STAGE_TARGETS.indepMin}`;
      break;
    case 5:
      label = "Revisões pendentes";
      value = String(active.revisoesPendentes);
      break;
    case 6:
      label = "Mini simulado";
      value = ss.simuladoFeito ? `${ss.simuladoAcertos}/${ss.simuladoTotal}` : "—";
      break;
  }
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <Target size={10} /> {label}
      </div>
      <div className="text-sm font-bold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function ActionBtn({
  onClick,
  children,
  tone = "default",
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "ok" | "warn";
}) {
  const cls =
    tone === "ok"
      ? "bg-primary/15 text-primary hover:bg-primary/25"
      : tone === "warn"
      ? "bg-muted text-foreground hover:bg-muted/80"
      : "bg-foreground text-background hover:bg-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-md transition-colors ${cls}`}
    >
      {children}
    </button>
  );
}

function StageActions({ subjectId, stage }: { subjectId: string; stage: 1 | 2 | 3 | 4 | 5 | 6 | 7 }) {
  if (stage === 7) return null;

  if (stage === 1) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <ActionBtn tone="ok" onClick={() => markIntroConcluida(subjectId)}>
          <Check size={11} className="inline -mt-0.5 mr-1" />
          Conclui a introdução
        </ActionBtn>
      </div>
    );
  }
  if (stage === 2) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <ActionBtn tone="ok" onClick={() => markTeoriaConcluida(subjectId)}>
          <Check size={11} className="inline -mt-0.5 mr-1" />
          Concluí a teoria
        </ActionBtn>
        <ActionBtn onClick={() => recordQuickQuestion(subjectId, true)}>
          + Pergunta certa
        </ActionBtn>
        <ActionBtn tone="warn" onClick={() => recordQuickQuestion(subjectId, false)}>
          <X size={11} className="inline -mt-0.5 mr-1" />
          Errei
        </ActionBtn>
      </div>
    );
  }
  if (stage === 3) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <ActionBtn onClick={() => recordGuidedAnswer(subjectId, true)}>+ Guiada certa</ActionBtn>
        <ActionBtn tone="warn" onClick={() => recordGuidedAnswer(subjectId, false)}>
          Guiada errada
        </ActionBtn>
      </div>
    );
  }
  if (stage === 4) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <ActionBtn onClick={() => recordIndepAnswer(subjectId, true)}>+ Indep. certa</ActionBtn>
        <ActionBtn tone="warn" onClick={() => recordIndepAnswer(subjectId, false)}>
          Indep. errada → revisar
        </ActionBtn>
      </div>
    );
  }
  if (stage === 5) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <ActionBtn onClick={() => recordReviewAnswer(subjectId, true)}>+ Revisão certa</ActionBtn>
        <ActionBtn tone="warn" onClick={() => recordReviewAnswer(subjectId, false)}>
          Revisão errada
        </ActionBtn>
      </div>
    );
  }
  if (stage === 6) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <ActionBtn
          tone="ok"
          onClick={() => {
            const totalStr = window.prompt("Total de questões do mini simulado?", "10");
            const acertosStr = window.prompt("Quantas você acertou?", "8");
            const total = Number(totalStr ?? "");
            const acertos = Number(acertosStr ?? "");
            if (!Number.isFinite(total) || !Number.isFinite(acertos)) return;
            recordMiniSimuladoResult(subjectId, acertos, total);
          }}
        >
          Registrar mini simulado
        </ActionBtn>
      </div>
    );
  }
  return null;
}

export default CurrentStageCard;
