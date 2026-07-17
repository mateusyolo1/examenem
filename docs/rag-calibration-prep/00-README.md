# Calibração empírica do RAG — Gate B

Pasta com todos os artefatos preparatórios do Bloco 2. **Nada aqui foi executado.**
Nenhum embedding foi gerado, nenhuma conta criada, nenhum PDF baixado, nenhum SQL aplicado.

## Índice

| # | Arquivo | Propósito |
|---|---|---|
| 01 | `synthetic-pdf-spec.md` | Especificação do PDF sintético B |
| 02 | `synthetic-pdf-content.md` | Conteúdo textual COMPLETO do PDF sintético (pronto para renderização) |
| 03 | `synthetic-pdf-render.py` | Script reportlab opcional para gerar o PDF a partir do conteúdo (**não executado**) |
| 04 | `real-pdf-checklist.md` | Critérios para você escolher o PDF real A |
| 05 | `qa-account-and-ingestion-checklist.md` | Passo a passo para criar a conta QA e ingerir A e B |
| 06 | `fixture-schema.md` | Campos que a fixture de calibração deve registrar |

## Ordem de uso

1. Você lê `04` e escolhe o PDF real A.
2. Você lê `01` + `02` e decide como gerar o PDF sintético B (Google Docs OU `03`).
3. Você segue `05` para criar a conta QA e ingerir A e B.
4. Você me avisa: "conta QA pronta, A e B ingeridos, user_id = XXX".
5. Eu leio os chunks reais da conta QA (read-only), preparo as 30 queries + gabarito, e envio o Gate Intermediário para sua aprovação.
6. **Só depois** rodo a calibração.

## O que NÃO farei sem sua ordem explícita

- Criar conta.
- Fazer upload de qualquer PDF.
- Ler dados da sua conta principal.
- Alterar `rag_book_ids` de qualquer usuário.
- Aplicar migration.
- Instalar dependências.
- Alterar `tsconfig.json`.
- Enviar mensagem ao Tutor ou à Lousa.
- Gravar qualquer telemetria pedagógica.
