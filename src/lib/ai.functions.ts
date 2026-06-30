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
});

export const askTutor = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tutorInput.parse(data))
  .handler(async ({ data }) => {
    const { generateText } = await import("ai");
    const { createGateway, CHAT_MODEL } = await import("./ai-gateway.server");
    const gateway = createGateway();
    const { text } = await generateText({
      model: gateway(CHAT_MODEL),
      system:
        "Você é um(a) tutor(a) brasileiro(a) experiente em preparação para o ENEM. " +
        "Responda em português brasileiro, de forma clara, didática e direta. " +
        "Quando relevante, mostre o raciocínio passo a passo e cite a área (Linguagens, " +
        "Humanas, Natureza ou Matemática). Use exemplos curtos. Evite respostas longas demais.",
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
      const parsed = JSON.parse(slice);
      return { feedback: parsed as unknown };
    } catch {
      // Fallback: return raw text so UI still renders something useful
      return { feedback: { raw: text } as unknown };
    }
  });
