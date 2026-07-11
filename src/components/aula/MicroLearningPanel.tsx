// Painel lateral do "Ensinar com vídeo" — mostra o ciclo de micro-aprendizado
// (Mapa, Prática, Explicação, Vídeos) gerado a partir do timestamp em que o
// aluno pausou o vídeo.

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Check,
  ClipboardList,
  MessageCircle,
  Sparkles,
  Video as VideoIcon,
  X,
} from "lucide-react";
import type {
  MicroLearningCycle,
  MicroLearningQuestion,
} from "@/lib/micro-learning.functions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  cycle: MicroLearningCycle | null;
  errorMessage: string | null;
  timestampSec: number;
  onRetry: () => void;
}

function fmtTs(s: number) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

export function MicroLearningPanel({
  open,
  onOpenChange,
  loading,
  cycle,
  errorMessage,
  timestampSec,
  onRetry,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col p-0"
      >
        <SheetHeader className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-primary" />
            <SheetTitle className="text-sm font-mono uppercase tracking-widest">
              Ensinar com vídeo
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            {loading
              ? "Analisando o conceito neste momento da aula…"
              : cycle
                ? `Sub-conceito identificado no ${fmtTs(timestampSec)}.`
                : errorMessage
                  ? "Falha ao gerar o ciclo."
                  : "Ciclo curto de estudo focado no que você travou."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0">
          {loading && <PanelSkeleton />}
          {!loading && errorMessage && (
            <div className="p-6 space-y-3 text-sm">
              <p className="text-destructive">{errorMessage}</p>
              <Button size="sm" onClick={onRetry}>
                Tentar de novo
              </Button>
            </div>
          )}
          {!loading && cycle && <PanelBody cycle={cycle} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PanelSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function PanelBody({ cycle }: { cycle: MicroLearningCycle }) {
  const { analysis } = cycle;
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-2 border-b border-border space-y-2">
        <div className="text-sm font-semibold leading-snug">
          {analysis.subConcept}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[10px] font-mono uppercase">
            {analysis.difficulty === "easy"
              ? "fácil"
              : analysis.difficulty === "medium"
                ? "média"
                : "difícil"}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono uppercase">
            {analysis.estimatedStudyTime}
          </Badge>
          {cycle.transcriptSource === "none" && (
            <Badge variant="outline" className="text-[10px] font-mono uppercase text-amber-600">
              sem legenda
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="mapa" className="flex-1 min-h-0 flex flex-col">
        <TabsList className="mx-4 mt-3 grid grid-cols-4 h-9">
          <TabsTrigger value="mapa" className="text-xs gap-1">
            <Brain size={12} /> Mapa
          </TabsTrigger>
          <TabsTrigger value="pratica" className="text-xs gap-1">
            <ClipboardList size={12} /> Prática
          </TabsTrigger>
          <TabsTrigger value="tutor" className="text-xs gap-1">
            <MessageCircle size={12} /> Tutor
          </TabsTrigger>
          <TabsTrigger value="videos" className="text-xs gap-1">
            <VideoIcon size={12} /> Vídeos
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            <TabsContent value="mapa" className="mt-0">
              <MapView cycle={cycle} />
            </TabsContent>
            <TabsContent value="pratica" className="mt-0 space-y-4">
              {cycle.questions.map((q, i) => (
                <QuestionCard key={q.id} q={q} index={i} />
              ))}
              <div className="pt-2 border-t border-border space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Flashcards
                </div>
                {cycle.flashcards.map((f, i) => (
                  <FlashcardCard key={i} front={f.front} back={f.back} />
                ))}
              </div>
            </TabsContent>
            <TabsContent value="tutor" className="mt-0 space-y-3">
              <div className="text-xs text-muted-foreground">
                Enviar este prompt para o Tutor IA:
              </div>
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
                {cycle.analysis.tutorPrompt}
              </div>
              <Link
                to="/tutor"
                search={{ prompt: cycle.analysis.tutorPrompt }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
              >
                <Sparkles size={12} /> Abrir no Tutor IA
              </Link>
            </TabsContent>
            <TabsContent value="videos" className="mt-0 space-y-2">
              {cycle.videos.length === 0 && (
                <div className="text-xs text-muted-foreground py-6 text-center">
                  Não achei vídeos curtos deste tópico. Tente o Tutor ou a Prática.
                </div>
              )}
              {cycle.videos.map((v) => (
                <a
                  key={v.id}
                  href={`https://www.youtube.com/watch?v=${v.youtubeId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex gap-3 items-start p-2 rounded-md border border-border hover:bg-accent transition-colors"
                >
                  {v.thumbnailUrl ? (
                    <img
                      src={v.thumbnailUrl}
                      alt=""
                      className="w-24 h-14 object-cover rounded-sm border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-24 h-14 rounded-sm bg-muted flex items-center justify-center shrink-0">
                      <VideoIcon size={14} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium line-clamp-2">{v.title}</div>
                    {v.channelName && (
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {v.channelName}
                      </div>
                    )}
                    {v.durationSeconds && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {Math.round((v.durationSeconds ?? 0) / 60)} min
                      </div>
                    )}
                  </div>
                </a>
              ))}
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

function MapView({ cycle }: { cycle: MicroLearningCycle }) {
  const { mindMap } = cycle;
  return (
    <div className="space-y-3">
      <div className="text-center">
        <div className="inline-block px-3 py-2 rounded-md bg-primary/10 text-primary font-semibold text-sm border border-primary/30">
          {mindMap.central}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {mindMap.branches.map((b, i) => (
          <div
            key={i}
            className="rounded-md border border-border p-3 bg-card/50"
          >
            <div className="text-xs font-semibold mb-1.5">{b.label}</div>
            {b.children.length > 0 && (
              <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
                {b.children.map((c, j) => (
                  <li key={j}>{c}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionCard({ q, index }: { q: MicroLearningQuestion; index: number }) {
  const [picked, setPicked] = useState<string | null>(null);
  const revealed = picked !== null;
  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="text-[10px] font-mono uppercase text-muted-foreground">
        Questão {index + 1}
      </div>
      <div className="text-xs leading-relaxed">{q.statement}</div>
      <div className="space-y-1">
        {q.choices.map((c) => {
          const isCorrect = c.key === q.correct;
          const isPicked = picked === c.key;
          const bg = !revealed
            ? "hover:bg-accent"
            : isCorrect
              ? "bg-emerald-500/10 border-emerald-500/40"
              : isPicked
                ? "bg-destructive/10 border-destructive/40"
                : "opacity-60";
          return (
            <button
              key={c.key}
              disabled={revealed}
              onClick={() => setPicked(c.key)}
              className={`w-full text-left text-xs px-2.5 py-1.5 rounded border border-border transition-colors flex items-start gap-2 ${bg}`}
            >
              <span className="font-mono font-semibold">{c.key}.</span>
              <span className="flex-1">{c.text}</span>
              {revealed && isCorrect && (
                <Check size={12} className="text-emerald-500 shrink-0 mt-0.5" />
              )}
              {revealed && isPicked && !isCorrect && (
                <X size={12} className="text-destructive shrink-0 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
      {revealed && (
        <div className="text-[11px] text-muted-foreground bg-muted/40 rounded p-2">
          {q.explanation}
        </div>
      )}
    </div>
  );
}

function FlashcardCard({ front, back }: { front: string; back: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped((v) => !v)}
      className="w-full text-left rounded-md border border-border p-3 hover:bg-accent transition-colors"
    >
      <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">
        {flipped ? "Verso" : "Frente"}
      </div>
      <div className="text-xs leading-relaxed">{flipped ? back : front}</div>
      <div className="text-[10px] text-muted-foreground mt-1.5">
        {flipped ? "clique para voltar" : "clique para revelar"}
      </div>
    </button>
  );
}
