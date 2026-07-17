// Política pura de ferramentas + override documental do Tutor.
// Sem I/O, sem imports do SDK de IA. `askTutor` converte a política em
// opções concretas (tools / stopWhen).
//
// BLOCO 1: separado de `ai.functions.ts` para permitir testes unitários
// com bun:test sem subir TanStack/Supabase/gateway.

import type { LibraryRetrievalStatus } from "./library-rag.server";
import type { TutorIntent } from "./rag-intent";

export type TutorToolPolicy = "none" | "all" | "practice_only";

/**
 * Decide QUAIS ferramentas o Tutor pode usar, sem retornar objetos de tool
 * reais. `askTutor` mapeia:
 *   - "none"          → tools: undefined
 *   - "all"           → tools: <todas>
 *   - "practice_only" → tools: <somente mini_quiz/flashcards> (reservado; hoje
 *                       tratado como "all" pelo caller, mas expresso aqui para
 *                       permitir evolução sem retocar a política).
 *
 * Regras:
 *   - Intenção "documental" → SEMPRE "none" (Tutor vira consulta estrita).
 *   - Modo "redacao" preservado com tools completas (usa `rascunho_redacao`).
 *   - Modos "questoes"/"plano" preservados com "all".
 *   - Erro de RAG (embedding/rpc) NÃO altera política: só afeta o override
 *     textual — o Tutor continua funcional sem biblioteca.
 */
export function selectTutorToolPolicy(
  intent: TutorIntent,
  _mode: string | undefined,
  _ragStatus: LibraryRetrievalStatus | null,
): TutorToolPolicy {
  if (intent === "documental") return "none";
  return "all";
}

/**
 * Override textual injetado no system prompt quando a intenção é documental.
 * - Sem matches ok → instrução de RECUSA literal.
 * - Com matches ok → instrução de resposta estritamente documental + citação.
 * - Sem status (RAG desligado) → recusa curta (defensivo).
 */
export function buildDocumentalOverride(
  intent: TutorIntent,
  ragStatus: LibraryRetrievalStatus | null,
): string {
  if (intent !== "documental") return "";
  if (ragStatus === "ok") {
    return (
      "\n\nMODO CONSULTA DOCUMENTAL (obrigatório):\n" +
      "- Responda APENAS com base nos trechos citados da biblioteca.\n" +
      "- Cite cada afirmação no formato (trecho [N] — «Livro», p.X).\n" +
      "- NÃO use ferramentas (nota_de_aula, mini_quiz, flashcards etc.) neste modo."
    );
  }
  return (
    "\n\nMODO CONSULTA DOCUMENTAL (obrigatório):\n" +
    '- Responda literalmente: "Não encontrei referência na sua biblioteca sobre isso." e pare.\n' +
    "- NÃO invente conteúdo. NÃO use ferramentas."
  );
}
