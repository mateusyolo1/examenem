# Checklist para escolha do PDF real A (v2)

> v2 aplica correções textuais aprovadas: priorização de material autoral,
> domínio público ou licença aberta; apostila comercial deixa de ser a
> sugestão preferencial. Original preservado em `04-real-pdf-checklist.md`.

O PDF real A serve para validar que o comportamento medido no PDF sintético B se sustenta em texto real, com ruído tipográfico, notas de rodapé, hifenização, etc.

## Requisitos obrigatórios

- [ ] **Idioma**: Português. Mesmo idioma do sintético e do domínio de uso do app (ENEM).
- [ ] **Texto extraível**: PDF nativo com camada de texto, não escaneado como imagem. Teste rápido no computador: abra o PDF, tente selecionar uma frase com o mouse. Se selecionar caractere por caractere, é texto → serve. Se selecionar retângulos de imagem, é scan → **não serve** (pdfjs não extrai OCR).
- [ ] **Tamanho**: entre 10 e 40 páginas. Menor que 10 dá poucos chunks; maior que 40 aumenta latência e custo de embedding sem ganho para calibração.
- [ ] **Domínio distinto do sintético**: escolha qualquer assunto que **não** seja óptica/telecomunicações/sinalização. Opções ideais: um capítulo de biologia, um capítulo de história, um capítulo de literatura, uma redação modelo comentada. Objetivo: perguntas fora do corpus de B (ex.: "qual a frequência de pulso do farol?") devem também não ser encontradas em A, e vice-versa.
- [ ] **Fatos-âncora verificáveis**: pelo menos **cinco**, cada um com página identificável. Você deve conseguir apontar, olhando o PDF, "esta pergunta é respondida na página X, primeiro parágrafo". Sem isso, não há gabarito humano.
- [ ] **Páginas identificáveis**: numeração visível ou estrutura clara que permita citar "p. X".
- [ ] **Uso legalmente seguro para QA interna**: preferir material autoral, domínio público ou licença explicitamente aberta (ver seção de prioridade abaixo).

## Requisitos recomendados

- [ ] **Estrutura clara**: capítulos ou seções com títulos. Facilita gerar paráfrases confiáveis.
- [ ] **Sem colunas complexas**: layout de coluna única extrai melhor. PDF de revista científica em 2 colunas frequentemente embaralha a ordem do texto no `pdfjs`.
- [ ] **Sem tabelas dominantes**: uma tabela ou outra ok; documento inteiro em tabelas dá chunks lixo.

## Prioridade de origem (do mais recomendado ao menos recomendado)

1. **Material autoral seu** — capítulo escrito por você, apostila própria, notas de aula suas exportadas em PDF.
2. **Domínio público** — obras cujos direitos expiraram; textos de órgãos governamentais brasileiros publicados em domínio público.
3. **Licença aberta explícita** — Creative Commons (CC-BY, CC-BY-SA), MIT, ou equivalente, com a licença declarada no próprio documento ou em página oficial de distribuição.
4. **Documento institucional público** — relatório de instituição pública, artigo divulgativo de agência de fomento (ex.: Fapesp) ou material educacional oficial publicado abertamente.
5. **Segundo PDF sintético** — se nada acima estiver acessível, gero um segundo sintético em domínio distinto; o teste perde o valor de "texto real", mas segue viável.

**Não usar** como PDF real A:

- apostila comercial de cursinho sob restrição de uso;
- livro didático com DRM ou aviso "proibida reprodução";
- material extraído de plataforma paga sem licença clara;
- qualquer PDF cuja origem/licença você não consiga declarar.

## Após escolher

Registre estes dados (vou pedir na fixture):

```
Título do PDF A            : _____________________________________
Nome do arquivo (.pdf)     : _____________________________________
Origem / licença           : _____________________________________
Número de páginas          : ____
SHA-256 do arquivo         : _____________________________________
Domínio (uma frase)        : _____________________________________
Fatos-âncora identificáveis: pelo menos 5, cada um com página
   1. p.___ : ___________________________________________________
   2. p.___ : ___________________________________________________
   3. p.___ : ___________________________________________________
   4. p.___ : ___________________________________________________
   5. p.___ : ___________________________________________________
```

Gere o SHA-256 assim:
- Linux/Mac terminal: `sha256sum arquivo.pdf` ou `shasum -a 256 arquivo.pdf`
- Windows PowerShell: `Get-FileHash arquivo.pdf -Algorithm SHA256`
