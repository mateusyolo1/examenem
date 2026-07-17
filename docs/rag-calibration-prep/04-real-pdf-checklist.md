# Checklist para escolha do PDF real A

O PDF real A serve para validar que o comportamento medido no PDF sintético B se sustenta em texto real, com ruído tipográfico, notas de rodapé, hifenização, etc.

## Requisitos obrigatórios

- [ ] **Idioma**: Português. Mesmo idioma do sintético e do domínio de uso do app (ENEM).
- [ ] **Texto extraível**: PDF nativo com camada de texto, não escaneado como imagem. Teste rápido no computador: abra o PDF, tente selecionar uma frase com o mouse. Se selecionar caractere por caractere, é texto → serve. Se selecionar retângulos de imagem, é scan → **não serve** (pdfjs não extrai OCR).
- [ ] **Tamanho**: entre 10 e 40 páginas. Menor que 10 dá poucos chunks; maior que 40 aumenta latência e custo de embedding sem ganho para calibração.
- [ ] **Domínio distinto do sintético**: escolha qualquer assunto que **não** seja óptica/telecomunicações/sinalização. Opções ideais: um capítulo de biologia, um capítulo de história, um capítulo de literatura, uma redação modelo comentada. Objetivo: perguntas fora do corpus de B (ex.: "qual a frequência de pulso do farol?") devem também não ser encontradas em A, e vice-versa.
- [ ] **Fatos verificáveis**: você deve conseguir apontar, olhando o PDF, "esta pergunta é respondida na página X, primeiro parágrafo". Sem isso, não há gabarito humano.

## Requisitos recomendados

- [ ] **Estrutura clara**: capítulos ou seções com títulos. Facilita gerar paráfrases confiáveis.
- [ ] **Sem colunas complexas**: layout de coluna única extrai melhor. PDF de revista científica em 2 colunas frequentemente embaralha a ordem do texto no `pdfjs`.
- [ ] **Sem tabelas dominantes**: uma tabela ou outra ok; documento inteiro em tabelas dá chunks lixo.
- [ ] **Livre de restrição legal para uso interno de QA**: material que você mesmo produziu, domínio público, ou material próprio de estudo. Não use PDFs comerciais sob DRM.

## Sugestões concretas (escolha qualquer uma)

1. Um capítulo de apostila de cursinho que você já possua (biologia, história, etc.), exportado como PDF de páginas contínuas.
2. Uma redação nota 1000 do ENEM com comentário técnico, se você tiver esse material.
3. Um artigo divulgativo científico em PDF (ex.: revista Pesquisa Fapesp), 15-25 páginas.
4. Se nada disso for viável, um segundo PDF sintético que eu preparo em domínio distinto — mas o teste perde valor de "texto real".

## Após escolher

Registre estes dados (vou pedir na fixture):

```
Título do PDF A            : _____________________________________
Nome do arquivo (.pdf)     : _____________________________________
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
