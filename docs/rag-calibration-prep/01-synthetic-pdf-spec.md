# Especificação do PDF sintético B

## Objetivo

Fornecer um corpus com **gabarito 100% previsível**, em um domínio inventado que não colide com nenhum livro real. Isto elimina ambiguidade humana ao classificar relevância e permite testar:

- perguntas diretas → devem recuperar chunk exato;
- paráfrases → devem recuperar mesmo chunk com vocabulário diferente;
- perguntas fora do corpus com vocabulário próximo → devem NÃO recuperar nada relevante.

## Domínio

**Faróis Zylânticos** — dispositivo óptico de sinalização coerente inteiramente fictício. Todos os nomes próprios, números, unidades e siglas foram inventados para este teste. Nenhuma palavra deste corpus corresponde a tecnologia, empresa, cidade, pessoa ou norma real.

## Metadados do documento

- **Idioma**: Português (Brasil), formal técnico.
- **Título sugerido do PDF**: `Manual Tecnico dos Farois Zylanticos - Volume I.pdf`
  - use ASCII no nome do arquivo para evitar surpresas com sistemas de arquivos e uploads
- **Formato**: A4 retrato, margens 25 mm em todos os lados, fonte serifada 11pt corpo / 14pt subtítulo / 18pt título.
- **Páginas esperadas**: 8 a 12 páginas quando renderizado.
- **Chunks esperados**: 15 a 25 (aplicando `CHUNK_SIZE=1100`, `CHUNK_OVERLAP=150`, por página).

## Estrutura de capítulos (ver conteúdo em `02-synthetic-pdf-content.md`)

| Cap. | Título | Papel na calibração |
|---|---|---|
| 1 | Definição e histórico | ancora "o que é" |
| 2 | Componentes físicos | ancora "quais partes" |
| 3 | Constantes operacionais | ancora perguntas numéricas exatas |
| 4 | Protocolo de sincronização Zyl-Sync-3 | ancora perguntas procedurais |
| 5 | Aplicações práticas | ancora perguntas de uso |
| 6 | Limitações conhecidas | ancora perguntas contrafactuais |

## Restrições editoriais (não alterar)

- Manter **todos os números** exatamente como listados no conteúdo (487 nm, 218 candelas, 1043 Hz, etc.). Eles são o gabarito.
- Manter todos os **nomes próprios** exatamente (Vergani-Solterra, Alderbrand, Kravnov, Ostende, Marbelli, Bravenka, Sperling, Verrata, Zyl-Sync-3). São a assinatura semântica única.
- Não inserir imagens, tabelas, cabeçalhos/rodapés recorrentes ou índice. Só texto corrido em capítulos.
- **Cada capítulo começa em uma nova página** (page break). Isso garante que o chunker (que opera por página) produza chunks alinhados a capítulos.

## Rendering — duas opções para você escolher

**Opção 1 — Google Docs (mais simples):**
1. Cole o conteúdo de `02-synthetic-pdf-content.md`.
2. Aplique estilos: Título 1 para "Manual...", Título 2 para "Capítulo N", corpo 11pt.
3. `Arquivo → Baixar → PDF`.

**Opção 2 — Script reportlab (`03-synthetic-pdf-render.py`, não executado):**
- Preparado, com fonte DejaVu para preservar acentos.
- Você aprova, roda localmente (`python3 03-synthetic-pdf-render.py`) e obtém o PDF idêntico ao especificado.

Qualquer uma serve. Após gerar, calcule `sha256sum` do PDF e registre no seu bloco de notas — vou pedir esse hash na fixture.
