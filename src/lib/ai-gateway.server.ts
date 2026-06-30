import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createGateway() {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}

export const CHAT_MODEL = "google/gemini-3-flash-preview";
