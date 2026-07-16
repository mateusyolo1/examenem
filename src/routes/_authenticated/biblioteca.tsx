import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useRef, useState } from "react";
import {
  listBooks,
  createBook,
  embedChunks,
  finalizeBook,
  deleteBook,
  toggleActiveBook,
} from "@/lib/library.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { BookOpen, Upload, Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/biblioteca")({
  head: () => ({
    meta: [
      { title: "Biblioteca IA — Exame ENEM" },
      {
        name: "description",
        content:
          "Faça upload dos seus livros didáticos e deixe o Tutor e a Lousa consultarem o conteúdo automaticamente.",
      },
    ],
  }),
  component: BibliotecaPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Erro: {String(error?.message ?? error)}</div>
  ),
  notFoundComponent: () => <div className="p-6">Página não encontrada.</div>,
});

type UploadProgress = {
  id: string;
  title: string;
  totalChunks: number;
  doneChunks: number;
  phase: "extracting" | "embedding" | "done" | "error";
  message?: string;
};

const CHUNK_SIZE = 1100;
const CHUNK_OVERLAP = 150;
const EMBED_BATCH = 20;

function chunkText(text: string, page: number): { content: string; page: number }[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out: { content: string; page: number }[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + CHUNK_SIZE, clean.length);
    out.push({ content: clean.slice(i, end), page });
    if (end === clean.length) break;
    i = end - CHUNK_OVERLAP;
  }
  return out;
}

async function extractPdfChunks(
  file: File,
  onPage: (page: number, total: number) => void,
): Promise<{ chunks: { index: number; content: string; metadata: Record<string, unknown> }[]; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist");
  const workerMod = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = (workerMod as { default: string }).default;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const chunks: { index: number; content: string; metadata: Record<string, unknown> }[] = [];
  let idx = 0;
  const total = doc.numPages;
  for (let p = 1; p <= total; p++) {
    onPage(p, total);
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ");
    for (const c of chunkText(text, p)) {
      chunks.push({
        index: idx++,
        content: c.content,
        metadata: { page: c.page, bookTitle: file.name.replace(/\.pdf$/i, "") },
      });
    }
  }
  return { chunks, pageCount: total };
}

function BibliotecaPage() {
  const router = useRouter();
  const listFn = useServerFn(listBooks);
  const createFn = useServerFn(createBook);
  const embedFn = useServerFn(embedChunks);
  const finalizeFn = useServerFn(finalizeBook);
  const deleteFn = useServerFn(deleteBook);
  const toggleFn = useServerFn(toggleActiveBook);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ["library-books"],
    queryFn: () => listFn(),
  });

  const patchUpload = (id: string, patch: Partial<UploadProgress>) =>
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type === "application/pdf");
      if (!arr.length) {
        toast.error("Envie apenas arquivos PDF.");
        return;
      }
      for (const file of arr) {
        const tempId = crypto.randomUUID();
        setUploads((prev) => [
          ...prev,
          {
            id: tempId,
            title: file.name,
            totalChunks: 0,
            doneChunks: 0,
            phase: "extracting",
          },
        ]);
        try {
          // 1. cria registro do livro (status: extracting)
          const { book } = await createFn({
            data: {
              title: file.name.replace(/\.pdf$/i, ""),
            },
          });

          // 2. extrai texto local com pdfjs
          const { chunks, pageCount } = await extractPdfChunks(file, (p, total) => {
            patchUpload(tempId, {
              message: `Lendo página ${p} de ${total}...`,
            });
          });
          if (!chunks.length) throw new Error("PDF sem texto extraível.");

          patchUpload(tempId, {
            phase: "embedding",
            totalChunks: chunks.length,
            message: undefined,
          });

          // 3. envia em lotes para o servidor gerar embeddings
          for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
            const batch = chunks.slice(i, i + EMBED_BATCH);
            await embedFn({ data: { bookId: book.id, chunks: batch } });
            patchUpload(tempId, { doneChunks: Math.min(i + batch.length, chunks.length) });
          }

          await finalizeFn({ data: { bookId: book.id, status: "ready" } });
          patchUpload(tempId, { phase: "done", message: `${pageCount} páginas indexadas` });
          toast.success(`"${file.name}" está pronto para uso.`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          patchUpload(tempId, { phase: "error", message: msg });
          toast.error(msg);
        }
      }
      query.refetch();
      router.invalidate();
    },
    [createFn, embedFn, finalizeFn, query, router],
  );

  const books = query.data?.books ?? [];
  const activeIds = new Set(query.data?.activeBookIds ?? []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" /> Minha Biblioteca IA
        </h1>
        <p className="text-sm text-muted-foreground">
          Envie seus livros didáticos em PDF. A IA os transforma em conhecimento vivo — o Tutor e a
          Lousa passam a consultar o texto real quando ensinam você.
        </p>
      </header>

      {/* Drag & drop */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Arraste PDFs aqui ou clique para escolher</p>
        <p className="text-xs text-muted-foreground mt-1">
          Livros didáticos, apostilas, resumos — o processamento roda no seu navegador.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Progresso em tempo real */}
      {uploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Processando</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {uploads.map((u) => (
              <div key={u.id} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{u.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {u.phase === "extracting" && "Lendo PDF..."}
                    {u.phase === "embedding" &&
                      `${u.doneChunks}/${u.totalChunks} trechos`}
                    {u.phase === "done" && (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Pronto
                      </span>
                    )}
                    {u.phase === "error" && (
                      <span className="text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Erro
                      </span>
                    )}
                  </span>
                </div>
                {u.totalChunks > 0 && u.phase === "embedding" && (
                  <div className="mt-1 h-1.5 rounded bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(u.doneChunks / u.totalChunks) * 100}%` }}
                    />
                  </div>
                )}
                {u.message && (
                  <p className="text-xs text-muted-foreground mt-1">{u.message}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Lista de livros */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Livros ({books.length})</h2>
        {query.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : books.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum livro ainda. Envie seu primeiro PDF acima.
          </p>
        ) : (
          <div className="space-y-2">
            {books.map((b) => {
              const active = activeIds.has(b.id);
              return (
                <Card key={b.id}>
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{b.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        {b.status === "ready" && (
                          <Badge variant="secondary" className="text-emerald-700">
                            {b.chunk_count} trechos
                          </Badge>
                        )}
                        {b.status === "extracting" && (
                          <Badge variant="secondary">Lendo...</Badge>
                        )}
                        {b.status === "embedding" && (
                          <Badge variant="secondary">Indexando...</Badge>
                        )}
                        {b.status === "error" && (
                          <Badge variant="destructive">
                            {b.error_message ?? "erro"}
                          </Badge>
                        )}
                        {b.author && <span>· {b.author}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span>Ativo</span>
                        <Switch
                          checked={active}
                          disabled={b.status !== "ready"}
                          onCheckedChange={async (v) => {
                            await toggleFn({ data: { bookId: b.id, active: v } });
                            query.refetch();
                          }}
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm(`Apagar "${b.title}"?`)) return;
                          await deleteFn({ data: { bookId: b.id } });
                          query.refetch();
                          toast.success("Livro removido");
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
