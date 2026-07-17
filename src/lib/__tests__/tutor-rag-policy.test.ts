import { describe, it, expect } from "bun:test";
import { selectTutorToolPolicy, buildDocumentalOverride } from "../tutor-rag-policy";

describe("selectTutorToolPolicy", () => {
  it("documental → 'none' (tools desligadas), independente do status do RAG", () => {
    expect(selectTutorToolPolicy("documental", "livre", "ok")).toBe("none");
    expect(selectTutorToolPolicy("documental", "explicar", "rpc_error")).toBe("none");
    expect(selectTutorToolPolicy("documental", "questoes", null)).toBe("none");
  });

  it("não documental → 'all' (tools preservadas) em todos os modos", () => {
    expect(selectTutorToolPolicy("explicacao", "explicar", "ok")).toBe("all");
    expect(selectTutorToolPolicy("pratica", "questoes", "ok")).toBe("all");
    expect(selectTutorToolPolicy("planejamento", "plano", "ok")).toBe("all");
    expect(selectTutorToolPolicy("redacao", "redacao", "no_active_books")).toBe("all");
    expect(selectTutorToolPolicy("erro", "erro", "embedding_upstream_error")).toBe("all");
    expect(selectTutorToolPolicy("conversa", "livre", null)).toBe("all");
  });

  it("erro de RAG não altera política — só afeta o override textual", () => {
    expect(selectTutorToolPolicy("explicacao", "explicar", "rpc_error")).toBe("all");
    expect(selectTutorToolPolicy("explicacao", "explicar", "embedding_auth_error")).toBe("all");
  });
});

describe("buildDocumentalOverride", () => {
  it("vazio quando intent não é documental", () => {
    expect(buildDocumentalOverride("explicacao", "ok")).toBe("");
    expect(buildDocumentalOverride("conversa", null)).toBe("");
  });

  it("documental + ok → resposta estritamente documental com citação", () => {
    const s = buildDocumentalOverride("documental", "ok");
    expect(s).toContain("MODO CONSULTA DOCUMENTAL");
    expect(s).toContain("trechos citados da biblioteca");
    expect(s).toContain("(trecho [N]");
    expect(s).toContain("NÃO use ferramentas");
  });

  it("documental sem fonte → recusa literal", () => {
    for (const st of ["no_active_books", "rpc_error", "embedding_auth_error", null] as const) {
      const s = buildDocumentalOverride("documental", st);
      expect(s).toContain("MODO CONSULTA DOCUMENTAL");
      expect(s).toContain("Não encontrei referência na sua biblioteca sobre isso");
      expect(s).toContain("NÃO use ferramentas");
    }
  });
});
