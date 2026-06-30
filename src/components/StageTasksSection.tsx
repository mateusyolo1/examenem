import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  BookOpen,
  GraduationCap,
  ListChecks,
  Target,
  Repeat,
  FileText,
  Trophy,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import {
  useLearningProgress,
  evaluateAdvance,
  stageById,
  markIntroConcluida,
  markTeoriaConcluida,
  type SubjectLearningProgress,
  type LearningStageId,
} from "@/lib/learning-progress";
import { SUBJECTS } from "@/lib/subjects";

type Cta = { to: "/tutor" | "/questoes" | "/revisar" | "/simulados"; label: string };

interface StageTask {
  stage: LearningStageId;
  tipo: string;
  titulo: string;
  descricao: string;
  criterio: string;
  cta: Cta;
  Icon: typeof BookOpen;
  /** opcional: ação local (ex.: marcar introdução concluída). */
  localAction?: { label: string; run: () => void };
  /** stage 7 — próximo assunto sugerido. */
  proximoAssunto?: string | null;
}

function buildStageTask(p: SubjectLearningProgress): StageTask {
  const crit = evaluateAdvance(p);
  const faltam = crit.faltam.length ? crit.faltam.join(" ") : "Critérios cumpridos — pronto para avançar.";

  switch (p.etapaAtual) {
    case 1:
      return {
        stage: 1,
        tipo: "Introdução",
        titulo: `Introdução a ${p.assunto}`,
        descricao:
          "Visão geral do assunto: o que é, por que cai no ENEM e onde aparece.",
        criterio: faltam,
        cta: { to: "/tutor", label: "Estudar com o Tutor" },
        Icon: BookOpen,
        localAction: {
          label: "Marcar introdução concluída",
          run: () => markIntroConcluida(p.subjectId),
        },
      };
    case 2:
      return {
        stage: 2,
        tipo: "Teoria",
        titulo: `Teoria de ${p.assunto}`,
        descricao:
          "Estudo do conteúdo teórico essencial + 3 perguntas rápidas de verificação.",
        criterio: faltam,
        cta: { to: "/tutor", label: "Aprofundar a teoria" },
        Icon: GraduationCap,
        localAction: {
          label: "Marcar teoria concluída",
          run: () => markTeoriaConcluida(p.subjectId),
        },
      };
    case 3:
      return {
        stage: 3,
        tipo: "Questões guiadas",
        titulo: `Resolver com o Tutor — ${p.assunto}`,
        descricao:
          "Resolva pelo menos 5 questões passo a passo junto com o Tutor IA.",
        criterio: faltam,
        cta: { to: "/tutor", label: "Resolver passo a passo" },
        Icon: ListChecks,
      };
    case 4:
      return {
        stage: 4,
        tipo: "Questões independentes",
        titulo: `Praticar sozinho — ${p.assunto}`,
        descricao:
          "Resolva 10 questões independentes no banco. Erros vão automaticamente para Revisar Erros.",
        criterio: faltam,
        cta: { to: "/questoes", label: "Ir ao banco de questões" },
        Icon: Target,
      };
    case 5:
      return {
        stage: 5,
        tipo: "Revisão de erros",
        titulo: `Revisar erros — ${p.assunto}`,
        descricao:
          "Zere as revisões pendentes deste assunto e atinja 70% de acerto nas revisões.",
        criterio: faltam,
        cta: { to: "/revisar", label: "Ir para Revisar Erros" },
        Icon: Repeat,
      };
    case 6:
      return {
        stage: 6,
        tipo: "Mini simulado",
        titulo: `Mini simulado — ${p.assunto}`,
        descricao:
          "Faça um mini simulado cronometrado deste assunto (meta ≥ 75% de acerto).",
        criterio: faltam,
        cta: { to: "/simulados", label: "Iniciar mini simulado" },
        Icon: FileText,
      };
    case 7:
    default: {
      const atual = SUBJECTS.find((s) => s.id === p.subjectId);
      const proximo = atual
        ? SUBJECTS.find((s) => s.area === atual.area && s.id !== atual.id)
        : null;
      return {
        stage: 7,
        tipo: "Próximo assunto",
        titulo: `Assunto dominado: ${p.assunto}`,
        descricao: proximo
          ? `Bom trabalho! Sugestão: iniciar "${proximo.name}" (${atual?.area ?? ""}).`
          : "Bom trabalho! Mantenha revisões espaçadas deste assunto.",
        criterio: "Assunto dominado. Sem critérios pendentes.",
        cta: { to: "/tutor", label: "Começar próximo assunto" },
        Icon: Trophy,
        proximoAssunto: proximo?.name ?? null,
      };
    }
  }
}

export function StageTasksSection() {
  const all = useLearningProgress();
  const tasks = useMemo(
    () =>
      all
        .slice()
        .sort((a, b) => (b.ultimaAtividade ?? 0) - (a.ultimaAtividade ?? 0))
        .map((p) => ({ p, task: buildStageTask(p) })),
    [all],
  );

  if (tasks.length === 0) {
    return (
      <section className="bg-card border border-border rounded-2xl shadow-sm p-5 sm:p-6">
        <h2 className="text-base sm:text-lg font-bold tracking-tight">
          Tarefas por etapa de aprendizado
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nenhum assunto em andamento ainda. Escolha um assunto no Tutor IA para
          gerar tarefas adaptadas à sua etapa atual.
        </p>
        <Link
          to="/tutor"
          className="mt-4 inline-flex items-center gap-1.5 min-h-9 px-4 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition"
        >
          Ir para o Tutor IA
          <ArrowRight size={12} aria-hidden />
        </Link>
      </section>
    );
  }

  return (
    <section className="bg-card border border-border rounded-2xl shadow-sm p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight">
            Tarefas por etapa de aprendizado
          </h2>
          <p className="text-sm text-muted-foreground">
            Geradas automaticamente a partir da <strong>etapa atual</strong> de
            cada assunto.
          </p>
        </div>
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {tasks.length} {tasks.length === 1 ? "assunto" : "assuntos"}
        </span>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tasks.map(({ p, task }) => (
          <li key={p.subjectId}>
            <StageTaskCard p={p} task={task} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function StageTaskCard({
  p,
  task,
}: {
  p: SubjectLearningProgress;
  task: StageTask;
}) {
  const stage = stageById(task.stage);
  const Icon = task.Icon;
  const dominado = task.stage === 7;
  return (
    <div
      className={
        "h-full rounded-xl border bg-background p-4 flex flex-col transition-all " +
        (dominado
          ? "border-emerald-500/30 bg-emerald-500/5"
          : p.prontoParaAvancar
            ? "border-primary/40"
            : "border-border hover:border-foreground/20 hover:shadow-sm")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
          <Icon size={10} aria-hidden />
          {task.tipo}
        </span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Etapa {task.stage}/7
        </span>
      </div>

      <h3 className="mt-2 text-sm font-semibold leading-snug text-foreground">
        {task.titulo}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{task.descricao}</p>

      <dl className="mt-3 space-y-1.5 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Etapa atual</dt>
          <dd className="font-semibold text-foreground text-right">
            {stage.id}. {stage.label}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Progresso</dt>
          <dd className="font-semibold tabular-nums text-foreground">
            {p.progressoPercentual}%
          </dd>
        </div>
        {p.questoesRespondidas > 0 && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Acerto</dt>
            <dd className="font-semibold tabular-nums text-foreground">
              {p.taxaDeAcerto}%
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-[11px] leading-relaxed text-foreground/80">
        <strong className="font-semibold text-foreground">
          Critério para avançar:
        </strong>{" "}
        {task.criterio}
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <Link
          to={task.cta.to}
          className="inline-flex items-center justify-center gap-1.5 w-full min-h-9 px-3 rounded-md bg-foreground text-background text-xs font-semibold hover:opacity-90 transition"
        >
          {task.cta.label}
          <ArrowRight size={12} aria-hidden />
        </Link>
        {task.localAction && (
          <button
            onClick={task.localAction.run}
            className="inline-flex items-center justify-center gap-1.5 w-full min-h-8 px-3 rounded-md border border-border bg-background text-xs font-semibold text-foreground/80 hover:bg-accent transition"
          >
            <CheckCircle2 size={12} aria-hidden />
            {task.localAction.label}
          </button>
        )}
      </div>
    </div>
  );
}
