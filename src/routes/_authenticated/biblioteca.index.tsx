import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  listBooks,
  createBook,
  embedChunks,
  finalizeBook,
  deleteBook,
  toggleActiveBook,
  moveBook,
  renameFolder,
  toggleActiveFolder,
  saveFigures,
} from "@/lib/library.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  BookOpen,
  Upload,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderPlus,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  FolderInput,
  Pencil,
  ImagePlus,
  ArrowLeft,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/biblioteca/")({
  head: () => ({
    meta: [
      { title: "Biblioteca IA — Exame ENEM" },
      {
        name: "description",
        content:
          "Faça upload dos seus livros didáticos e organize por pastas. O Tutor e a Lousa consultam automaticamente.",
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
  folder: string | null;
  totalChunks: number;
  doneChunks: number;
  phase: "extracting" | "embedding" | "done" | "error";
  message?: string;
};

const CHUNK_SIZE = 1100;
const CHUNK_OVERLAP = 150;
const EMBED_BATCH = 10;
const UNFILED = "__unfiled__";

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

type ExtractedFigure = {
  page: number;
  blob: Blob;
  width: number;
  height: number;
};

async function extractPdfChunks(
  file: File,
  onPage: (page: number, total: number) => void,
): Promise<{
  chunks: { index: number; content: string; metadata: Record<string, unknown> }[];
  pageCount: number;
  figures: ExtractedFigure[];
}> {
  const pdfjs = await import("pdfjs-dist");
  const workerMod = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = (workerMod as { default: string }).default;

  const OPS = (pdfjs as unknown as { OPS: Record<string, number> }).OPS;
  const IMAGE_OPS = new Set<number>(
    [OPS?.paintImageXObject, OPS?.paintJpegXObject, OPS?.paintImageMaskXObject].filter(
      (v): v is number => typeof v === "number",
    ),
  );

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const chunks: { index: number; content: string; metadata: Record<string, unknown> }[] = [];
  const figures: ExtractedFigure[] = [];
  let idx = 0;
  const total = doc.numPages;
  const MAX_FIGURES = 40; // limite prático por livro
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

    // Página tem figura? Renderiza para JPEG e guarda.
    if (figures.length < MAX_FIGURES && IMAGE_OPS.size > 0) {
      try {
        const opList = await page.getOperatorList();
        const hasImage = (opList.fnArray as number[]).some((fn) => IMAGE_OPS.has(fn));
        if (hasImage) {
          const viewport = page.getViewport({ scale: 1.0 });
          const targetW = Math.min(900, viewport.width);
          const scale = targetW / viewport.width;
          const vp = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(vp.width);
          canvas.height = Math.ceil(vp.height);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            await page.render({
              canvasContext: ctx,
              viewport: vp,
              canvas,
            } as unknown as Parameters<typeof page.render>[0]).promise;
            const blob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob((b) => resolve(b), "image/jpeg", 0.78),
            );
            if (blob) {
              figures.push({ page: p, blob, width: canvas.width, height: canvas.height });
            }
          }
        }
      } catch (e) {
        console.warn(`[biblioteca] figura p.${p} falhou`, e);
      }
    }
  }
  return { chunks, pageCount: total, figures };
}

/** Só extrai figuras de um PDF (para reprocessar livros antigos sem re-embeddar). */
async function extractPdfFiguresOnly(
  file: File,
  onPage: (page: number, total: number) => void,
): Promise<ExtractedFigure[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerMod = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = (workerMod as { default: string }).default;
  const OPS = (pdfjs as unknown as { OPS: Record<string, number> }).OPS;
  const IMAGE_OPS = new Set<number>(
    [OPS?.paintImageXObject, OPS?.paintJpegXObject, OPS?.paintImageMaskXObject].filter(
      (v): v is number => typeof v === "number",
    ),
  );
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const figures: ExtractedFigure[] = [];
  const total = doc.numPages;
  const MAX_FIGURES = 40;
  for (let p = 1; p <= total; p++) {
    onPage(p, total);
    if (figures.length >= MAX_FIGURES || IMAGE_OPS.size === 0) continue;
    try {
      const page = await doc.getPage(p);
      const opList = await page.getOperatorList();
      const hasImage = (opList.fnArray as number[]).some((fn) => IMAGE_OPS.has(fn));
      if (!hasImage) continue;
      const viewport = page.getViewport({ scale: 1.0 });
      const targetW = Math.min(900, viewport.width);
      const scale = targetW / viewport.width;
      const vp = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({
        canvasContext: ctx,
        viewport: vp,
        canvas,
      } as unknown as Parameters<typeof page.render>[0]).promise;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.78),
      );
      if (blob) figures.push({ page: p, blob, width: canvas.width, height: canvas.height });
    } catch (e) {
      console.warn(`[biblioteca] figura p.${p} falhou`, e);
    }
  }
  return figures;
}

/** Deriva o "folder" a partir do webkitRelativePath (se veio de upload de pasta). */
function folderFromFile(file: File, fallback: string | null): string | null {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (!rel || !rel.includes("/")) return fallback;
  const parts = rel.split("/");
  parts.pop(); // remove filename
  return parts.join("/") || fallback;
}

function BibliotecaPage() {
  const router = useRouter();
  const listFn = useServerFn(listBooks);
  const createFn = useServerFn(createBook);
  const embedFn = useServerFn(embedChunks);
  const finalizeFn = useServerFn(finalizeBook);
  const deleteFn = useServerFn(deleteBook);
  const toggleFn = useServerFn(toggleActiveBook);
  const moveFn = useServerFn(moveBook);
  const renameFolderFn = useServerFn(renameFolder);
  const toggleFolderFn = useServerFn(toggleActiveFolder);

  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadFolder, setUploadFolder] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const reprocessInputRef = useRef<HTMLInputElement>(null);
  const reprocessTargetRef = useRef<{ id: string; title: string } | null>(null);

  const query = useQuery({
    queryKey: ["library-books"],
    queryFn: () => listFn(),
  });

  const patchUpload = (id: string, patch: Partial<UploadProgress>) =>
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  const handleFiles = useCallback(
    async (files: FileList | File[], forcedFolder?: string | null) => {
      const arr = Array.from(files).filter(
        (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
      );
      if (!arr.length) {
        toast.error("Envie apenas arquivos PDF.");
        return;
      }
      for (const file of arr) {
        const folder =
          forcedFolder !== undefined
            ? forcedFolder
            : folderFromFile(file, uploadFolder.trim() || null);
        const tempId = crypto.randomUUID();
        setUploads((prev) => [
          ...prev,
          {
            id: tempId,
            title: file.name,
            folder,
            totalChunks: 0,
            doneChunks: 0,
            phase: "extracting",
          },
        ]);
        try {
          const { book } = await createFn({
            data: {
              title: file.name.replace(/\.pdf$/i, ""),
              folder: folder ?? undefined,
            },
          });

          const { chunks, pageCount, figures } = await extractPdfChunks(file, (p, total) => {
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

          for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
            const batch = chunks.slice(i, i + EMBED_BATCH);
            await embedFn({ data: { bookId: book.id, chunks: batch } });
            patchUpload(tempId, { doneChunks: Math.min(i + batch.length, chunks.length) });
          }

          // Upload de figuras (páginas com imagens) para storage + registro
          if (figures.length > 0) {
            patchUpload(tempId, { message: `Enviando ${figures.length} figuras...` });
            try {
              const { data: userData } = await supabase.auth.getUser();
              const uid = userData.user?.id;
              if (uid) {
                const uploaded: {
                  page: number;
                  storagePath: string;
                  width: number;
                  height: number;
                }[] = [];
                for (const fig of figures) {
                  const path = `${uid}/${book.id}/p${fig.page}.jpg`;
                  const { error: upErr } = await supabase.storage
                    .from("books")
                    .upload(path, fig.blob, {
                      contentType: "image/jpeg",
                      upsert: true,
                    });
                  if (!upErr) {
                    uploaded.push({
                      page: fig.page,
                      storagePath: path,
                      width: fig.width,
                      height: fig.height,
                    });
                  }
                }
                if (uploaded.length > 0) {
                  await saveFigures({ data: { bookId: book.id, figures: uploaded } });
                }
              }
            } catch (e) {
              console.warn("[biblioteca] falha ao salvar figuras", e);
            }
          }

          await finalizeFn({ data: { bookId: book.id, status: "ready" } });
          patchUpload(tempId, {
            phase: "done",
            message: `${pageCount} páginas · ${figures.length} figuras`,
          });
          toast.success(`"${file.name}" está pronto.`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          patchUpload(tempId, { phase: "error", message: msg });
          toast.error(msg);
        }
      }
      query.refetch();
      router.invalidate();
    },
    [createFn, embedFn, finalizeFn, query, router, uploadFolder],
  );

  const handleReprocessFigures = useCallback(
    async (file: File) => {
      const target = reprocessTargetRef.current;
      reprocessTargetRef.current = null;
      if (!target) return;
      if (!(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
        toast.error("Envie o mesmo PDF do livro em formato .pdf");
        return;
      }
      setReprocessing(target.id);
      const toastId = toast.loading(`Extraindo figuras de "${target.title}"...`);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) throw new Error("Sessão expirada.");
        const figures = await extractPdfFiguresOnly(file, (p, total) => {
          toast.loading(`Lendo página ${p} de ${total}...`, { id: toastId });
        });
        if (figures.length === 0) {
          toast.info("Nenhuma página com figura detectada neste PDF.", { id: toastId });
          return;
        }
        toast.loading(`Enviando ${figures.length} figuras...`, { id: toastId });
        const uploaded: {
          page: number;
          storagePath: string;
          width: number;
          height: number;
        }[] = [];
        for (const fig of figures) {
          const path = `${uid}/${target.id}/p${fig.page}.jpg`;
          const { error: upErr } = await supabase.storage
            .from("books")
            .upload(path, fig.blob, { contentType: "image/jpeg", upsert: true });
          if (!upErr) {
            uploaded.push({
              page: fig.page,
              storagePath: path,
              width: fig.width,
              height: fig.height,
            });
          }
        }
        if (uploaded.length > 0) {
          await saveFigures({ data: { bookId: target.id, figures: uploaded } });
        }
        toast.success(`${uploaded.length} figuras salvas em "${target.title}".`, {
          id: toastId,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(msg, { id: toastId });
      } finally {
        setReprocessing(null);
      }
    },
    [],
  );

  const books = query.data?.books ?? [];
  const activeIds = new Set(query.data?.activeBookIds ?? []);

  // Agrupa livros por pasta
  const grouped = useMemo(() => {
    const map = new Map<string, typeof books>();
    for (const b of books) {
      const key = (b as { folder?: string | null }).folder ?? UNFILED;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === UNFILED) return 1;
      if (b === UNFILED) return -1;
      return a.localeCompare(b);
    });
  }, [books]);

  const existingFolders = useMemo(
    () =>
      Array.from(
        new Set(
          books
            .map((b) => (b as { folder?: string | null }).folder)
            .filter((f): f is string => !!f),
        ),
      ).sort(),
    [books],
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 gap-1 text-muted-foreground">
          <Link to="/estudos">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" /> Minha Biblioteca IA
        </h1>
        <p className="text-sm text-muted-foreground">
          Envie PDFs ou pastas inteiras — a estrutura do computador vira coleções aqui dentro.
        </p>
      </header>

      {/* Pasta de destino + botões */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">
                Pasta de destino (opcional)
              </label>
              <Input
                list="folder-suggestions"
                placeholder="Ex.: Biologia/Citologia"
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value)}
                className="mt-1"
              />
              <datalist id="folder-suggestions">
                {existingFolders.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground mt-1">
                Ao subir uma pasta do PC, a estrutura dela é usada automaticamente.
              </p>
            </div>
            <div className="flex sm:flex-col gap-2 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => dirInputRef.current?.click()}
                className="flex-1"
              >
                <FolderPlus className="h-4 w-4 mr-2" /> Escolher pasta
              </Button>
            </div>
          </div>

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
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <Upload className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-2 font-medium">Arraste PDFs aqui ou clique para escolher</p>
            <p className="text-xs text-muted-foreground mt-1">
              Processamento roda no seu navegador — seus arquivos não saem sem embeddar.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              hidden
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <input
              ref={dirInputRef}
              type="file"
              hidden
              multiple
              // @ts-expect-error webkitdirectory is non-standard but supported
              webkitdirectory=""
              directory=""
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>
          <input
            ref={reprocessInputRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void handleReprocessFigures(f);
            }}
          />
        </CardContent>
      </Card>

      {/* Progresso */}
      {uploads.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Processando ({uploads.length})</CardTitle>
            {uploads.every((u) => u.phase === "done" || u.phase === "error") && (
              <Button size="sm" variant="ghost" onClick={() => setUploads([])}>
                Limpar
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3 max-h-72 overflow-auto">
            {uploads.map((u) => (
              <div key={u.id} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{u.title}</div>
                    {u.folder && (
                      <div className="text-xs text-muted-foreground truncate">
                        📁 {u.folder}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {u.phase === "extracting" && "Lendo PDF..."}
                    {u.phase === "embedding" && `${u.doneChunks}/${u.totalChunks}`}
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

      {/* Lista agrupada por pasta */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          Livros ({books.length}) · {grouped.length} coleç{grouped.length === 1 ? "ão" : "ões"}
        </h2>
        {query.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : books.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum livro ainda. Envie seu primeiro PDF acima.
          </p>
        ) : (
          <div className="space-y-3">
            {grouped.map(([folderKey, folderBooks]) => {
              const isUnfiled = folderKey === UNFILED;
              const isCollapsed = collapsed[folderKey] ?? false;
              const readyBooks = folderBooks.filter((b) => b.status === "ready");
              const allActive =
                readyBooks.length > 0 && readyBooks.every((b) => activeIds.has(b.id));
              const someActive = readyBooks.some((b) => activeIds.has(b.id));
              return (
                <Card key={folderKey}>
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() =>
                          setCollapsed((s) => ({ ...s, [folderKey]: !isCollapsed }))
                        }
                        className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        )}
                        {isUnfiled ? (
                          <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                        )}
                        <span className="font-semibold truncate">
                          {isUnfiled ? "Sem pasta" : folderKey}
                        </span>
                        <Badge variant="secondary" className="ml-1 shrink-0">
                          {folderBooks.length}
                        </Badge>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-muted-foreground hidden sm:inline">
                            Ativar todos
                          </span>
                          <Switch
                            checked={allActive}
                            disabled={readyBooks.length === 0}
                            aria-label="Ativar todos os livros desta pasta"
                            onCheckedChange={async (v) => {
                              await toggleFolderFn({
                                data: { folder: isUnfiled ? null : folderKey, active: v },
                              });
                              query.refetch();
                            }}
                          />
                          {someActive && !allActive && (
                            <span className="text-xs text-muted-foreground">·</span>
                          )}
                        </div>
                        {!isUnfiled && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={async () => {
                                  const to = prompt(
                                    "Novo nome da pasta:",
                                    folderKey,
                                  );
                                  if (!to || to === folderKey) return;
                                  await renameFolderFn({
                                    data: { from: folderKey, to },
                                  });
                                  toast.success("Pasta renomeada");
                                  query.refetch();
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-2" /> Renomear pasta
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {!isCollapsed && (
                    <CardContent className="pt-0 space-y-2">
                      {folderBooks.map((b) => {
                        const active = activeIds.has(b.id);
                        return (
                          <div
                            key={b.id}
                            className="flex items-center justify-between gap-3 border-t pt-2 first:border-t-0 first:pt-0"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate text-sm">{b.title}</div>
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
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Switch
                                checked={active}
                                disabled={b.status !== "ready"}
                                onCheckedChange={async (v) => {
                                  await toggleFn({ data: { bookId: b.id, active: v } });
                                  query.refetch();
                                }}
                              />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      const to = prompt(
                                        "Mover para pasta (vazio = sem pasta):",
                                        (b as { folder?: string | null }).folder ?? "",
                                      );
                                      if (to === null) return;
                                      await moveFn({
                                        data: {
                                          bookId: b.id,
                                          folder: to.trim() || null,
                                        },
                                      });
                                      toast.success("Livro movido");
                                      query.refetch();
                                    }}
                                  >
                                    <FolderInput className="h-4 w-4 mr-2" /> Mover
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={b.status !== "ready" || reprocessing === b.id}
                                    onClick={() => {
                                      reprocessTargetRef.current = {
                                        id: b.id,
                                        title: b.title,
                                      };
                                      reprocessInputRef.current?.click();
                                    }}
                                  >
                                    {reprocessing === b.id ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <ImagePlus className="h-4 w-4 mr-2" />
                                    )}
                                    Reprocessar figuras
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={async () => {
                                      if (!confirm(`Apagar "${b.title}"?`)) return;
                                      await deleteFn({ data: { bookId: b.id } });
                                      query.refetch();
                                      toast.success("Livro removido");
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" /> Apagar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
