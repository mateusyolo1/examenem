import { describe, it, expect } from "bun:test";
import { detectTutorIntent } from "../rag-intent";

describe("detectTutorIntent", () => {
  it("consulta explícita a livro/biblioteca → documental", () => {
    expect(detectTutorIntent({ message: "Segundo o livro, o que é entropia?" })).toBe("documental");
    expect(detectTutorIntent({ message: "no meu pdf de física" })).toBe("documental");
    expect(detectTutorIntent({ message: "conforme o material que eu subi" })).toBe("documental");
    expect(detectTutorIntent({ message: "cite algo da minha biblioteca" })).toBe("documental");
  });

  it("menções casuais a 'livro' ou 'página' NÃO ativam documental", () => {
    expect(detectTutorIntent({ message: "explica essa questão da página 15" })).not.toBe("documental");
    expect(detectTutorIntent({ message: "o texto fala sobre um livro do autor" })).not.toBe("documental");
  });

  it("toggle explícito força documental mesmo sem lexema", () => {
    expect(detectTutorIntent({ message: "me explica", explicitDocumental: true })).toBe("documental");
  });

  it("conversa comum não é documental", () => {
    expect(detectTutorIntent({ message: "oi tudo bem?" })).toBe("conversa");
    expect(detectTutorIntent({ message: "obrigado professor" })).toBe("conversa");
  });

  it("modo do UI preserva intent sem forçar documental", () => {
    expect(detectTutorIntent({ message: "quero praticar", mode: "questoes" })).toBe("pratica");
    expect(detectTutorIntent({ message: "monta um plano", mode: "plano" })).toBe("planejamento");
    expect(detectTutorIntent({ message: "corrige minha redação", mode: "redacao" })).toBe("redacao");
    expect(detectTutorIntent({ message: "explica ai", mode: "explicar" })).toBe("explicacao");
  });

  it("mensagem vazia → conversa", () => {
    expect(detectTutorIntent({ message: "" })).toBe("conversa");
  });
});
