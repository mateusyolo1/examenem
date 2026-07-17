# Checklist da conta QA e ingestão dos PDFs A e B

## Fase 1 — Criar a conta QA

- [ ] Use uma conta Google **nova**, nunca usada com o app antes.
  - Sugestão de convenção: `qa-rag+YYYYMMDD@seu-dominio` (endereço com "+" ainda cai na sua caixa principal, mas o Google trata como conta distinta se você criar de fato uma conta Google separada).
  - Se preferir, crie uma conta Google totalmente independente. O importante é que **não seja seu email principal do app**.
- [ ] Abra o app em uma janela anônima do navegador (para não misturar sessão).
- [ ] Acesse `/auth` no app.
- [ ] Clique em "Entrar com Google" e complete o login com a conta QA.
- [ ] Confirme que caiu no dashboard como usuário novo (histórico vazio, plano vazio).
- [ ] **Não** faça onboarding, não gere plano de estudos, não abra Tutor, não abra Lousa. A conta QA precisa ficar com estado mínimo — só a biblioteca importa.
- [ ] Me avise o email da conta QA para eu poder ler `auth.users` e extrair o `user_id` correspondente por SQL read-only (ou você mesmo cola o `user_id` se souber onde encontrar).

## Fase 2 — Ingerir o PDF real A

- [ ] Ainda logado como QA, navegue para `/biblioteca`.
- [ ] Crie uma pasta chamada exatamente `qa-A-real` (ajuda a distinguir se a conta um dia crescer).
- [ ] Faça upload do PDF real A dentro dessa pasta.
- [ ] Aguarde o status ir para "pronto" (barra de progresso completa 100%).
- [ ] Anote:
  - `book_id_A` (visível na URL ao abrir o livro, ou vou ler por SQL)
  - `chunk_count_A` (mostrado no card do livro após ingestão)

## Fase 3 — Ingerir o PDF sintético B

- [ ] Crie a pasta `qa-B-sintetico`.
- [ ] Faça upload do PDF sintético B (gerado por Google Docs ou pelo script `03-synthetic-pdf-render.py`).
- [ ] Aguarde 100%.
- [ ] Anote:
  - `book_id_B`
  - `chunk_count_B`

## Fase 4 — Ativar ambos os livros para o RAG da conta QA

- [ ] Na `/biblioteca`, marque ambos os livros como "ativos para IA" (o toggle que popula `rag_book_ids` da conta QA).
- [ ] **Não** altere `rag_book_ids` de nenhuma outra conta. A calibração vai ler apenas com o `target_user_id` da conta QA.

## Fase 5 — Mensagem final para mim

Quando terminar, me envie exatamente estes dados em uma mensagem:

```
Conta QA pronta.

email QA          : _____________________________________
user_id QA        : (opcional; eu leio por SQL se preferir)
PDF A - titulo    : _____________________________________
PDF A - sha256    : _____________________________________
PDF A - paginas   : ____
PDF A - book_id   : _____________________________________
PDF A - chunks    : ____
PDF B - sha256    : _____________________________________
PDF B - paginas   : ____
PDF B - book_id   : _____________________________________
PDF B - chunks    : ____
```

Após receber isso, eu:
1. Confirmo por SQL read-only que os dois livros pertencem à conta QA (nunca à sua principal).
2. Leio os chunks (id, page, content) dos dois livros da conta QA.
3. Preparo as 30 queries com gabarito humano exato (chunk_id, page).
4. Envio o Gate Intermediário para sua aprovação.
5. **Só depois de sua aprovação** rodo os embeddings.

## Confirmações de segurança que EU farei antes de qualquer embedding

- Verificar que `user_id` das duas linhas em `library_books` coincide com o `user_id` da conta QA e é diferente do `user_id` da sua conta principal.
- Verificar que a soma de chunks reportados por você bate com `COUNT(*) FROM library_embeddings WHERE book_id IN (...)`.
- Confirmar que o modelo declarado no código continua sendo `google/gemini-embedding-2` e que a coluna é `halfvec(3072)`.
- Reportar as três verificações antes de rodar a primeira query.
