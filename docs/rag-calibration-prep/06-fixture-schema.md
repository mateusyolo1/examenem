# Schema da fixture de calibração

A fixture é o registro canônico do experimento. Toda linha dela deve ser reproduzível a partir dos dados aqui listados. Vai ser salva como `fixture-YYYYMMDD-HHMM.json` na etapa de execução (fora deste bloco preparatório).

## Cabeçalho — metadados imutáveis do experimento

| Campo | Origem | Como será preenchido |
|---|---|---|
| `experiment_id` | gerado | `rag-calib-<YYYYMMDD>-<HHMM>` |
| `run_started_at` | gerado | ISO-8601 UTC |
| `run_finished_at` | gerado | ISO-8601 UTC |
| `code_commit` | `git rev-parse HEAD` no sandbox no início do run | commit SHA de 40 hex |
| `code_dirty` | `git status --porcelain` no sandbox | boolean; se `true`, `code_diff_summary` lista arquivos alterados |
| `runner_env` | gerado | `{ node_version, bun_version, os }` do sandbox |
| `qa_account_email` | você me passa | string; NUNCA logada em texto claro fora da fixture — usar hash SHA-256 do email |
| `qa_account_user_id` | verificado por SQL | uuid |
| `main_account_isolation_proof` | verificado por SQL | `{ qa_user_id: uuid, main_user_id_confirmed_different: true }` |

## Chunker — parâmetros efetivos lidos do código no commit do experimento

| Campo | Valor esperado (do código atual) |
|---|---|
| `chunker_algorithm` | `"fixed-size sliding window over normalized whitespace, per page"` |
| `chunker_source_file` | `"src/routes/_authenticated/biblioteca.tsx"` |
| `chunker_source_lines` | `"78-96"` |
| `chunk_size_chars` | `1100` |
| `chunk_overlap_chars` | `150` |
| `page_isolation` | `true` (chunks nunca cruzam páginas) |
| `whitespace_normalization` | `"/\\s+/g -> ' ', then .trim()"` |
| `token_based` | `false` (por caractere, não por token) |

Todos esses campos vêm de leitura estática do arquivo no commit registrado, não de configuração externa. Se qualquer valor no código mudar entre o Gate B e uma re-execução futura, a fixture antiga fica marcada como não reproduzível.

## Embedding model — verificado em runtime, não só no código

| Campo | Como preenchido |
|---|---|
| `embedding_model_id_declared` | lido de `src/lib/library.functions.ts` |
| `embedding_model_id_used` | valor efetivamente enviado ao gateway na primeira chamada |
| `embedding_dims_declared` | `3072` (da coluna `halfvec(3072)`) |
| `embedding_dims_measured` | `.length` do primeiro `data[0].embedding` recebido — falha o experimento se ≠ 3072 |
| `embedding_provider_reported_model` | `response.model` do gateway (pode ter forma diferente do ID enviado) |
| `first_embedding_call_timestamp` | ISO-8601 |

## PDF A (real) — snapshot completo

| Campo | Origem |
|---|---|
| `book_id_A` | você me passa; verificado no banco |
| `file_name_A` | você me passa |
| `title_A` | você me passa (pode diferir do file_name) |
| `sha256_A` | você me passa (calculado no seu computador antes do upload) |
| `page_count_A` | `pdfjs.getDocument(...).numPages` — não confio no metadata do PDF |
| `chunk_count_A` | `SELECT COUNT(*) FROM library_embeddings WHERE book_id = book_id_A` |
| `chunk_content_hashes_A` | array de SHA-256 do `content` de cada chunk, ordenado por `chunk_index` |
| `chunk_page_map_A` | array `[{ chunk_index, page, content_len }]`, sem o texto inteiro — só stats |

## PDF B (sintético) — snapshot completo

Mesmos campos de A, sufixados `_B`. Adicionalmente:

| Campo | Origem |
|---|---|
| `synthetic_source_md_sha256_B` | SHA-256 de `02-synthetic-pdf-content.md` (a origem canônica) |
| `render_method_B` | `"google-docs"` ou `"reportlab-script-03"` (você declara) |
| `render_script_sha256_B` | se `render_method_B == "reportlab-script-03"`: SHA-256 de `03-synthetic-pdf-render.py` |

## Prova de ausência de escritas

Ao final do run:

| Campo | Como preenchido |
|---|---|
| `writes_attempted` | contador incrementado por qualquer chamada não-SELECT no run (esperado: 0) |
| `tables_touched` | lista de `(table, op)` interceptada; esperado: `[('library_embeddings','SELECT'), ('library_books','SELECT'), ('rag_match_library_chunks','RPC'), ('auth.users','SELECT')]` |
| `main_account_reads` | contador esperado: 0 (nenhum SELECT com `user_id = <sua conta>`) |
| `tutor_calls` | esperado: 0 |
| `lousa_calls` | esperado: 0 |
| `telemetry_writes` | esperado: 0 |

Se qualquer contador ficar diferente do esperado, o run é abortado e a fixture não é aceita.

## Queries e resultados brutos (populados na execução)

Estrutura por query:

```json
{
  "query_id": "Q01",
  "class": "strong_relevant" | "indirect_paraphrase" | "out_of_corpus_close" | "out_of_corpus_far",
  "text": "…",
  "expected": {
    "book_id": "…" | null,
    "chunk_id": "…" | null,
    "page": 3 | null,
    "rationale": "descrição humana do porquê"
  },
  "embed_ms": 812,
  "rpc_ms": 47,
  "total_ms": 859,
  "topk": [
    { "rank": 1, "chunk_id": "…", "book_id": "…", "page": 3, "similarity": 0.7412, "human_relevance": "hit" | "partial" | "miss" },
    { "rank": 2, "chunk_id": "…", "book_id": "…", "page": 4, "similarity": 0.6033, "human_relevance": "miss" },
    …
  ]
}
```

`human_relevance` é preenchido comparando `topk[i].chunk_id` contra `expected.chunk_id` e chunks vizinhos aceitos como parciais (mesma página, mesmo tópico).

## Métricas derivadas (populadas na análise)

Para cada threshold candidato `t` em `[0.30, 0.35, 0.40, …, 0.75]`, e depois refinamento em passos de 0.01 perto do ótimo:

| Métrica | Definição |
|---|---|
| `recall_strong@t` | fração de queries `strong_relevant` cujo `expected.chunk_id` aparece no `topk` com `similarity ≥ t` |
| `recall_indirect@t` | idem para `indirect_paraphrase` |
| `fpr_out_of_corpus@t` | fração de queries `out_of_corpus_*` que retornam ≥1 chunk com `similarity ≥ t` (falso positivo) |
| `fpr_out_close@t` / `fpr_out_far@t` | mesma coisa, segmentado |
| `precision@t` | dos chunks aceitos, quantos foram julgados relevantes |
| `f1@t` | média harmônica de `recall_strong` e `precision` |
| `mean_accepted_chunks@t` | média de chunks acima do threshold por query |
| `borderline_queries@t` | queries com o topo em `[t-0.03, t+0.03]` |

## Decisão final

Um dos dois desfechos:

**Desfecho A — threshold absoluto viável:**
```json
{
  "recommended_threshold": 0.XX,
  "criteria_met": {
    "fpr_out_of_corpus_le_0.05": true,
    "recall_strong_ge_0.80": true,
    "recall_indirect_maximized_under_constraints": true
  },
  "sql_v2_proposed_path": "migrations-pending/GATE_B_match_library_chunks_v2.sql",
  "next_step": "aguardar aprovação explícita para mover a migration e implementar UI"
}
```

**Desfecho B — insuficiente:**
```json
{
  "recommended_threshold": null,
  "conclusion": "threshold absoluto insuficiente neste corpus",
  "evidence": { … },
  "alternatives_to_explore": [
    "reranking cross-encoder",
    "margem relativa (top1 - top2)",
    "classificação prévia de intent + threshold condicional",
    "híbrido lexical + vetorial (BM25 + cosine)"
  ]
}
```

Em nenhum dos dois casos a fixture aplica migration, faz deploy, ou toca em `rag-config.ts`.
