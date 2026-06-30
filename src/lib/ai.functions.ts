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

export const correctEssay = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => essayInput.parse(data))
  .handler(async ({ data }) => {
    const { generateText } = await import("ai");
    const { createGateway, CHAT_MODEL } = await import("./ai-gateway.server");
    const gateway = createGateway();
    const { text } = await generateText({
      model: gateway(CHAT_MODEL),
      system:
        "Você é um(a) corretor(a) oficial de redação do ENEM. Avalie o texto do(a) estudante " +
        "segundo as 5 competências (cada uma de 0 a 200): " +
        "C1 Domínio da norma culta; C2 Compreensão do tema; C3 Argumentação; " +
        "C4 Coesão e mecanismos linguísticos; C5 Proposta de intervenção com agentes, " +
        "ações, meios, efeitos e respeito aos direitos humanos. " +
        "Responda SEMPRE em Markdown nesta estrutura exata:\n\n" +
        "## Nota final: <0-1000>\n\n" +
        "### Competência 1 — <nota>/200\n<comentário curto>\n\n" +
        "### Competência 2 — <nota>/200\n<comentário curto>\n\n" +
        "### Competência 3 — <nota>/200\n<comentário curto>\n\n" +
        "### Competência 4 — <nota>/200\n<comentário curto>\n\n" +
        "### Competência 5 — <nota>/200\n<comentário curto>\n\n" +
        "### Pontos fortes\n- ...\n\n### O que melhorar\n- ...",
      prompt: `Tema da redação: ${data.theme}\n\nTexto do(a) estudante:\n"""\n${data.text}\n"""`,
    });
    return { feedback: text };
  });
