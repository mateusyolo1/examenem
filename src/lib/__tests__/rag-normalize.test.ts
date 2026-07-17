import { describe, it, expect } from "bun:test";
import { normalize, jaccard, trigramOverlap, isSufficientParaphrase } from "../rag-normalize";

describe("rag-normalize", () => {
  it("normalize remove acentos, pontuação e caixa", () => {
    expect(normalize("Ação, coração! Não?")).toBe("acao coracao nao");
  });

  it("jaccard=1 para textos idênticos após normalização", () => {
    expect(jaccard("Fotossíntese ocorre na planta", "fotossintese ocorre na planta")).toBe(1);
  });

  it("jaccard=0 para textos sem tokens comuns", () => {
    expect(jaccard("gato preto", "avião azul")).toBe(0);
  });

  it("trigramOverlap detecta cópia literal", () => {
    const src = "a mitocôndria produz energia através da respiração celular aeróbica";
    const literal = "a mitocondria produz energia atraves da respiracao celular aerobica";
    expect(trigramOverlap(src, literal)).toBeGreaterThan(0.6);
  });

  it("isSufficientParaphrase é apenas métrica auxiliar — não prova literalidade sozinha", () => {
    const src = "A fotossíntese converte luz solar em energia química nas plantas.";
    // Cópia literal → trigram alto → NÃO qualifica como paráfrase suficiente.
    expect(isSufficientParaphrase(src, src)).toBe(false);
    // Paráfrase real → jaccard moderado e trigrams baixos → qualifica.
    const paraphrase = "As plantas transformam a energia da luz em energia química por meio da fotossíntese.";
    expect(isSufficientParaphrase(paraphrase, src)).toBe(true);
    // Texto sem relação → não qualifica.
    expect(isSufficientParaphrase("gato preto no telhado", src)).toBe(false);
  });
});
