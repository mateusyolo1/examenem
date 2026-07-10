import { createServerFn } from "@tanstack/react-start";
import { requireAiAccess } from "@/lib/ai-access.middleware";
import { z } from "zod";

const input = z.object({
  tema: z.string().min(5).max(300),
  eixo: z.string().min(2).max(200).optional(),
});

export interface EssayPlan {
  tese: string;
  introducao: string;
  argumento1: { topico: string; desenvolvimento: string; repertorio: string };
  argumento2: { topico: string; desenvolvimento: string; repertorio: string };
  conclusao: string;
  propostaIntervencao: {
    agente: string;
    acao: string;
    meio: string;
    finalidade: string;
    detalhamento: string;
  };
  raw?: string;
}

export const generateEssayPlan = createServerFn({ method: "POST" })
  .middleware([requireAiAccess])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }) => {
    const { generateText } = await import("ai");
    const { createGateway, CHAT_MODEL } = await import("./ai-gateway.server");
    const gateway = createGateway();

    const system =
      "Você é um(a) professor(a) brasileiro(a) especialista em redação ENEM. " +
      "Monte um PLANO DE REDAÇÃO dissertativo-argumentativo, didático e exequível. " +
      "Responda APENAS com JSON válido, sem cercas de código, no formato:\n" +
      `{
  "tese": "<frase única que sintetiza o posicionamento>",
  "introducao": "<sugestão de parágrafo introdutório com contextualização + tese, ~3 frases>",
  "argumento1": {
    "topico": "<frase-síntese do 1º argumento>",
    "desenvolvimento": "<como desenvolver em ~3 frases>",
    "repertorio": "<um repertório sociocultural concreto a usar>"
  },
  "argumento2": {
    "topico": "...",
    "desenvolvimento": "...",
    "repertorio": "..."
  },
  "conclusao": "<sugestão de fechamento retomando a tese>",
  "propostaIntervencao": {
    "agente": "<quem>",
    "acao": "<o que fazer>",
    "meio": "<como/por meio de quê>",
    "finalidade": "<para quê>",
    "detalhamento": "<detalhe operacional>"
  }
}`;

    const { text } = await generateText({
      model: gateway(CHAT_MODEL),
      system,
      prompt: `Tema: ${data.tema}\nEixo temático: ${data.eixo ?? "—"}\n\nRetorne apenas o JSON.`,
    });

    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    try {
      const parsed = JSON.parse(slice) as EssayPlan;
      return { plan: parsed };
    } catch {
      return { plan: { raw: text } as EssayPlan };
    }
  });
