import { createServerFn } from "@tanstack/react-start";
import { requireAiAccess } from "@/lib/ai-access.middleware";
import { z } from "zod";

const tutorInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
  mode: z
    .enum([
      "explicar",
      "resolver",
      "plano",
      "redacao",
      "revisao",
      "questoes",
      "erro",
      "livre",
    ])
    .optional(),
  context: z.string().max(2000).optional(),
  // Anexos de imagem para a ÚLTIMA mensagem do usuário (ex.: enunciado ENEM
  // com gráfico/figura). Enviados como partes multimodais ao modelo.
  imageUrls: z.array(z.string().url()).max(6).optional(),
  stage: z
    .object({
      assunto: z.string().max(200),
      etapaAtual: z.number().int().min(1).max(7),
      etapaAtualLabel: z.string().max(80),
      proximaEtapaLabel: z.string().max(80).optional(),
      prontoParaAvancar: z.boolean(),
      faltam: z.array(z.string().max(300)).max(10),
      taxaDeAcerto: z.number().min(0).max(100).optional(),
      questoesRespondidas: z.number().int().min(0).optional(),
      revisoesPendentes: z.number().int().min(0).optional(),
    })
    .optional(),
});

const MODE_SYSTEM: Record<string, string> = {
  livre:
    "Modo livre: responda a dúvida do(a) aluno(a) de forma didática e objetiva.",
  explicar:
    "Modo EXPLICAR CONTEÚDO: explique o tema solicitado de forma estruturada — definição, " +
    "intuição, exemplo prático do ENEM e mini-resumo final. Use linguagem acessível.",
  resolver:
    "Modo RESOLVER QUESTÃO PASSO A PASSO: identifique o que a questão pede, liste os dados, " +
    "mostre o raciocínio em passos numerados, justifique cada alternativa e conclua com a letra correta.",
  plano:
    "Modo PLANO DE ESTUDOS: monte um plano realista (por dias) considerando a meta diária e o " +
    "tempo disponível do(a) aluno(a). Para cada dia liste área, assunto, atividade e tempo estimado.",
  redacao:
    "Modo CORREÇÃO DE REDAÇÃO: avalie segundo as 5 competências do ENEM, dê nota 0-200 em cada, " +
    "comente pontos fortes/fracos e sugira reescritas. Tom educativo.",
  revisao:
    "Modo REVISÃO RÁPIDA: produza um resumo enxuto com bullets, fórmulas, mnemônicos e 3 perguntas " +
    "rápidas de autoavaliação ao final.",
  questoes:
    "Modo CRIAR QUESTÕES PARECIDAS: gere 3-5 questões inéditas no estilo ENEM sobre o tema, com " +
    "5 alternativas (A-E), gabarito e explicação curta de cada resposta.",
  erro:
    "Modo EXPLICAR ERRO: analise por que a resposta do(a) aluno(a) está errada, mostre o caminho " +
    "correto passo a passo, aponte a confusão conceitual típica e dê 1 dica para não errar de novo.",
};

const STAGE_BEHAVIOR: Record<number, string> = {
  1:
    "ETAPA 1 — INTRODUÇÃO: o(a) aluno(a) está começando do zero. Explique o conteúdo de forma " +
    "bem simples, com analogias do dia a dia, sem jargão. Foque em 'o que é' e 'por que importa'. " +
    "Evite questões complexas; no máximo 1 pergunta de checagem ao final.",
  2:
    "ETAPA 2 — TEORIA: aprofunde a teoria essencial (definições, fórmulas, casos típicos). " +
    "Ao final, faça 2–3 perguntas curtas de verificação para o(a) aluno(a) responder.",
  3:
    "ETAPA 3 — QUESTÕES GUIADAS: resolva questões JUNTO com o(a) aluno(a), passo a passo. " +
    "Mostre o raciocínio completo, explicando cada decisão e por que descartar cada alternativa.",
  4:
    "ETAPA 4 — QUESTÕES INDEPENDENTES: proponha questões no estilo ENEM e NÃO entregue a resposta " +
    "de imediato. Peça que o(a) aluno(a) tente primeiro; só revele o gabarito quando ele(a) responder " +
    "ou pedir explicitamente. Dê dicas progressivas se travar.",
  5:
    "ETAPA 5 — REVISÃO DE ERROS: foque nos erros recentes do(a) aluno(a). Reveja conceitos fracos, " +
    "explique o motivo do erro e proponha 1–2 questões parecidas para fixação.",
  6:
    "ETAPA 6 — MINI SIMULADO: gere um mini simulado cronometrado (5 questões no estilo ENEM, com " +
    "tempo sugerido — ex.: 15 minutos). Apresente as questões primeiro, peça para o(a) aluno(a) " +
    "marcar as respostas e só depois mostre o gabarito comentado.",
  7:
    "ETAPA 7 — ASSUNTO DOMINADO: parabenize o(a) aluno(a) e sugira o próximo assunto relacionado " +
    "para continuar a evolução, justificando a escolha.",
};

const STAGE_LABELS: Record<number, string> = {
  1: "Introdução",
  2: "Teoria",
  3: "Questões guiadas",
  4: "Questões independentes",
  5: "Revisão de erros",
  6: "Mini simulado",
  7: "Assunto dominado",
};

// Tipos serializáveis dos resultados de ferramentas (renderizados no UI)
export type TutorToolResult =
  | {
      kind: "nota_de_aula";
      titulo: string;
      definicao: string;
      pontosChave: string[];
      exemplo?: string;
      macete?: string;
    }
  | {
      kind: "mini_quiz";
      titulo: string;
      perguntas: Array<{
        pergunta: string;
        alternativas: string[];
        correta: number;
        explicacao: string;
      }>;
    }
  | {
      kind: "flashcards";
      titulo: string;
      cards: Array<{ frente: string; verso: string }>;
    }
  | {
      kind: "revisar_erro_passado";
      pergunta: string;
      respostaCorreta: string;
      explicacao: string;
      dica: string;
    }
  | {
      kind: "sugerir_aula_fraca";
      slug: string;
      area: string;
      justificativa: string;
    }
  | {
      kind: "rascunho_redacao";
      tema: string;
      tese: string;
      argumentos: string[];
      repertorios: string[];
      propostaIntervencao: string;
    };

export const askTutor = createServerFn({ method: "POST" })
  .middleware([requireAiAccess])
  .inputValidator((data: unknown) => tutorInput.parse(data))
  .handler(async ({ data, context }) => {
    const { generateText, tool, stepCountIs } = await import("ai");
    const { z: zod } = await import("zod");
    const { createGateway } = await import("./ai-gateway.server");
    const { loadStudentMemory, memoryToPromptContext } = await import("./tutor-memory.server");
    const {
      retrieveLibraryContextDetailed,
      retrieveLibraryFigures,
      libraryMatchesToPrompt,
      libraryFiguresToPrompt,
      libraryStatusUiMessage,
    } = await import("./library-rag.server");


    const { detectTutorIntent } = await import("./rag-intent");
    const { selectTutorToolPolicy, buildDocumentalOverride } = await import(
      "./tutor-rag-policy"
    );

    const gateway = createGateway();
    const modeInstr = MODE_SYSTEM[data.mode ?? "livre"] ?? MODE_SYSTEM.livre;
    const ctx = data.context?.trim()
      ? `\n\nContexto do(a) aluno(a) (use quando relevante):\n${data.context.trim()}`
      : "";

    // Carrega prontuário do banco
    const memory = await loadStudentMemory(context.supabase, context.userId);
    const memoryCtx = memoryToPromptContext(memory);

    // Intenção decidida ANTES do retrieval e independente do score.
    const lastUserMsg =
      [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const intent = detectTutorIntent({
      message: lastUserMsg,
      mode: data.mode,
    });

    // RAG: trechos da biblioteca ativa do aluno. BLOCO 1: sem filtro por score;
    // o consumo apenas injeta os matches puros do top-K devolvidos pela RPC.
    const ragQuery = [data.context?.trim(), lastUserMsg]
      .filter(Boolean)
      .join("\n")
      .slice(0, 1500);
    const libraryResult = ragQuery
      ? await retrieveLibraryContextDetailed(context.supabase, context.userId, ragQuery, 5)
      : null;
    const libraryMatches = libraryResult?.matches ?? [];
    const libraryCtx = libraryMatchesToPrompt(libraryMatches);
    const libraryUiMessage = libraryResult
      ? libraryStatusUiMessage(libraryResult.status)
      : "";

    // Anexos multimodais da biblioteca: figuras das páginas dos matches,
    // sempre que existirem — independente de intent. Respeita o teto de 6
    // imagens total (imageUrls do enunciado têm prioridade).
    const enunciadoImgsCount = data.imageUrls?.length ?? 0;
    const figureBudget = Math.max(0, 6 - enunciadoImgsCount);
    let libraryFigures: Awaited<ReturnType<typeof retrieveLibraryFigures>> = [];
    if (
      figureBudget > 0 &&
      libraryResult &&
      libraryResult.hasFigurePages.length > 0 &&
      libraryMatches.length > 0
    ) {
      try {
        libraryFigures = await retrieveLibraryFigures(
          context.supabase,
          context.userId,
          libraryMatches,
          figureBudget,
        );
      } catch (e) {
        console.warn("[askTutor] retrieveLibraryFigures falhou", e);
        libraryFigures = [];
      }
    }


    const toolPolicy = selectTutorToolPolicy(
      intent,
      data.mode,
      libraryResult?.status ?? null,
    );
    

    const imagesInstr = (data.imageUrls?.length ?? 0)
      ? "\n\nIMAGENS ANEXADAS: a mensagem do(a) aluno(a) inclui " +
        `${data.imageUrls!.length} imagem(ns) do enunciado (gráficos, figuras, tabelas). ` +
        "Descreva brevemente o que vê, use os dados visuais para resolver a questão e cite " +
        "elementos concretos da imagem (eixos, valores, legendas) no raciocínio."
      : "";






    let stageInstr = "";
    let stageCtx = "";
    let closingInstr =
      "\n\nENCERRAMENTO OBRIGATÓRIO: toda resposta DEVE terminar com a seção " +
      "`### Próximo passo recomendado` contendo, em bullets:\n" +
      "- **Etapa atual:** <número e nome>\n" +
      "- **Pode avançar?** Sim/Não\n" +
      "- **Falta para avançar:** <itens ou 'nada — pronto para avançar'>\n" +
      "- **Ação recomendada agora:** <uma frase prática>";

    if (data.stage) {
      const s = data.stage;
      const proxima =
        s.proximaEtapaLabel ??
        (s.etapaAtual < 7 ? STAGE_LABELS[s.etapaAtual + 1] : "—");
      stageInstr =
        "\n\nADAPTAÇÃO POR ETAPA DE APRENDIZADO (obrigatório seguir):\n" +
        (STAGE_BEHAVIOR[s.etapaAtual] ?? "");
      stageCtx =
        `\n\nEtapa de aprendizado do(a) aluno(a) neste assunto:\n` +
        `- Assunto: ${s.assunto}\n` +
        `- Etapa atual: ${s.etapaAtual}/7 — ${s.etapaAtualLabel}\n` +
        `- Próxima etapa: ${proxima}\n` +
        `- Pronto para avançar: ${s.prontoParaAvancar ? "Sim" : "Não"}\n` +
        (s.faltam.length
          ? `- Falta: ${s.faltam.map((f) => `(${f})`).join(" ")}\n`
          : "- Falta: nada — critérios cumpridos.\n") +
        (typeof s.taxaDeAcerto === "number"
          ? `- Taxa de acerto: ${s.taxaDeAcerto}%\n`
          : "") +
        (typeof s.questoesRespondidas === "number"
          ? `- Questões respondidas: ${s.questoesRespondidas}\n`
          : "") +
        (typeof s.revisoesPendentes === "number"
          ? `- Revisões pendentes: ${s.revisoesPendentes}\n`
          : "");
      closingInstr +=
        `\n\nUse EXATAMENTE estes dados na seção final: etapa ${s.etapaAtual} (${s.etapaAtualLabel}); ` +
        `pode avançar = ${s.prontoParaAvancar ? "Sim" : "Não"}; ` +
        (s.faltam.length
          ? `falta = ${s.faltam.join("; ")}.`
          : "falta = nada (pronto para avançar).");
    }

    const collectedResults: TutorToolResult[] = [];

    const tools = {
      nota_de_aula: tool({
        description:
          "Cria uma NOTA DE AULA visual sobre um conceito — use SEMPRE que for ensinar teoria nova, " +
          "em vez de despejar texto corrido. Devolve card com definição, pontos-chave e exemplo.",
        inputSchema: zod.object({
          titulo: zod.string().describe("Nome do conceito ou tópico"),
          definicao: zod.string().describe("Definição clara em 1-2 frases"),
          pontosChave: zod.array(zod.string()).describe("3-5 pontos essenciais"),
          exemplo: zod.string().nullable().describe("Exemplo aplicado ao ENEM"),
          macete: zod.string().nullable().describe("Mnemônico ou dica curta"),
        }),
        execute: async (input) => {
          const result: TutorToolResult = {
            kind: "nota_de_aula",
            titulo: input.titulo,
            definicao: input.definicao,
            pontosChave: input.pontosChave,
            exemplo: input.exemplo ?? undefined,
            macete: input.macete ?? undefined,
          };
          collectedResults.push(result);
          return result;
        },
      }),
      mini_quiz: tool({
        description:
          "Gera um MINI QUIZ interativo (1 a 3 questões) para o aluno praticar o que acabou de aprender. " +
          "Use SEMPRE após uma nota_de_aula, ou quando o aluno pedir para praticar/testar.",
        inputSchema: zod.object({
          titulo: zod.string().describe("Título do mini quiz"),
          perguntas: zod
            .array(
              zod.object({
                pergunta: zod.string(),
                alternativas: zod.array(zod.string()).describe("Exatamente 4 alternativas"),
                correta: zod.number().int().min(0).max(3),
                explicacao: zod.string(),
              }),
            )
            .min(1)
            .max(3),
        }),
        execute: async (input) => {
          const result: TutorToolResult = { kind: "mini_quiz", ...input };
          collectedResults.push(result);
          return result;
        },
      }),
      flashcards: tool({
        description:
          "Cria um deck de FLASHCARDS (frente/verso) para memorização espaçada. Ideal para vocabulário, " +
          "datas, fórmulas, definições rápidas.",
        inputSchema: zod.object({
          titulo: zod.string(),
          cards: zod
            .array(zod.object({ frente: zod.string(), verso: zod.string() }))
            .min(3)
            .max(8),
        }),
        execute: async (input) => {
          const result: TutorToolResult = { kind: "flashcards", ...input };
          collectedResults.push(result);
          return result;
        },
      }),
      revisar_erro_passado: tool({
        description:
          "Retoma UM erro recente do(a) aluno(a) registrado no prontuário e reexplica com outro ângulo. " +
          "Use quando o(a) aluno(a) parecer confuso(a) sobre um tema em que já errou antes, ou quando " +
          "quiser mostrar 'a gente já viu isso, olha o que aconteceu'.",
        inputSchema: zod.object({
          pergunta: zod.string().describe("A pergunta original que ele(a) errou"),
          respostaCorreta: zod.string(),
          explicacao: zod.string().describe("Por que essa era a correta, com outro ângulo"),
          dica: zod.string().describe("Uma dica para não errar de novo"),
        }),
        execute: async (input) => {
          const result: TutorToolResult = { kind: "revisar_erro_passado", ...input };
          collectedResults.push(result);
          return result;
        },
      }),
      sugerir_aula_fraca: tool({
        description:
          "Sugere ao aluno estudar um tópico em que ele está fraco (score < 60% no prontuário). " +
          "Devolve o slug do tópico + área + por que sugere.",
        inputSchema: zod.object({
          slug: zod.string(),
          area: zod.string(),
          justificativa: zod.string(),
        }),
        execute: async (input) => {
          const result: TutorToolResult = { kind: "sugerir_aula_fraca", ...input };
          collectedResults.push(result);
          return result;
        },
      }),
      rascunho_redacao: tool({
        description:
          "Monta um RASCUNHO/ROTEIRO estruturado de redação sobre um tema: tese, 2-3 argumentos, " +
          "repertórios socioculturais aplicáveis e proposta de intervenção. Use quando o aluno " +
          "quiser ajuda para começar uma redação.",
        inputSchema: zod.object({
          tema: zod.string(),
          tese: zod.string().describe("Tese que o aluno pode defender"),
          argumentos: zod.array(zod.string()).min(2).max(3),
          repertorios: zod.array(zod.string()).min(2).max(4),
          propostaIntervencao: zod
            .string()
            .describe("Proposta com agente, ação, meio, efeito, detalhamento"),
        }),
        execute: async (input) => {
          const result: TutorToolResult = { kind: "rascunho_redacao", ...input };
          collectedResults.push(result);
          return result;
        },
      }),
    };

    const teachingInstr =
      "\n\nCOMO ENSINAR (obrigatório):\n" +
      "Você tem FERRAMENTAS de ensino. USE-AS ativamente — não seja só texto:\n" +
      "- Ao ensinar conceito novo: chame `nota_de_aula` em vez de despejar teoria.\n" +
      "- Depois da teoria: chame `mini_quiz` (1-3 questões) para o(a) aluno(a) praticar.\n" +
      "- Se o aluno pedir para memorizar algo: chame `flashcards`.\n" +
      "- Se detectar que ele(a) já errou algo parecido no prontuário: chame `revisar_erro_passado`.\n" +
      "- Se for útil sugerir uma aula do plano: chame `sugerir_aula_fraca`.\n" +
      "- Se for tema de redação: chame `rascunho_redacao`.\n" +
      "Pode combinar 2-3 ferramentas em uma mesma resposta (ex.: nota_de_aula + mini_quiz).\n" +
      "Depois de usar as ferramentas, escreva UM texto curto conectando os cards e propondo o próximo passo.\n\n" +
      "CITAÇÃO DE FONTES (obrigatório quando houver bloco 'TRECHOS DA BIBLIOTECA DO ALUNO'):\n" +
      "- Sempre que usar informação vinda dos trechos, cite inline no formato " +
      "(trecho [N] — «Livro», p.X) logo após a afirmação.\n" +
      "- Use apenas os trechos fornecidos; NÃO invente conteúdo fora deles.\n" +
      "- Se houver figuras anexadas e você as referenciar, use (figura [N] — «Livro», p.X).\n" +
      "- Se nenhum trecho for relevante, diga explicitamente: não encontrei referência " +
      "na sua biblioteca sobre isso.";

    // Override documental (função pura em tutor-rag-policy).
    const documentalOverride = buildDocumentalOverride(
      intent,
      libraryResult?.status ?? null,
    );

    const { text } = await generateText({
      model: gateway("openai/gpt-5-mini"),
      providerOptions: { lovable: { service_tier: "priority" } },
      tools: toolPolicy === "none" ? undefined : tools,
      stopWhen: toolPolicy === "none" ? undefined : stepCountIs(50),
      system:
        "Você é um(a) professor(a) particular brasileiro(a), especialista em ENEM, " +
        "paciente e didático(a). Age como um HUMANO ensinando: usa ferramentas visuais " +
        "(notas de aula, mini quizzes, flashcards), lembra do que o(a) aluno(a) já " +
        "estudou/errou, e propõe próximos passos concretos. Responda sempre em português " +
        "brasileiro.\n\n" +
        "FORMATAÇÃO (siga estritamente):\n" +
        "- Use markdown: **negrito**, *itálico*, ### títulos, listas com - ou 1., > citações, `código`.\n" +
        "- Fórmulas e símbolos matemáticos/químicos SEMPRE em LaTeX entre cifrões: " +
        "inline com $...$ e bloco com $$...$$. Ex.: $H_2O$, $$2H_2 + O_2 \\rightarrow 2H_2O$$. " +
        "Nunca escreva LaTeX sem cifrões.\n" +
        "- Não invente símbolos estranhos (✦, ❖, ►, etc.). Use apenas markdown padrão.\n\n" +
        modeInstr +
        teachingInstr +
        stageInstr +
        memoryCtx +
        libraryCtx +
        imagesInstr +
        ctx +
        stageCtx +
        documentalOverride +
        closingInstr,
      messages: (() => {
        const imgs = data.imageUrls ?? [];
        const figImgs = libraryFigures.map((f) => f.url);
        if (imgs.length === 0 && figImgs.length === 0) return data.messages;
        const msgs = data.messages.map((m) => ({ ...m }));
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === "user") {
            const text = msgs[i].content;
            (msgs[i] as unknown as { content: unknown }).content = [
              { type: "text", text },
              ...imgs.map((url) => ({ type: "image", image: url })),
              ...figImgs.map((url) => ({ type: "image", image: url })),
            ];
            break;
          }
        }
        return msgs as typeof data.messages;
      })(),

    });

    // Retorno enxuto: sem threshold, traceId, timings, scores nem sourcesDiag.
    // Diagnóstico técnico fica apenas nos logs backend (library-rag.server.ts).
    return {
      text,
      toolResults: collectedResults,
      memorySummary: memory.topicSummary,
      libraryCitations: libraryMatches.map((m, i) => ({
        n: i + 1,
        bookTitle: (m.metadata?.bookTitle as string | undefined) ?? "livro",
        page: (m.metadata?.page as number | undefined) ?? null,
      })),
      library: libraryResult
        ? {
            status: libraryResult.status,
            uiMessage: libraryUiMessage,
            intent,
          }
        : { status: "no_active_books" as const, uiMessage: "", intent },
    };

  });


const essayInput = z.object({
  theme: z.string().min(5).max(300),
  text: z.string().min(50).max(8000),
});

export interface EssayCompetency {
  numero: number;
  titulo: string;
  nota: number;
  comentario: string;
  pontosFortes: string[];
  pontosMelhorar: string[];
  sugestaoReescrita: string;
}
export interface EssayRepertorio {
  titulo: string;
  descricao: string;
}
export interface EssayFeedback {
  notaFinal?: number;
  diagnosticoGeral?: string;
  competencias?: EssayCompetency[];
  repertorios?: EssayRepertorio[];
  novaVersao?: string;
  raw?: string;
}

export const correctEssay = createServerFn({ method: "POST" })
  .middleware([requireAiAccess])
  .inputValidator((data: unknown) => essayInput.parse(data))
  .handler(async ({ data }) => {
    const { generateText } = await import("ai");
    const { createGateway, CHAT_MODEL } = await import("./ai-gateway.server");
    const gateway = createGateway();
    const system =
      "Você é um(a) corretor(a) oficial de redação do ENEM com tom educativo e empático. " +
      "Avalie o texto segundo as 5 competências (cada uma de 0 a 200, múltiplos de 40 quando possível):\n" +
      "C1 Domínio da norma culta (escrita formal);\n" +
      "C2 Compreensão do tema e uso de repertório sociocultural;\n" +
      "C3 Organização e argumentação;\n" +
      "C4 Coesão textual (conectivos, referenciação, progressão);\n" +
      "C5 Proposta de intervenção (agente, ação, meio, efeito, detalhamento) com respeito aos direitos humanos.\n\n" +
      "Para CADA competência forneça: nota, comentário objetivo (2-3 frases didáticas), pontos fortes, " +
      "pontos a melhorar e UMA sugestão prática de reescrita de um trecho.\n" +
      "Inclua também: diagnóstico geral (parágrafo curto), 3-5 repertórios socioculturais aplicáveis ao tema " +
      "(filósofos, dados, leis, obras, eventos históricos) e uma nova versão melhorada da redação " +
      "(texto dissertativo-argumentativo completo, 4-5 parágrafos).\n\n" +
      "Responda APENAS com JSON válido, sem cercas de código, exatamente neste formato:\n" +
      `{
  "notaFinal": <0-1000, soma das 5 competências>,
  "diagnosticoGeral": "<parágrafo educativo>",
  "competencias": [
    {
      "numero": 1,
      "titulo": "Domínio da escrita formal",
      "nota": <0-200>,
      "comentario": "<2-3 frases>",
      "pontosFortes": ["...", "..."],
      "pontosMelhorar": ["...", "..."],
      "sugestaoReescrita": "<reescreva um trecho específico do texto>"
    },
    { "numero": 2, "titulo": "Compreensão do tema e repertório", ... },
    { "numero": 3, "titulo": "Organização e argumentação", ... },
    { "numero": 4, "titulo": "Coesão textual", ... },
    { "numero": 5, "titulo": "Proposta de intervenção", ... }
  ],
  "repertorios": [
    { "titulo": "<nome>", "descricao": "<como aplicar ao tema>" }
  ],
  "novaVersao": "<redação completa reescrita>"
}`;

    const { text } = await generateText({
      model: gateway(CHAT_MODEL),
      system,
      prompt: `Tema da redação: ${data.theme}\n\nTexto do(a) estudante:\n"""\n${data.text}\n"""\n\nRetorne apenas o JSON.`,
    });

    // Parse JSON (model may wrap in ```json fences)
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    try {
      const parsed = JSON.parse(slice) as EssayFeedback;
      return { feedback: parsed };
    } catch {
      const fallback: EssayFeedback = { raw: text };
      return { feedback: fallback };
    }
  });
