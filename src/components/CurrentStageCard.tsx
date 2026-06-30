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
            <div className="rounded-lg border border-border p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <Target size={10} /> Questões
              </div>
              <div className="text-sm font-bold tabular-nums mt-0.5">
                {active.questoesRespondidas}
                {active.etapaAtual >= 3 && (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {" "}/ {STAGE_TARGETS.questoesMinimas}
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-border p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <TrendingUp size={10} /> Acerto
              </div>
              <div className="text-sm font-bold tabular-nums mt-0.5">{active.taxaDeAcerto}%</div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 border border-border p-2.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
              O que falta para avançar
            </div>
            <p className="text-xs leading-relaxed">{nextStepHint(active)}</p>
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
              <button
                type="button"
                onClick={() => advanceStage(active.subjectId)}
                disabled={!active.prontoParaAvancar}
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-md bg-foreground text-background disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary transition-colors"
              >
                Avançar <ArrowRight size={11} />
              </button>
            )}
          </div>

          {proximaEtapa && (
            <div className="text-[10px] text-muted-foreground">
              Próxima: <span className="font-medium text-foreground">{proximaEtapa.label}</span>
            </div>
          )}
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

export default CurrentStageCard;
