import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const taskInput = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string(),
  area: z.string(),
  type: z.string(),
  minutes: z.number(),
  topicTitle: z.string().optional(),
});

const enrichInput = z.object({
  focus: z.string().optional(),
  hoursPerDay: z.number().optional(),
  targetScore: z.number().optional(),
  hardAreas: z.array(z.string()).optional(),
  weakTopics: z
    .array(z.object({ title: z.string(), area: z.string(), score: z.number() }))
    .max(20)
    .optional(),
  tasks: z.array(taskInput).min(1).max(40),
});

export const enrichStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => enrichInput.parse(data))
  .handler(async ({ data }) => {
    const { generateObject } = await import("ai");
    const { createGateway, CHAT_MODEL } = await import("./ai-gateway.server");
    const { z: zod } = await import("zod");

    const gateway = createGateway();

    const schema = zod.object({
      updates: zod
        .array(
          zod.object({
            id: zod.string(),
            title: zod.string().min(3).max(180),
            note: zod.string().min(3).max(240),
          }),
        )
        .min(1),
    });

    const tasksSummary = data.tasks
      .map(
        (t) =>
          `- ${t.id} | ${t.date} | ${t.type} | ${t.area} | ${t.minutes}min | "${t.title}"${
            t.topicTitle ? ` | tópico: ${t.topicTitle}` : ""
          }`,
      )
      .join("\n");

    const weakSummary = data.weakTopics?.length
      ? data.weakTopics
          .map(
            (w) =>
              `- ${w.title} (${w.area}, nota ${Math.round(w.score * 100)}%)`,
          )
          .join("\n")
      : "(sem dados de desempenho ainda)";

    const prompt =
      `Você é um(a) professor(a) particular brasileiro(a), especialista em ENEM. ` +
      `Reescreva os títulos das tarefas do cronograma abaixo para ficarem específicos, ` +
      `motivadores e didáticos (em português brasileiro), e escreva uma "note" curta ` +
      `(uma frase, até 200 caracteres) explicando o objetivo prático de cada tarefa. ` +
      `\n\nREGRAS RÍGIDAS:\n` +
      `- NUNCA altere o id da tarefa.\n` +
      `- Mantenha o TIPO da tarefa (teoria, questões, revisão, etc.) coerente com o novo título.\n` +
      `- Se a tarefa tiver um tópico, use o nome do tópico no título.\n` +
      `- Não invente matérias que não existam no ENEM.\n` +
      `- Cada título deve ser diferente dos demais (evite repetição).\n\n` +
      `Perfil do(a) aluno(a):\n` +
      `- Foco: ${data.focus ?? "equilibrado"}\n` +
      `- Horas por dia: ${data.hoursPerDay ?? "?"}\n` +
      `- Meta de nota: ${data.targetScore ?? "?"}\n` +
      `- Áreas difíceis: ${data.hardAreas?.join(", ") || "nenhuma"}\n` +
      `\nTópicos com desempenho fraco:\n${weakSummary}\n` +
      `\nTarefas (id | data | tipo | área | minutos | título atual):\n${tasksSummary}\n` +
      `\nDevolva um JSON com { updates: [{ id, title, note }] } cobrindo TODAS as tarefas listadas.`;

    try {
      const { object } = await generateObject({
        model: gateway(CHAT_MODEL),
        schema,
        prompt,
      });
      const validIds = new Set(data.tasks.map((t) => t.id));
      const updates = object.updates.filter((u) => validIds.has(u.id));
      return { updates };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Falha ao enriquecer plano: ${msg}`);
    }
  });
