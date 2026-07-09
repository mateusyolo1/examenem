import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Frame, Loader2, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteFlashcard,
  generateFlashcards,
  listDueFlashcards,
  recordFlashcardReview,
} from "@/lib/study-hub.functions";

export function FlashcardsTab() {
  const listFn = useServerFn(listDueFlashcards);
  const genFn = useServerFn(generateFlashcards);
  const reviewFn = useServerFn(recordFlashcardReview);
  const delFn = useServerFn(deleteFlashcard);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["flashcards-due"],
    queryFn: () => listFn(),
  });
  const due = data?.due ?? [];
  const all = data?.all ?? [];

  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(6);
  const [flipped, setFlipped] = useState(false);
  const [idx, setIdx] = useState(0);

  const genMutation = useMutation({
    mutationFn: () => genFn({ data: { topic, count } }),
    onSuccess: (res) => {
      toast.success(`${res.inserted} flashcards criados.`);
      setTopic("");
      qc.invalidateQueries({ queryKey: ["flashcards-due"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewMutation = useMutation({
    mutationFn: (v: { id: string; quality: number }) =>
      reviewFn({ data: { flashcardId: v.id, quality: v.quality } }),
    onSuccess: () => {
      setFlipped(false);
      setIdx((i) => i + 1);
      qc.invalidateQueries({ queryKey: ["flashcards-due"] });
    },
  });

  const current = due[idx];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      <aside className="border border-border rounded-md bg-card p-3 space-y-3">
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Gerar com IA</label>
          <Input
            placeholder="Tópico"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-1"
          />
          <div className="flex items-center gap-2 mt-2">
            <Input
              type="number"
              min={1}
              max={15}
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 6)}
              className="w-16 h-8"
            />
            <Button
              size="sm"
              className="flex-1 gap-1.5"
              disabled={!topic || genMutation.isPending}
              onClick={() => genMutation.mutate()}
            >
              {genMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Criar
            </Button>
          </div>
        </div>
        <div className="border-t border-border pt-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Todos ({all.length}) — {due.length} para hoje
          </div>
          <div className="space-y-1 max-h-[360px] overflow-y-auto">
            {all.map((c) => (
              <div key={c.id} className="flex items-start gap-1 group text-xs border border-border/50 rounded p-2">
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{c.front}</p>
                  <p className="truncate text-muted-foreground text-[11px]">{c.back}</p>
                </div>
                <button
                  onClick={() => delFn({ data: { id: c.id } }).then(() => qc.invalidateQueries({ queryKey: ["flashcards-due"] }))}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="border border-border rounded-md bg-card p-6 flex flex-col items-center justify-center min-h-[400px]">
        {!current ? (
          <div className="text-center space-y-3">
            <Frame size={40} className="mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {all.length === 0 ? "Nenhum flashcard ainda — crie um deck!" : "Você está em dia com as revisões."}
            </p>
            {idx > 0 && (
              <Button size="sm" variant="outline" onClick={() => setIdx(0)} className="gap-1">
                <RotateCcw size={13} /> Reiniciar
              </Button>
            )}
          </div>
        ) : (
          <div className="w-full max-w-xl space-y-4">
            <div className="text-xs text-muted-foreground text-center">
              Card {idx + 1} de {due.length}
            </div>
            <button
              onClick={() => setFlipped((f) => !f)}
              className="w-full min-h-[220px] border border-border rounded-md bg-background p-6 text-left hover:bg-accent/30 transition-colors"
            >
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
                {flipped ? "Resposta" : "Pergunta"}
              </div>
              <p className="text-lg leading-relaxed whitespace-pre-wrap">
                {flipped ? current.back : current.front}
              </p>
              {!flipped && (
                <p className="mt-4 text-xs text-muted-foreground">Toque para ver a resposta</p>
              )}
            </button>
            {flipped && (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {[
                  { q: 0, l: "Errei", v: "destructive" as const },
                  { q: 3, l: "Difícil", v: "outline" as const },
                  { q: 4, l: "Bom", v: "outline" as const },
                  { q: 5, l: "Fácil", v: "default" as const },
                ].map((b) => (
                  <Button
                    key={b.q}
                    size="sm"
                    variant={b.v}
                    onClick={() => reviewMutation.mutate({ id: current.id, quality: b.q })}
                    disabled={reviewMutation.isPending}
                  >
                    {b.l}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
