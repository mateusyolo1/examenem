# Checklist da conta QA e ingestão dos PDFs A e B (v2)

> v2 aplica correções textuais aprovadas: (a) alias Gmail com "+" NÃO
> constitui conta separada e foi removido como sugestão; (b) exigência de
> conta Google realmente independente; (c) preferência por compartilhar
> apenas o `user_id` QA, deixando o e-mail para uso interno se estritamente
> necessário. Original preservado em `05-qa-account-and-ingestion-checklist.md`.

## Fase 1 — Criar a conta QA

- [ ] Use uma **conta Google totalmente independente** da sua conta principal.
  - Não usar aliases com `+` (ex.: `voce+qa@gmail.com`) — isso é apenas um
    alias da mesma caixa e do mesmo `sub` Google, **não** uma conta separada.
    O provedor OAuth entrega o mesmo identity ao Supabase e o app trata
    como o mesmo usuário lógico.
  - Crie um endereço Google novo, com senha própria, sem histórico no app.
- [ ] **Proibido** reutilizar sua conta principal do app para QA.
- [ ] Abra o app em uma janela anônima do navegador (para não misturar sessão).
- [ ] Acesse `/auth` no app.
- [ ] Clique em "Entrar com Google" e complete o login com a conta QA.
- [ ] Confirme que caiu no dashboard como usuário novo (histórico vazio, plano vazio).
- [ ] **Não** faça onboarding, não gere plano de estudos, não abra Tutor, não abra Lousa. A conta QA precisa ficar com estado mínimo — só a biblioteca importa.

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
- [ ] Faça upload do PDF sintético B (gerado por Google Docs ou pelo script `03-synthetic-pdf-render.v2.py`).
- [ ] Aguarde 100%.
- [ ] Anote:
  - `book_id_B`
  - `chunk_count_B`

## Fase 4 — Ativar ambos os livros para o RAG da conta QA

- [ ] Na `/biblioteca`, marque ambos os livros como "ativos para IA" (o toggle que popula `rag_book_ids` da conta QA).
- [ ] **Não** altere `rag_book_ids` de nenhuma outra conta. A calibração vai ler apenas com o `target_user_id` da conta QA.

## Fase 5 — Mensagem final para mim

Quando terminar, envie **preferencialmente apenas o `user_id` QA**. O
e-mail QA só deve ser compartilhado se for estritamente necessário para
localizar o `user_id` no backend, e nesse caso ele será usado somente
uma vez, no ambiente administrativo, e não ficará registrado em logs
ou anotações públicas.

Formato preferido:

```
Conta QA pronta.

user_id QA        : _____________________________________
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

Formato aceitável só se você não conseguir extrair o `user_id`:

```
email QA (uso interno único) : _____________________________________
(demais campos idênticos ao bloco acima)
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
