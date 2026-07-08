import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { createGateway, CHAT_MODEL } from "./ai-gateway.server";

// ========== MIND MAPS ==========

export const listMindMaps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("mind_maps")
      .select("id, title, topic_slug, nodes, edges, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const generateMindMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        topic: z.string().min(2).max(200),
        area: z.string().optional(),
        extraContext: z.string().max(2000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const gateway = createGateway();
    const prompt = `Crie um mapa mental didático em português sobre "${data.topic}"${data.area ? ` (área: ${data.area})` : ""} focado no ENEM.
Retorne um nó central e 4-6 nós filhos principais; cada filho pode ter 2-4 sub-nós. Máximo 25 nós no total.
Cada nó tem apenas um "label" curto (até 60 caracteres). Sem markdown, sem emojis.
${data.extraContext ? `Contexto adicional do aluno:\n${data.extraContext.slice(0, 1500)}` : ""}`;

    const schema = z.object({
      title: z.string(),
      root: z.string(),
      children: z.array(
        z.object({
          label: z.string(),
          sub: z.array(z.string()).nullable(),
        }),
      ),
    });

    let result: z.infer<typeof schema>;
    try {
      const { output } = await generateText({
        model: gateway(CHAT_MODEL),
        output: Output.object({ schema }),
        prompt,
      });
      result = output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        result = { title: data.topic, root: data.topic, children: [] };
      } else {
        throw error;
      }
    }

    // Convert to React Flow nodes/edges.
    const nodes: Array<{ id: string; type?: string; data: { label: string }; position: { x: number; y: number } }> = [];
    const edges: Array<{ id: string; source: string; target: string }> = [];

    nodes.push({
      id: "root",
      type: "input",
      data: { label: result.root || data.topic },
      position: { x: 0, y: 0 },
    });

    const children = (result.children ?? []).slice(0, 6);
    const radius = 280;
    children.forEach((child, i) => {
      const angle = (i / Math.max(children.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const cx = Math.cos(angle) * radius;
      const cy = Math.sin(angle) * radius;
      const cid = `c-${i}`;
      nodes.push({ id: cid, data: { label: child.label }, position: { x: cx, y: cy } });
      edges.push({ id: `e-root-${cid}`, source: "root", target: cid });
      const subs = (child.sub ?? []).slice(0, 4);
      subs.forEach((s, j) => {
        const sid = `${cid}-s-${j}`;
        const subAngle = angle + ((j - (subs.length - 1) / 2) * 0.35);
        const sx = cx + Math.cos(subAngle) * 180;
        const sy = cy + Math.sin(subAngle) * 180;
        nodes.push({ id: sid, data: { label: s }, position: { x: sx, y: sy } });
        edges.push({ id: `e-${cid}-${sid}`, source: cid, target: sid });
      });
    });

    return { title: result.title || data.topic, nodes, edges };
  });

export const saveMindMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(1).max(200),
        topicSlug: z.string().max(80).optional(),
        nodes: z.array(z.any()),
        edges: z.array(z.any()),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: updated, error } = await context.supabase
        .from("mind_maps")
        .update({
          title: data.title,
          topic_slug: data.topicSlug ?? null,
          nodes: data.nodes,
          edges: data.edges,
        })
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }
    const { data: inserted, error } = await context.supabase
      .from("mind_maps")
      .insert({
        user_id: context.userId,
        title: data.title,
        topic_slug: data.topicSlug ?? null,
        nodes: data.nodes,
        edges: data.edges,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const deleteMindMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("mind_maps")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ========== NOTES (aggregate video_notes) ==========

export const listAllVideoNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("video_notes")
      .select("id, video_id, youtube_id, timestamp_seconds, style, ai_explanation, user_note, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ========== FLASHCARDS ==========

const INTERVALS_DAYS = [1, 3, 7, 15, 30];
const DAY_MS = 86_400_000;

export const listDueFlashcards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: cards, error } = await context.supabase
      .from("flashcards")
      .select("id, front, back, topic_slug, source, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: reviews } = await context.supabase
      .from("flashcard_reviews")
      .select("flashcard_id, next_review_at, quality, reviewed_at")
      .order("reviewed_at", { ascending: false });

    const latest = new Map<string, { next_review_at: string; quality: number }>();
    for (const r of reviews ?? []) {
      if (!latest.has(r.flashcard_id)) latest.set(r.flashcard_id, r);
    }
    const now = Date.now();
    const enriched = (cards ?? []).map((c) => {
      const last = latest.get(c.id);
      const due = !last || new Date(last.next_review_at).getTime() <= now;
      return { ...c, due, next_review_at: last?.next_review_at ?? null };
    });
    return {
      all: enriched,
      due: enriched.filter((c) => c.due),
    };
  });

export const generateFlashcards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        topic: z.string().min(2).max(200),
        topicSlug: z.string().max(80).optional(),
        count: z.number().int().min(1).max(15).default(6),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const gateway = createGateway();
    const schema = z.object({
      cards: z.array(z.object({ front: z.string(), back: z.string() })),
    });

    let result: z.infer<typeof schema>;
    try {
      const { output } = await generateText({
        model: gateway(CHAT_MODEL),
        output: Output.object({ schema }),
        prompt: `Crie ${data.count} flashcards curtos para revisar "${data.topic}" no ENEM.
Cada card: "front" é uma pergunta curta (uma frase), "back" é a resposta direta em 1-2 frases.
Sem markdown, sem numeração, sem emojis. Português claro e didático.`,
      });
      result = output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) return { inserted: 0 };
      throw error;
    }

    const rows = (result.cards ?? []).slice(0, data.count).map((c) => ({
      user_id: context.userId,
      topic_slug: data.topicSlug ?? null,
      front: c.front.slice(0, 500),
      back: c.back.slice(0, 1000),
      source: "ai",
    }));
    if (rows.length === 0) return { inserted: 0 };
    const { error } = await context.supabase.from("flashcards").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const recordFlashcardReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        flashcardId: z.string().uuid(),
        quality: z.number().int().min(0).max(5), // 0 = errou, 5 = fácil
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    // Simple spaced repetition: escala com base em quality
    const now = Date.now();
    let idx: number;
    if (data.quality <= 1) idx = 0;
    else if (data.quality === 2) idx = 1;
    else if (data.quality === 3) idx = 2;
    else if (data.quality === 4) idx = 3;
    else idx = 4;
    const nextMs = now + INTERVALS_DAYS[idx] * DAY_MS;

    const { error } = await context.supabase.from("flashcard_reviews").insert({
      user_id: context.userId,
      flashcard_id: data.flashcardId,
      quality: data.quality,
      reviewed_at: new Date(now).toISOString(),
      next_review_at: new Date(nextMs).toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true, nextReviewAt: new Date(nextMs).toISOString() };
  });

export const deleteFlashcard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("flashcards")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ========== SUMMARIES ==========

export const listSummaries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("study_summaries")
      .select("id, scope, scope_ref, title, content, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const generateSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        scope: z.enum(["week", "topic"]),
        topicSlug: z.string().max(80).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    // Gather activity signals
    const since = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const [notesRes, attemptsRes] = await Promise.all([
      context.supabase
        .from("video_notes")
        .select("ai_explanation, user_note, created_at")
        .eq("user_id", context.userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(40),
      context.supabase
        .from("lesson_attempts")
        .select("topic_id, score, total, completed_at")
        .eq("user_id", context.userId)
        .gte("completed_at", since)
        .order("completed_at", { ascending: false })
        .limit(20),
    ]);

    const notesTxt = (notesRes.data ?? [])
      .map((n) => `- ${(n.ai_explanation ?? "").slice(0, 200)}${n.user_note ? ` | eu: ${n.user_note.slice(0, 120)}` : ""}`)
      .join("\n");
    const attemptsTxt = (attemptsRes.data ?? [])
      .map((a) => `- Tópico ${a.topic_id}: ${a.score}/${a.total}`)
      .join("\n");

    const scopeLabel = data.scope === "week" ? "esta semana" : `o tópico ${data.topicSlug ?? ""}`;
    const gateway = createGateway();
    let text = "";
    try {
      const res = await generateText({
        model: gateway(CHAT_MODEL),
        prompt: `Você é professor(a) do ENEM. Escreva um resumo didático (300-500 palavras) sobre o que o aluno aprendeu em ${scopeLabel}, com base nos sinais abaixo.
Texto corrido em português, sem markdown, sem listas, sem emojis. Divida em 3-4 parágrafos: (1) o que foi estudado, (2) pontos que ficaram claros, (3) pontos que precisam de mais atenção, (4) próximo passo sugerido.

NOTAS DO ALUNO (últimos 7 dias):
${notesTxt || "(sem notas registradas)"}

ATIVIDADES:
${attemptsTxt || "(sem atividades registradas)"}`,
      });
      text = res.text.trim();
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Falha ao gerar resumo");
    }

    const title = data.scope === "week"
      ? `Resumo da semana — ${new Date().toLocaleDateString("pt-BR")}`
      : `Resumo do tópico — ${data.topicSlug ?? "geral"}`;

    const { data: inserted, error } = await context.supabase
      .from("study_summaries")
      .insert({
        user_id: context.userId,
        scope: data.scope,
        scope_ref: data.topicSlug ?? null,
        title,
        content: text,
      })
      .select("id, scope, scope_ref, title, content, created_at")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const deleteSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("study_summaries")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ========== DRAFTS ==========

export const listDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("study_drafts")
      .select("id, title, content, tags, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().max(200).default("Sem título"),
        content: z.string().max(50_000).default(""),
        tags: z.array(z.string().max(40)).max(15).default([]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: updated, error } = await context.supabase
        .from("study_drafts")
        .update({ title: data.title, content: data.content, tags: data.tags })
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select("id, title, content, tags, updated_at")
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }
    const { data: inserted, error } = await context.supabase
      .from("study_drafts")
      .insert({
        user_id: context.userId,
        title: data.title,
        content: data.content,
        tags: data.tags,
      })
      .select("id, title, content, tags, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const deleteDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("study_drafts")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
