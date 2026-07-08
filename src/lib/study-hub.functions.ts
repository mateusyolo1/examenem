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

// ========== MIND MAP FROM VIDEO ==========

export type MindMapFromVideoResult = {
  central: string;
  branches: Array<{
    label: string;
    timestamp: number;
    children: Array<{ label: string; timestamp: number }>;
  }>;
  videoTitle: string;
  youtubeId: string;
  videoId: string;
};

/** List videos that the current user has processed (i.e. has notes for) —
 *  used by the "Gerar do vídeo…" picker inside the mind-map editor toolbar. */
export const listVideosForMindMap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("video_notes")
      .select(
        "video_id, created_at, study_videos:video_id(id, title, channel_name, youtube_id, thumbnail_url)",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const seen = new Set<string>();
    const out: Array<{
      videoId: string;
      youtubeId: string;
      title: string;
      channel: string;
      thumbnail: string;
    }> = [];
    for (const row of (data ?? []) as any[]) {
      const v = row.study_videos;
      if (!v?.id || seen.has(v.id)) continue;
      seen.add(v.id);
      out.push({
        videoId: v.id,
        youtubeId: v.youtube_id,
        title: v.title ?? "Vídeo sem título",
        channel: v.channel_name ?? "",
        thumbnail: v.thumbnail_url ?? "",
      });
    }
    return out;
  });

export const generateMindMapFromVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        videoId: z.string().uuid(),
        depth: z.enum(["panorama", "study", "complete"]).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<MindMapFromVideoResult> => {
    // 1. Load video
    const { data: video, error: vErr } = await context.supabase
      .from("study_videos")
      .select("id, title, youtube_id")
      .eq("id", data.videoId)
      .single();
    if (vErr || !video) throw new Error("Vídeo não encontrado.");

    // 2. Fetch transcript
    const { fetchTranscriptWithFallback } = await import("./youtube-transcripts.server");
    let transcript;
    try {
      transcript = await fetchTranscriptWithFallback(video.youtube_id);
    } catch (err) {
      throw new Error(
        `Sem legenda disponível para este vídeo. ${err instanceof Error ? err.message : ""}`.trim(),
      );
    }
    if (!transcript.text || transcript.text.length < 40) {
      throw new Error("Legenda muito curta para gerar um mapa mental.");
    }

    // 3. Build prompt
    const depth = data.depth ?? "study";
    const targets = {
      panorama: { branches: "3 a 4", children: "0" },
      study: { branches: "4 a 6", children: "2 a 3" },
      complete: { branches: "5 a 7", children: "3 a 4" },
    }[depth];

    const prompt = `Você é um assistente que monta mapas mentais didáticos em português.
Analise a transcrição abaixo (formato "M:SS — texto") de uma aula do YouTube e devolva um mapa mental hierárquico.

Título do vídeo: "${video.title ?? "Aula"}"
Profundidade: ${depth} — gere ${targets.branches} ramos principais${targets.children !== "0" ? `, cada ramo com ${targets.children} subitens (folhas)` : ", sem folhas"}.

Regras:
- "central": tema geral do vídeo em até 6 palavras.
- Cada ramo ("branches[i].label"): subtema principal, até 5 palavras, sem emoji.
- Cada folha ("children[i].label"): ponto-chave curto, até 8 palavras, sem markdown.
- "timestamp": segundos (inteiro) do momento na transcrição onde o assunto é abordado — use o "M:SS" da linha correspondente convertido para segundos.
- Não repita a mesma frase entre ramos/folhas. Se a profundidade for "panorama", devolva "children": [] em cada ramo.
- Responda SOMENTE no formato estruturado pedido, sem prosa.

Transcrição:
${transcript.text}`;

    const gateway = createGateway();
    let spec: z.infer<typeof MindMapFromVideoSpec>;
    try {
      const { output } = await generateText({
        model: gateway(CHAT_MODEL),
        output: Output.object({ schema: MindMapFromVideoSpec }),
        prompt,
      });
      spec = output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        // Fallback: try to parse raw text
        try {
          const raw = (error as any).text ?? "";
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            spec = MindMapFromVideoSpec.parse(JSON.parse(jsonMatch[0]));
          } else {
            throw error;
          }
        } catch {
          throw new Error("A IA não conseguiu montar o mapa. Tente novamente.");
        }
      } else {
        throw error;
      }
    }

    // 4. Clamp sizes (safety) + return
    const maxBranches = depth === "panorama" ? 4 : depth === "complete" ? 7 : 6;
    const maxChildren = depth === "panorama" ? 0 : depth === "complete" ? 4 : 3;
    const branches = spec.branches.slice(0, maxBranches).map((b) => ({
      label: (b.label || "").trim().slice(0, 60),
      timestamp: Math.max(0, Math.floor(b.timestamp || 0)),
      children: (b.children ?? []).slice(0, maxChildren).map((c) => ({
        label: (c.label || "").trim().slice(0, 80),
        timestamp: Math.max(0, Math.floor(c.timestamp || 0)),
      })),
    }));

    return {
      central: (spec.central || video.title || "Aula").trim().slice(0, 80),
      branches,
      videoTitle: video.title ?? "Aula",
      youtubeId: video.youtube_id,
      videoId: video.id,
    };
  });


// ========== NOTES (aggregate video_notes) ==========

export const listAllVideoNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("video_notes")
      .select(
        "id, video_id, youtube_id, timestamp_seconds, style, ai_explanation, user_note, created_at, study_videos:video_id(title, channel_name, thumbnail_url, topic_id, study_topics:topic_id(title))",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((n: any) => ({
      id: n.id,
      video_id: n.video_id,
      youtube_id: n.youtube_id,
      timestamp_seconds: n.timestamp_seconds,
      style: n.style,
      ai_explanation: n.ai_explanation,
      user_note: n.user_note,
      created_at: n.created_at,
      video_title: n.study_videos?.title ?? "Vídeo sem título",
      channel_name: n.study_videos?.channel_name ?? "",
      thumbnail_url: n.study_videos?.thumbnail_url ?? "",
      topic_id: n.study_videos?.topic_id ?? null,
      topic_title: n.study_videos?.study_topics?.title ?? "Sem tema",
    }));
  });

// ========== FLASHCARDS ==========

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
    const topic = data.topic.trim();
    const schema = z.object({
      cards: z.array(z.object({ front: z.string(), back: z.string() })),
    });

    const normalizeCards = (cards: Array<{ front: string; back: string }> | undefined) =>
      (cards ?? [])
        .map((card) => ({
          front: String(card.front ?? "").trim(),
          back: String(card.back ?? "").trim(),
        }))
        .filter((card) => card.front.length > 0 && card.back.length > 0)
        .slice(0, data.count);

    const fallbackCards = () => {
      const base = [
        {
          front: `O que é ${topic}?`,
          back: `Explique ${topic} com uma definição curta e conecte com um exemplo cobrado no ENEM.`,
        },
        {
          front: `Qual é a ideia principal de ${topic}?`,
          back: `Identifique o conceito central de ${topic} e escreva a palavra-chave que mais resume o tema.`,
        },
        {
          front: `Como ${topic} pode aparecer em uma questão?`,
          back: `Procure o enunciado, os dados do texto-base e a alternativa que melhor aplica o conceito de ${topic}.`,
        },
        {
          front: `Qual erro comum ao estudar ${topic}?`,
          back: `Evite decorar termos soltos; relacione ${topic} com causa, consequência e exemplo concreto.`,
        },
        {
          front: `Que exemplo ajuda a lembrar ${topic}?`,
          back: `Use um exemplo do cotidiano, de uma notícia ou de uma questão antiga para fixar ${topic}.`,
        },
        {
          front: `Como revisar ${topic} rapidamente?`,
          back: `Revise definição, palavras-chave, exemplo e uma aplicação em questão objetiva.`,
        },
      ];

      return Array.from({ length: data.count }, (_, index) =>
        base[index % base.length] ?? base[0],
      );
    };

    let cards: Array<{ front: string; back: string }> = [];
    try {
      const gateway = createGateway();
      try {
        const { output } = await generateText({
          model: gateway(CHAT_MODEL),
          output: Output.object({ schema }),
          prompt: `Crie ${data.count} flashcards curtos para revisar "${topic}" no ENEM.
Cada card: "front" é uma pergunta curta (uma frase), "back" é a resposta direta em 1-2 frases.
Sem markdown, sem numeração, sem emojis. Português claro e didático.`,
        });
        cards = normalizeCards(output.cards);
      } catch (structuredError) {
        if (!NoObjectGeneratedError.isInstance(structuredError)) throw structuredError;
      }

      if (cards.length === 0) {
        const { text } = await generateText({
          model: gateway(CHAT_MODEL),
          prompt: `Responda somente JSON válido no formato {"cards":[{"front":"...","back":"..."}]}.
Crie ${data.count} flashcards curtos para revisar "${topic}" no ENEM.
Cada front deve ser uma pergunta curta; cada back deve responder em 1-2 frases.`,
        });
        const jsonText = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
        const parsed = schema.safeParse(JSON.parse(jsonText));
        if (parsed.success) cards = normalizeCards(parsed.data.cards);
      }
    } catch {
      cards = [];
    }

    if (cards.length === 0) cards = fallbackCards();

    const rows = cards.map((c) => ({
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
    const intervalsDays = [1, 3, 7, 15, 30];
    const dayMs = 86_400_000;
    // Simple spaced repetition: escala com base em quality
    const now = Date.now();
    let idx: number;
    if (data.quality <= 1) idx = 0;
    else if (data.quality === 2) idx = 1;
    else if (data.quality === 3) idx = 2;
    else if (data.quality === 4) idx = 3;
    else idx = 4;
    const nextMs = now + intervalsDays[idx] * dayMs;

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
    const dayMs = 86_400_000;
    const since = new Date(Date.now() - 7 * dayMs).toISOString();
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
