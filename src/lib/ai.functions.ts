import { createServerFn } from "@tanstack/react-start";
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

export const askTutor = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tutorInput.parse(data))
  .handler(async ({ data }) => {
    const { generateText } = await import("ai");
    const { createGateway, CHAT_MODEL } = await import("./ai-gateway.server");
    const gateway = createGateway();
    const modeInstr = MODE_SYSTEM[data.mode ?? "livre"] ?? MODE_SYSTEM.livre;
    const ctx = data.context?.trim()
      ? `\n\nContexto do(a) aluno(a) (use quando relevante):\n${data.context.trim()}`
      : "";
    const { text } = await generateText({
      model: gateway(CHAT_MODEL),
      system:
        "Você é um(a) professor(a) particular brasileiro(a), especialista em ENEM, " +
        "paciente e didático(a). Responda sempre em português brasileiro, com clareza " +
        "e exemplos curtos. Cite a área (Linguagens, Humanas, Natureza ou Matemática) " +
        "quando fizer sentido.\n\n" +
        "FORMATAÇÃO (siga estritamente):\n" +
        "- Use markdown: **negrito**, *itálico*, ### títulos, listas com - ou 1., > citações, `código`.\n" +
        "- Fórmulas e símbolos matemáticos/químicos SEMPRE em LaTeX entre cifrões: " +
        "inline com $...$ e bloco com $$...$$. Ex.: $H_2O$, $$2H_2 + O_2 \\rightarrow 2H_2O$$. " +
        "Nunca escreva LaTeX sem cifrões (ex.: nunca escreva `\\rightarrow` ou `H_2` solto no texto).\n" +
        "- Não invente símbolos estranhos (✦, ❖, ►, etc.). Use apenas markdown padrão.\n" +
        "- Para subscritos/sobrescritos fora de fórmula, use $x_1$, $x^2$ — nunca x_1 ou x^2 em texto puro.\n\n" +
        modeInstr +
        ctx,
      messages: data.messages,
    });
    return { text };
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
