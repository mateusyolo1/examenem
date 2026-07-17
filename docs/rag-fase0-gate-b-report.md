# RAG Fase 0 — Gate B (relatório)

> Status: **Gate A entregue**, aguardando calibração empírica e aprovação para aplicar o SQL v2.

## O que foi entregue (Gate A, sem migration, sem deploy manual)

- `src/lib/rag-config.ts` — constantes congeladas, validações, `getRagMinSimilarity()`.
  - `RAG_MIN_SIMILARITY = 0.55` **PROVISIONAL** (a ser sobrescrito no Gate B).
  - `RAG_IS_CALIBRATED = false`.
- `src/lib/rag-intent.ts` — `detectTutorIntent()` determinístico, sem ML. Padrões
  lexicais + `mode` do UI + toggle explícito. Nunca usa o resultado do
  retrieval para decidir intenção (ressalva #3).
- `src/lib/rag-normalize.ts` — normalização + `jaccard` + `trigramOverlap` +
  `isSufficientParaphrase` (combina 2 sinais; overlap sozinho não decide —
  ressalva #4).
- `src/lib/library-rag.server.ts` — reescrito com contrato Fase 0:
  - `LibraryRetrievalResult { status, matches, rawMatches, threshold, timings, traceId, detail? }`.
  - Statuses: `ok | no_active_books | embedding_auth_error | embedding_upstream_error | no_embedding | rpc_error | no_relevant_matches | unknown_error` (substitui o antigo "unauthorized" por `embedding_auth_error` — ressalva #3).
  - `traceId = rag_<base36ts>_<rnd>` gerado no backend (ressalva do usuário).
  - **Interim:** ainda chama `match_library_chunks` (v1) e filtra por threshold
    no cliente. `_v2` só será chamada quando o SQL for aplicado no Gate B.
  - Compat: mantém `retrieveLibraryContext(...) : LibraryMatch[]` para não
    quebrar Lousa/Redação existentes.
- `src/lib/ai.functions.ts` (`askTutor`) — integra intent + retrieval V2 +
  `sourcesDiag` para admins da allowlist.
  - **Consulta documental** → tools desativadas, prompt reforça citação estrita.
  - Resposta agora inclui `library.{status,uiMessage,threshold,traceId,intent}`.
  - `sourcesDiag` só é devolvido quando `claims.email` está em `ALLOWLIST`
    (backend decide — nunca o front).
- `supabase/migrations-pending/GATE_B_match_library_chunks_v2.sql` — SQL da
  RPC v2 **não aplicado**. Traz validação plpgsql (`RAISE` para threshold e
  `match_count` fora do intervalo — ressalva #2) e aplica o filtro dentro da
  CTE antes do `LIMIT`.

## O que ainda falta antes de aprovar o Gate B

1. **Calibração empírica de `RAG_MIN_SIMILARITY`.**
   - Definir 15–20 consultas rotuladas (relevantes vs. irrelevantes) por livro.
   - Rodar `retrieveLibraryContextV2` sem filtro, coletar `rawMatches[].similarity`.
   - Escolher threshold com precisão >= 0.85 na coorte anotada.
   - Registrar em `src/lib/__tests__/fixtures/rag-calibration.json`.
   - Atualizar `RAG_MIN_SIMILARITY` + `RAG_IS_CALIBRATED = true`.
2. **Testes unitários.**
   - Projeto ainda não tem framework de testes instalado.
   - Instalar `vitest` + `@vitest/coverage-v8` como devDep no Gate B.
   - Suítes propostas:
     - `rag-intent.test.ts` — cobre padrões lexicais, `mode`, toggle.
     - `rag-normalize.test.ts` — jaccard/trigram/isSufficientParaphrase.
     - `library-rag.server.test.ts` — mocks de supabase + fetch, cada status.
3. **Aplicar migration `GATE_B_match_library_chunks_v2.sql`** e trocar o
   caller em `library-rag.server.ts` para `match_library_chunks_v2` com
   `match_threshold: getRagMinSimilarity()`. Remover o filtro cliente interim.
4. **UI `SourcesPanel` (duas camadas):** camada pública (livro + página +
   trecho colado) sempre visível quando `library.status === 'ok'`; camada
   diagnóstica (traceId, timings, similarities cruas) só quando
   `sourcesDiag != null` (admin).

## Chamadas ainda em compat (v1)

- `src/lib/lousa.functions.ts:285` → `retrieveLibraryContext` (contrato antigo)
- `src/lib/library.functions.ts:352` → chama `match_library_chunks` diretamente

Ambos continuarão funcionando pela ponte compat. Migrar no Gate B junto com a
troca para `_v2`.

## Como executar a calibração (rascunho)

Script isolado para rodar via `bunx vite-node` ou similar, quando `vitest`
estiver instalado. Enquanto isso, dá para chamar `retrieveLibraryContextV2`
em um handler dev-only e coletar `rawMatches[].similarity`.
