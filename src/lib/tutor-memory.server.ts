// Carrega o "prontuário" do aluno para o Tutor IA — memória vinda do banco
// (topic_mastery, lesson_attempts, lesson_essay_attempts, user_essays).
// Só é chamado dentro de handlers autenticados (requireSupabaseAuth).

import type { SupabaseClient } from "@supabase/supabase-js";

export interface StudentMemory {
  topicSummary: string;
  weakTopics: Array<{ slug: string; area: string; score: number; attempts: number }>;
  strongTopics: Array<{ slug: string; area: string; score: number }>;
  recentWrongAnswers: Array<{
    topicId: string;
    question: string;
    correct: string;
    userAnswer: string;
    when: string;
  }>;
  recentEssays: Array<{ tema: string; score: number | null; when: string }>;
  pendingReviews: number;
}

const EMPTY_MEMORY: StudentMemory = {
  topicSummary: "",
  weakTopics: [],
  strongTopics: [],
  recentWrongAnswers: [],
  recentEssays: [],
  pendingReviews: 0,
};

export async function loadStudentMemory(
  supabase: SupabaseClient,
  userId: string,
): Promise<StudentMemory> {
  try {
    const now = new Date().toISOString();
    const [masteryRes, attemptsRes, essayLessonRes, essayFreeRes] = await Promise.all([
      supabase
        .from("topic_mastery")
        .select("topic_slug,area,last_score,attempts,next_review_at,mastered")
        .eq("user_id", userId)
        .order("last_seen_at", { ascending: false })
        .limit(80),
      supabase
        .from("lesson_attempts")
        .select("topic_id,score,total,answers,completed_at")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false })
        .limit(6),
      supabase
        .from("lesson_essay_attempts")
        .select("topic_id,task,score,feedback,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("user_essays")
        .select("tema,feedback,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    const mastery = masteryRes.data ?? [];
    const attempts = attemptsRes.data ?? [];
    const essaysLesson = essayLessonRes.data ?? [];
    const essaysFree = essayFreeRes.data ?? [];

    const weakTopics = mastery
      .filter((m) => typeof m.last_score === "number" && m.last_score < 0.6)
      .map((m) => ({
        slug: m.topic_slug,
        area: m.area,
        score: Number(m.last_score),
        attempts: m.attempts ?? 0,
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 8);

    const strongTopics = mastery
      .filter((m) => typeof m.last_score === "number" && m.last_score >= 0.75)
      .map((m) => ({
        slug: m.topic_slug,
        area: m.area,
        score: Number(m.last_score),
      }))
      .slice(0, 5);

    const pendingReviews = mastery.filter(
      (m) => m.next_review_at && m.next_review_at <= now && !m.mastered,
    ).length;

    // Extrai respostas erradas das últimas tentativas
    const recentWrongAnswers: StudentMemory["recentWrongAnswers"] = [];
    for (const a of attempts) {
      const answers = Array.isArray(a.answers) ? a.answers : [];
      for (const raw of answers) {
        if (!raw || typeof raw !== "object") continue;
        const ans = raw as {
          question?: string;
          correct?: string;
          userAnswer?: string;
          user?: string;
          isCorrect?: boolean;
          correctIndex?: number;
          chosenIndex?: number;
          options?: string[];
        };
        const wrong =
          ans.isCorrect === false ||
          (typeof ans.correctIndex === "number" &&
            typeof ans.chosenIndex === "number" &&
            ans.correctIndex !== ans.chosenIndex);
        if (!wrong) continue;
        const question = typeof ans.question === "string" ? ans.question : "";
        if (!question) continue;
        const correct =
          typeof ans.correct === "string"
            ? ans.correct
            : Array.isArray(ans.options) && typeof ans.correctIndex === "number"
              ? ans.options[ans.correctIndex] ?? ""
              : "";
        const userAnswer =
          typeof ans.userAnswer === "string"
            ? ans.userAnswer
            : typeof ans.user === "string"
              ? ans.user
              : Array.isArray(ans.options) && typeof ans.chosenIndex === "number"
                ? ans.options[ans.chosenIndex] ?? ""
                : "";
        recentWrongAnswers.push({
          topicId: a.topic_id,
          question: question.slice(0, 280),
          correct: correct.slice(0, 200),
          userAnswer: userAnswer.slice(0, 200),
          when: a.completed_at,
        });
        if (recentWrongAnswers.length >= 6) break;
      }
      if (recentWrongAnswers.length >= 6) break;
    }

    const recentEssays: StudentMemory["recentEssays"] = [];
    for (const e of essaysLesson) {
      const task = e.task as { title?: string } | null;
      recentEssays.push({
        tema: task?.title ?? "Tarefa de aula",
        score: typeof e.score === "number" ? e.score : null,
        when: e.created_at,
      });
    }
    for (const e of essaysFree) {
      const fb = e.feedback as { notaFinal?: number } | null;
      recentEssays.push({
        tema: e.tema,
        score: typeof fb?.notaFinal === "number" ? fb.notaFinal : null,
        when: e.created_at,
      });
    }
    recentEssays.sort((a, b) => b.when.localeCompare(a.when));
    recentEssays.splice(4);

    const summaryLines: string[] = [];
    if (weakTopics.length) {
      summaryLines.push(
        `Pontos fracos: ${weakTopics
          .slice(0, 5)
          .map((t) => `${t.slug} (${Math.round(t.score * 100)}%)`)
          .join(", ")}`,
      );
    }
    if (strongTopics.length) {
      summaryLines.push(
        `Dominados: ${strongTopics.map((t) => t.slug).slice(0, 4).join(", ")}`,
      );
    }
    if (pendingReviews > 0) {
      summaryLines.push(`Revisões atrasadas: ${pendingReviews}`);
    }
    if (recentWrongAnswers.length > 0) {
      summaryLines.push(`Erros recentes registrados: ${recentWrongAnswers.length}`);
    }
    if (recentEssays.length > 0) {
      const withScore = recentEssays.filter((e) => e.score != null);
      if (withScore.length > 0) {
        const avg = Math.round(
          withScore.reduce((s, e) => s + (e.score ?? 0), 0) / withScore.length,
        );
        summaryLines.push(`Média redação recente: ${avg}`);
      }
    }

    return {
      topicSummary: summaryLines.join(" · "),
      weakTopics,
      strongTopics,
      recentWrongAnswers,
      recentEssays,
      pendingReviews,
    };
  } catch (error) {
    console.warn("[tutor-memory] falha ao carregar memória:", error);
    return EMPTY_MEMORY;
  }
}

export function memoryToPromptContext(memory: StudentMemory): string {
  if (
    memory.weakTopics.length === 0 &&
    memory.strongTopics.length === 0 &&
    memory.recentWrongAnswers.length === 0 &&
    memory.recentEssays.length === 0
  ) {
    return "";
  }

  const lines: string[] = ["", "PRONTUÁRIO DO ALUNO (use ativamente para personalizar o ensino):"];

  if (memory.weakTopics.length > 0) {
    lines.push("- Tópicos fracos (score < 60%):");
    for (const t of memory.weakTopics) {
      lines.push(
        `  · ${t.slug} [${t.area}] — ${Math.round(t.score * 100)}% em ${t.attempts} tentativa(s)`,
      );
    }
  }
  if (memory.strongTopics.length > 0) {
    lines.push(`- Tópicos dominados: ${memory.strongTopics.map((t) => t.slug).join(", ")}`);
  }
  if (memory.pendingReviews > 0) {
    lines.push(`- Revisões espaçadas atrasadas: ${memory.pendingReviews}`);
  }
  if (memory.recentWrongAnswers.length > 0) {
    lines.push("- Últimos erros nas atividades:");
    for (const w of memory.recentWrongAnswers.slice(0, 3)) {
      lines.push(
        `  · "${w.question.slice(0, 120)}..." — respondeu "${w.userAnswer.slice(0, 60)}", correto era "${w.correct.slice(0, 60)}"`,
      );
    }
  }
  if (memory.recentEssays.length > 0) {
    lines.push("- Redações recentes:");
    for (const e of memory.recentEssays) {
      lines.push(`  · ${e.tema}${e.score != null ? ` — nota ${e.score}` : ""}`);
    }
  }

  lines.push(
    "",
    "REGRAS DE USO DO PRONTUÁRIO:",
    "- Quando o(a) aluno(a) abrir conversa vaga, ofereça revisar um tópico fraco listado acima.",
    "- Quando fizer sentido, use a ferramenta 'revisar_erro_passado' para retomar um erro específico.",
    "- Quando ensinar, use 'nota_de_aula' e 'mini_quiz' para criar interação — não fique só falando.",
    "- Se o(a) aluno(a) tem um ponto forte relacionado ao que pergunta, elogie brevemente antes de aprofundar.",
  );

  return lines.join("\n");
}
