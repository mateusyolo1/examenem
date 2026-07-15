// Painel lateral interativo da Sala de Aula.
//
// Objetivo pedagógico: dar ao aluno duas ferramentas em qualquer momento
// da aula, sem tirar o foco do vídeo:
//   1. Nota rápida — pausa o player automaticamente quando começa a digitar
//      e retoma ao salvar/cancelar. Salva como uma "Notinha" ancorada no
//      timestamp atual do vídeo (mesmo formato do VideoNotesLayer).
//   2. Mapa mental — atalho para abrir o mapa mental deste assunto no
//      Hub de Estudos (rota /estudos com a aba "Mapas mentais").
//
// No desktop (xl:) fica encaixado como coluna direita permanente. Em telas
// menores, exibimos um FAB flutuante que abre o painel como sheet.

import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Brain,
  ChevronRight,
  Loader2,
  PanelRightOpen,
  Save,
  StickyNote,
  X,
} from "lucide-react";
import { createVideoNote, updateVideoNote } from "@/lib/video-notes.functions";

interface Props {
  videoId: string;
  youtubeId: string;
  videoTitle: string;
  topicTitle: string;
  getCurrentTime: () => number;
  pausePlayer: () => void;
  playPlayer: () => void;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function QuickNote({
  videoId,
  youtubeId,
  videoTitle,
  topicTitle,
  getCurrentTime,
  pausePlayer,
  playPlayer,
}: Props) {
  const [text, setText] = useState("");
  const [pausedByUs, setPausedByUs] = useState(false);
  const [timestamp, setTimestamp] = useState(0);
  const [, setTick] = useState(0);
  const createFn = useServerFn(createVideoNote);
  const updateFn = useServerFn(updateVideoNote);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      const t = Math.max(0, Math.floor(getCurrentTime()));
      const created = (await createFn({
        data: {
          videoId,
          youtubeId,
          videoTitle,
          topicTitle,
          timestampSeconds: t,
          style: "notinha",
        },
      })) as { id: string };
      if (text.trim()) {
        await updateFn({ data: { id: created.id, userNote: text.trim() } });
      }
      return created;
    },
    onSuccess: () => {
      toast.success("Nota salva no vídeo");
      setText("");
      setTimestamp(0);
      if (pausedByUs) {
        try {
          playPlayer();
        } catch {}
        setPausedByUs(false);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onFocus = () => {
    try {
      pausePlayer();
      setPausedByUs(true);
      setTimestamp(Math.max(0, Math.floor(getCurrentTime())));
    } catch {}
  };

  const cancel = () => {
    setText("");
    if (pausedByUs) {
      try {
        playPlayer();
      } catch {}
      setPausedByUs(false);
    }
  };

  const currentTs = timestamp || Math.max(0, Math.floor(getCurrentTime()));

  return (
    <div className="border border-border rounded-md p-3 bg-card">
      <div className="flex items-center gap-2 mb-2">
        <StickyNote size={14} className="text-pink-500" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Nota rápida
        </span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground tabular-nums">
          em {fmt(currentTs)}
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={onFocus}
        placeholder="Escreva sem perder o fio da meada — pausamos o vídeo pra você."
        className="w-full text-sm p-2 rounded border border-border bg-background resize-y min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {pausedByUs && (
        <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Vídeo pausado — retomamos ao salvar.
        </p>
      )}
      <div className="mt-2 flex items-center gap-2 justify-end">
        {(text.trim() || pausedByUs) && (
          <button
            type="button"
            onClick={cancel}
            className="text-[11px] font-medium px-2 py-1 rounded border border-border hover:bg-accent"
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded bg-foreground text-background hover:opacity-90 disabled:opacity-60"
        >
          {save.isPending ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
          Salvar nota
        </button>
      </div>
    </div>
  );
}

function MindMapShortcut() {
  return (
    <div className="border border-border rounded-md p-3 bg-card">
      <div className="flex items-center gap-2 mb-2">
        <Brain size={14} className="text-emerald-500" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Mapa mental
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
        Abra o mapa mental deste assunto para visualizar as conexões enquanto assiste.
      </p>
      <Link
        to="/estudos"
        search={{ tab: "mapas" }}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
      >
        <ChevronRight size={11} /> Abrir em nova aba
      </Link>
    </div>
  );
}

function PanelBody(props: Props) {
  return (
    <div className="space-y-3">
      <QuickNote {...props} />
      <MindMapShortcut />
    </div>
  );
}

export function AulaSidePanel(props: Props) {
  const [openMobile, setOpenMobile] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      {/* Desktop: coluna direita permanente */}
      <aside
        aria-label="Painel lateral da aula"
        className="hidden xl:block fixed top-24 right-6 w-80 z-20"
      >
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 px-1">
          Painel de aula
        </div>
        <PanelBody {...props} />
      </aside>

      {/* Mobile/tablet: botão flutuante + sheet */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpenMobile(true)}
        aria-label="Abrir painel da aula"
        className="xl:hidden fixed bottom-6 right-4 z-30 h-11 w-11 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center hover:opacity-90"
      >
        <PanelRightOpen size={18} />
      </button>

      {openMobile && (
        <div
          className="xl:hidden fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
          aria-label="Painel da aula"
        >
          <div
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={() => setOpenMobile(false)}
          />
          <div className="absolute bottom-0 inset-x-0 bg-card border-t border-border rounded-t-2xl shadow-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Painel de aula
              </span>
              <button
                type="button"
                onClick={() => setOpenMobile(false)}
                aria-label="Fechar"
                className="h-8 w-8 rounded-md border border-border flex items-center justify-center hover:bg-accent"
              >
                <X size={14} />
              </button>
            </div>
            <PanelBody {...props} />
          </div>
        </div>
      )}
    </>
  );
}
