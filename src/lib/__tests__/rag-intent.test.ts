import { describe, it, expect } from "bun:test";
import { detectTutorIntent } from "../rag-intent";

describe("detectTutorIntent", () => {
  it("consulta explícita a livro → documental", () => {
    expect(detectTutorIntent({ message: "Segundo o livro, o que é entropia?" })).toBe("documental");
    expect(detectTutorIntent({ message: "no livro do professor" })).toBe("documental");
    expect(detectTutorIntent({ message: "conforme o material que subi" })).toBe("documental");
  });

  it("pedido de página/citação → documental", () => {
    expect(detectTutorIntent({ message: "cite a fonte com a página" })).toBe("documental");
    expect(detectTutorIntent({ message: "qual a página desse capítulo?" })).toBe("documental");
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
