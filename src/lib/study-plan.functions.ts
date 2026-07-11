import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ============ Persistência do Plano de Estudos no servidor ============
// Fonte da verdade: tabela `user_study_plan` (colunas `config` e `cronograma` JSONB).
// O cliente usa React Query em cima destas server fns; `localStorage` só serve
// como cache leve de hidratação inicial.

const persistTaskSchema = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string(),
  area: z.string(),
  type: z.string(),
  minutes: z.number(),
  status: z.enum(["pendente", "concluida", "atrasada"]),
  note: z.string().optional(),
  aiEnriched: z.boolean().optional(),
  topicSlug: z.string().optional(),
  topicArea: z.string().optional(),
});

const persistPlanSchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  seed: z.number().optional(),
  config: z.record(z.string(), z.unknown()),
  tasks: z.array(persistTaskSchema).max(500),
});

export const saveStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => persistPlanSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_study_plan")
      .upsert(
        {
          user_id: userId,
          config: data.config as never,
          cronograma: data as never,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(`Falha ao salvar plano: ${error.message}`);
    return { ok: true };
  });

export const loadStudyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_study_plan")
      .select("cronograma, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(`Falha ao carregar plano: ${error.message}`);
    return { plan: (data?.cronograma as unknown) ?? null };
  });

export const clearStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_study_plan")
      .delete()
      .eq("user_id", userId);
    if (error) throw new Error(`Falha ao apagar plano: ${error.message}`);
    return { ok: true };
  });

// Marca uma StudyTask como concluída (ou desmarca) dentro do JSONB.
export const markStudyTaskDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        taskId: z.string().optional(),
        topicSlug: z.string().optional(),
        date: z.string().optional(),
        toggle: z.boolean().optional(),
      })
      .refine((v) => v.taskId || v.topicSlug, {
        message: "Informe taskId ou topicSlug",
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("user_study_plan")
      .select("cronograma")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.cronograma) return { ok: false, updated: 0 };
    const plan = row.cronograma as {
      tasks: Array<{
        id: string;
        date: string;
        status: string;
        topicSlug?: string;
      }>;
    };
    let updated = 0;
    const nextTasks = plan.tasks.map((t) => {
      const match = data.taskId
        ? t.id === data.taskId
        : t.topicSlug === data.topicSlug &&
          (!data.date || t.date === data.date);
      if (!match) return t;
      const wantDone = data.toggle ? t.status !== "concluida" : true;
      if (t.status === (wantDone ? "concluida" : "pendente")) return t;
      updated += 1;
      return { ...t, status: wantDone ? "concluida" : "pendente" };
    });
    if (updated === 0) return { ok: true, updated };
    const nextPlan = { ...plan, tasks: nextTasks };
    const { error: upErr } = await supabase
      .from("user_study_plan")
      .update({ cronograma: nextPlan as never, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, updated };
  });

// Retorna as tarefas de hoje agrupadas por tipo, para o Cronograma consumir.
export const getTodayAgendaTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("user_study_plan")
      .select("cronograma")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const plan = row?.cronograma as
      | {
          tasks: Array<{
            id: string;
            date: string;
            title: string;
            area: string;
            type: string;
            minutes: number;
            status: string;
            topicSlug?: string;
            topicArea?: string;
            note?: string;
          }>;
        }
      | null
      | undefined;
    const today = (() => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    })();
    const todays = (plan?.tasks ?? []).filter((t) => t.date === today);
    const byType: Record<string, typeof todays> = {};
    for (const t of todays) {
      (byType[t.type] ??= []).push(t);
    }
    // Video-like types unified: videoaula + teoria (ambos são "estudar o assunto do dia")
    const videoTasks = [...(byType.videoaula ?? []), ...(byType.teoria ?? [])].filter(
      (t) => t.topicSlug,
    );

    // Busca composição pedagógica (Layer 6) para cada tópico dos vídeos de hoje.
    // Isso alimenta o mini-resumo "1 intro · 2 teoria · 2 ex · 1 apl" no
    // TodayVideosList e permite ordenar as aulas pela jornada pedagógica.
    const slugs = Array.from(
      new Set(videoTasks.map((t) => t.topicSlug).filter((s): s is string => !!s)),
    );
    const intentsBySlug: Record<
      string,
      { intents: (string | null)[]; dominant: string | null }
    > = {};
    if (slugs.length) {
      const { data: topics } = await supabase
        .from("study_topics")
        .select("id, slug")
        .in("slug", slugs);
      const topicIds = (topics ?? []).map((t) => t.id);
      const slugById = new Map((topics ?? []).map((t) => [t.id, t.slug]));
      if (topicIds.length) {
        const { data: vids } = await supabase
          .from("study_videos")
          .select("topic_id, pedagogical_intent, sort_order")
          .in("topic_id", topicIds)
          .order("sort_order", { ascending: true });
        for (const v of vids ?? []) {
          const slug = slugById.get(v.topic_id as string);
          if (!slug) continue;
          const entry = (intentsBySlug[slug] ??= { intents: [], dominant: null });
          entry.intents.push((v.pedagogical_intent as string | null) ?? null);
        }
        // dominant = intent mais frequente da playlist
        for (const slug of Object.keys(intentsBySlug)) {
          const counts: Record<string, number> = {};
          for (const i of intentsBySlug[slug].intents) {
            if (!i) continue;
            counts[i] = (counts[i] ?? 0) + 1;
          }
          let best: string | null = null;
          let bestN = 0;
          for (const [k, n] of Object.entries(counts)) {
            if (n > bestN) {
              best = k;
              bestN = n;
            }
          }
          intentsBySlug[slug].dominant = best;
        }
      }
    }

    // Ordena aulas do dia pela jornada pedagógica (intro → teoria → ex → apl → rev)
    const INTENT_ORDER = ["introducao", "teoria", "exercicios", "aplicacao", "revisao"];
    const rank = (slug?: string) => {
      const d = slug ? intentsBySlug[slug]?.dominant : null;
      const i = d ? INTENT_ORDER.indexOf(d) : -1;
      return i < 0 ? INTENT_ORDER.length : i;
    };
    const videos = [...videoTasks]
      .sort((a, b) => rank(a.topicSlug) - rank(b.topicSlug))
      .map((t) => ({
        ...t,
        intents: t.topicSlug ? intentsBySlug[t.topicSlug]?.intents ?? [] : [],
        dominantIntent: t.topicSlug ? intentsBySlug[t.topicSlug]?.dominant ?? null : null,
      }));

    const focusTopicsFor = (types: string[]): string[] => {
      const s = new Set<string>();
      types.forEach((k) =>
        (byType[k] ?? []).forEach((t) => t.topicSlug && s.add(t.topicSlug)),
      );
      return Array.from(s);
    };
    return {
      hasPlan: !!plan,
      date: today,
      all: todays,
      byType,
      videos,
      focusTopics: {
        questoes: focusTopicsFor(["questoes", "prova_antiga"]),
        flashcards: focusTopicsFor(["flashcards", "revisao"]),
        lousa: focusTopicsFor(["teoria", "videoaula", "questoes"]),
      },
      simuladoArea:
        (byType.simulado ?? []).find((t) => t.area && t.area !== "geral")?.area ??
        null,
    };
  });


// Sinais para personalizar o enrich do plano: erros recentes + vídeos assistidos.
export const getPersonalizationSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // erros recentes: lousa_failure em study_plan_activities.payload.focus_topics
    const { data: recentActs } = await supabase
      .from("study_plan_activities")
      .select("payload, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    const errorsSet = new Set<string>();
    for (const a of recentActs ?? []) {
      const p = (a.payload ?? {}) as { source?: string; focus_topics?: unknown };
      if (p.source === "lousa_failure" && Array.isArray(p.focus_topics)) {
        for (const t of p.focus_topics) if (typeof t === "string") errorsSet.add(t);
      }
      if (errorsSet.size >= 10) break;
    }

    // vídeos assistidos recentemente
    const { data: watched } = await supabase
      .from("user_video_progress")
      .select("last_watched_at, watched, study_videos(title, channel_name)")
      .eq("user_id", userId)
      .eq("watched", true)
      .order("last_watched_at", { ascending: false })
      .limit(10);
    type WatchedRow = {
      study_videos: { title: string | null; channel_name: string | null } | null;
    };
    const watchedVideos = ((watched ?? []) as unknown as WatchedRow[])
      .map((w) => ({
        title: w.study_videos?.title ?? "",
        channel: w.study_videos?.channel_name ?? null,
      }))
      .filter((v) => v.title)
      .slice(0, 8);

    return {
      recentErrors: Array.from(errorsSet),
      watchedVideos,
    };
  });

// ============ Fim persistência ============



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
  examName: z.string().optional(),
  hoursPerDay: z.number().optional(),
  targetScore: z.number().optional(),
  hardAreas: z.array(z.string()).optional(),
  weakTopics: z
    .array(z.object({ title: z.string(), area: z.string(), score: z.number() }))
    .max(20)
    .optional(),
  recentErrors: z.array(z.string()).max(20).optional(),
  watchedVideos: z
    .array(z.object({ title: z.string(), channel: z.string().nullable().optional() }))
    .max(10)
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

    const errorsSummary = data.recentErrors?.length
      ? data.recentErrors.map((e) => `- ${e}`).join("\n")
      : "(nenhum erro registrado recentemente)";

    const videosSummary = data.watchedVideos?.length
      ? data.watchedVideos
          .map((v) => `- "${v.title}"${v.channel ? ` (${v.channel})` : ""}`)
          .join("\n")
      : "(nenhum vídeo assistido recentemente)";

    const prompt =
      `Você é um(a) professor(a) particular brasileiro(a), especialista em ${data.examName ?? "ENEM"}. ` +
      `Reescreva os títulos das tarefas do cronograma abaixo para ficarem específicos, ` +
      `motivadores e didáticos (em português brasileiro), e escreva uma "note" curta ` +
      `(uma frase, até 200 caracteres) explicando o objetivo prático de cada tarefa. ` +
      `\n\nREGRAS RÍGIDAS:\n` +
      `- NUNCA altere o id da tarefa.\n` +
      `- Mantenha o TIPO da tarefa (teoria, questões, revisão, etc.) coerente com o novo título.\n` +
      `- Se a tarefa tiver um tópico, use o nome do tópico no título.\n` +
      `- Não invente matérias que não existam no ENEM.\n` +
      `- Cada título deve ser diferente dos demais (evite repetição).\n` +
      `- Se a tarefa cobrir um tópico onde o aluno tem ERRO RECENTE, mencione explicitamente na note (ex: "revisar o erro X").\n` +
      `- Se algum vídeo assistido tratar do mesmo assunto, referencie ("como visto no vídeo Y").\n\n` +
      `Perfil do(a) aluno(a):\n` +
      `- Prova alvo: ${data.examName ?? "ENEM"}\n` +
      `- Foco: ${data.focus ?? "equilibrado"}\n` +
      `- Horas por dia: ${data.hoursPerDay ?? "?"}\n` +
      `- Meta de nota: ${data.targetScore ?? "?"}\n` +
      `- Áreas difíceis: ${data.hardAreas?.join(", ") || "nenhuma"}\n` +
      `\nTópicos com desempenho fraco:\n${weakSummary}\n` +
      `\nErros recentes (lousa/questões):\n${errorsSummary}\n` +
      `\nVídeos que o aluno JÁ ASSISTIU (use como âncora):\n${videosSummary}\n` +
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
