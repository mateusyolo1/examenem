import { describe, it, expect } from "bun:test";
import { libraryMatchesToPrompt, type LibraryMatch } from "../library-rag.server";

const match = (i: number, title: string, page: number, content: string, sim: number): LibraryMatch => ({
  book_id: `book-${i}`,
  chunk_index: i,
  content,
  metadata: { bookTitle: title, page },
  similarity: sim,
});

describe("libraryMatchesToPrompt", () => {
  it("vazio quando não há matches", () => {
    expect(libraryMatchesToPrompt([])).toBe("");
  });

  it("mantém título, página e índice; NÃO expõe score", () => {
    const out = libraryMatchesToPrompt([
      match(0, "Química Geral", 42, "A entalpia é uma função de estado.", 0.812),
      match(1, "Física ENEM", 7, "A força resultante é a soma vetorial.", 0.55),
    ]);
    // índices [1] e [2]
    expect(out).toContain("[1] «Química Geral» — p.42");
    expect(out).toContain("[2] «Física ENEM» — p.7");
    // conteúdo presente
    expect(out).toContain("A entalpia é uma função de estado.");
    expect(out).toContain("A força resultante é a soma vetorial.");
    // score NÃO aparece
    expect(out).not.toContain("0.81");
    expect(out).not.toContain("similaridade");
    // instrução de citação
    expect(out).toContain("(trecho [N] — «Livro», p.X)");
  });

  it("omite página quando ausente no metadata", () => {
    const out = libraryMatchesToPrompt([match(0, "Livro Sem Página", 0, "conteúdo", 0.7)]);
    expect(out).toContain("[1] «Livro Sem Página»:");
    expect(out).not.toContain("p.0");
  });
});
