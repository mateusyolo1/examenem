import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  StickyNote,
  NotebookPen,
  BookOpen,
  FileText,
  ListChecks,
  Bell,
  ScrollText,
  Plus,
  Trash2,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import {
  createVideoNote,
  deleteVideoNote,
  listVideoNotes,
  updateVideoNote,
} from "@/lib/video-notes.functions";

export type NoteStyle =
  | "post-it"
  | "notinha"
  | "topicos"
  | "lembrete"
  | "resumo"
  | "notepad"
  | "notebook";

type StyleDef = {
  id: NoteStyle;
  label: string;
  hint: string;
  icon: LucideIcon;
  color: string;
  cardWidth: string;
  cardClass: string;
  bodyClass: string;
  font: string;
};

const STYLES: StyleDef[] = [
  {
    id: "post-it",
    label: "Post-it",
    hint: "1 frase-chave",
    icon: StickyNote,
    color: "text-yellow-500",
    cardWidth: "w-60",
    cardClass:
      "bg-yellow-100 dark:bg-yellow-950/60 border-yellow-300 dark:border-yellow-700 shadow-md -rotate-1",
    bodyClass: "text-yellow-950 dark:text-yellow-100",
    font: "font-medium",
  },
  {
    id: "notinha",
    label: "Notinha",
    hint: "2-3 frases curtas",
    icon: FileText,
    color: "text-pink-500",
    cardWidth: "w-64",
    cardClass: "bg-pink-50 dark:bg-pink-950/40 border-pink-300 dark:border-pink-800",
    bodyClass: "text-pink-950 dark:text-pink-100",
    font: "",
  },
  {
    id: "topicos",
    label: "Tópicos",
    hint: "Lista objetiva",
    icon: ListChecks,
    color: "text-orange-500",
    cardWidth: "w-72",
    cardClass: "bg-orange-50 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800",
    bodyClass: "text-orange-950 dark:text-orange-100",
    font: "",
  },
  {
    id: "lembrete",
    label: "Lembrete",
    hint: "Dica para não esquecer",
    icon: Bell,
    color: "text-red-500",
    cardWidth: "w-64",
    cardClass:
      "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 border-l-4",
    bodyClass: "text-red-950 dark:text-red-100",
    font: "italic",
  },
  {
    id: "resumo",
    label: "Resumo",
    hint: "Parágrafo compacto",
    icon: ScrollText,
    color: "text-sky-500",
    cardWidth: "w-72",
    cardClass: "bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800",
    bodyClass: "text-sky-950 dark:text-sky-100",
    font: "",
  },
  {
    id: "notepad",
    label: "Notepad",
    hint: "Título + tópicos",
    icon: NotebookPen,
    color: "text-indigo-500",
    cardWidth: "w-80",
    cardClass:
      "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 bg-[linear-gradient(transparent_23px,rgba(99,102,241,0.15)_24px)] bg-[length:100%_24px]",
    bodyClass: "text-indigo-950 dark:text-indigo-100 leading-6",
    font: "font-mono text-[12px]",
  },
  {
    id: "notebook",
    label: "Notebook",
    hint: "Explicação detalhada (~1min)",
    icon: BookOpen,
    color: "text-emerald-500",
    cardWidth: "w-[420px]",
    cardClass:
      "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 border-l-8",
    bodyClass: "text-emerald-950 dark:text-emerald-100 leading-relaxed",
    font: "",
  },
];

const styleOf = (id: string): StyleDef => STYLES.find((s) => s.id === id) ?? STYLES[0];

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

interface Note {
  id: string;
  timestamp_seconds: number;
  style: string;
  ai_explanation: string;
  user_note: string;
  created_at: string;
}

export function VideoNotesLayer({
  videoId,
  youtubeId,
  videoTitle,
  topicTitle,
  getCurrentTime,
  onSeek,
}: {
  videoId: string;
  youtubeId: string;
  videoTitle: string;
  topicTitle: string;
  getCurrentTime: () => number;
  onSeek?: (seconds: number) => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listVideoNotes);
  const createFn = useServerFn(createVideoNote);
  const updateFn = useServerFn(updateVideoNote);
  const deleteFn = useServerFn(deleteVideoNote);
  const [style, setStyle] = useState<NoteStyle>("post-it");
  const [openId, setOpenId] = useState<string | null>(null);

  const key = ["video-notes", videoId] as const;

  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: notes = [] } = useQuery({
    queryKey: key,
    queryFn: () => listFn({ data: { videoId } }),
  });

  const create = useMutation({
    mutationFn: (chosenStyle: NoteStyle) => {
      const t = Math.max(0, Math.floor(getCurrentTime()));
      return createFn({
        data: {
          videoId,
          youtubeId,
          videoTitle,
          topicTitle,
          timestampSeconds: t,
          style: chosenStyle,
        },
      });
    },
    onSuccess: (n) => {
      qc.setQueryData<Note[]>(key, (prev) =>
        [...(prev ?? []), n as Note].sort(
          (a, b) => a.timestamp_seconds - b.timestamp_seconds,
        ),
      );
      setOpenId((n as Note).id);
      toast.success(
        `Nota "${styleOf((n as Note).style).label}" criada em ${fmt(
          (n as Note).timestamp_seconds,
        )}`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onMutate: (id) => {
      qc.setQueryData<Note[]>(key, (prev) => (prev ?? []).filter((n) => n.id !== id));
    },
  });

  const update = useMutation({
    mutationFn: (v: { id: string; userNote?: string; style?: NoteStyle }) =>
      updateFn({ data: v }),
    onMutate: async (v) => {
      // Optimistic — so the popover reopens with the saved text next time.
      qc.setQueryData<Note[]>(key, (prev) =>
        (prev ?? []).map((n) =>
          n.id === v.id
            ? {
                ...n,
                ...(v.userNote !== undefined ? { user_note: v.userNote } : {}),
                ...(v.style !== undefined ? { style: v.style } : {}),
              }
            : n,
        ),
      );
    },
  });

  return (
    <div className="mt-3 space-y-2">
      {/* Discreet toolbar */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <button
          onClick={() => create.mutate(style)}
          disabled={create.isPending}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border/60 hover:bg-accent hover:text-foreground transition-colors"
          title={`Criar nota "${styleOf(style).label}" no momento atual`}
        >
          {create.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Plus size={12} />
          )}
          Criar {styleOf(style).label.toLowerCase()}
          <span className="font-mono text-[10px] opacity-70">
            (em {fmt(getCurrentTime())})
          </span>
        </button>
        <div className="flex items-center gap-0.5 opacity-80">
          {STYLES.map((s) => {
            const Icon = s.icon;
            const active = style === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                title={`${s.label} — ${s.hint}`}
                className={
                  "p-1 rounded hover:bg-accent transition-colors " +
                  (active ? `${s.color} bg-accent` : "text-muted-foreground")
                }
              >
                <Icon size={13} />
              </button>
            );
          })}
        </div>
        {notes.length > 0 && (
          <span className="ml-auto text-[10px] font-mono opacity-70">
            {notes.length} nota{notes.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Marker strip */}
      {notes.length > 0 && (
        <div className="relative h-6">
          <div className="absolute inset-x-0 top-1/2 h-px bg-border/50" />
          {notes.map((n) => {
            const styleDef = styleOf(n.style);
            const Icon = styleDef.icon;
            const isOpen = openId === n.id;
            return (
              <div
                key={n.id}
                className="absolute top-0"
                style={{ left: `${percentPosition(n.timestamp_seconds, notes)}%` }}
              >
                <button
                  onMouseEnter={() => setOpenId(n.id)}
                  onClick={() => {
                    setOpenId(isOpen ? null : n.id);
                    onSeek?.(n.timestamp_seconds);
                  }}
                  className={
                    "block p-1 -translate-x-1/2 rounded-full bg-background border border-border/60 hover:scale-110 transition-transform " +
                    styleDef.color
                  }
                  title={`${styleDef.label} em ${fmt(n.timestamp_seconds)}`}
                >
                  <Icon size={12} />
                </button>
                {isOpen && (
                  <NoteCard
                    key={n.id + ":" + n.user_note.length}
                    note={n as Note}
                    position={percentPosition(n.timestamp_seconds, notes)}
                    onClose={() => setOpenId(null)}
                    onDelete={() => remove.mutate(n.id)}
                    onSaveUserNote={(text) =>
                      update.mutate({ id: n.id, userNote: text })
                    }
                    onChangeStyle={(s) => update.mutate({ id: n.id, style: s })}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function percentPosition(t: number, all: Note[]) {
  const max = Math.max(60, ...all.map((n) => n.timestamp_seconds));
  return Math.min(98, Math.max(2, (t / max) * 100));
}

function NoteCard({
  note,
  position,
  onClose,
  onDelete,
  onSaveUserNote,
  onChangeStyle,
}: {
  note: Note;
  position: number;
  onClose: () => void;
  onDelete: () => void;
  onSaveUserNote: (text: string) => void;
  onChangeStyle: (s: NoteStyle) => void;
}) {
  const [text, setText] = useState(note.user_note);
  const savedRef = useRef(note.user_note);
  const ref = useRef<HTMLDivElement>(null);
  const styleDef = styleOf(note.style);
  const Icon = styleDef.icon;

  const flush = () => {
    if (text !== savedRef.current) {
      savedRef.current = text;
      onSaveUserNote(text);
    }
  };

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        flush();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, text]);

  const align =
    position > 70 ? "right-0" : position < 30 ? "left-0" : "left-1/2 -translate-x-1/2";

  return (
    <div
      ref={ref}
      className={`absolute top-6 z-20 ${styleDef.cardWidth} border rounded-md p-3 text-left ${align} ${styleDef.cardClass}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest ${styleDef.color}`}
        >
          <Icon size={11} />
          {styleDef.label} · {fmt(note.timestamp_seconds)}
        </span>
        <div className="flex items-center gap-0.5">
          {STYLES.map((s) => {
            const SIcon = s.icon;
            const active = note.style === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onChangeStyle(s.id)}
                title={`Mudar para ${s.label}`}
                className={
                  "p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 " +
                  (active ? `${s.color}` : "text-muted-foreground opacity-50")
                }
              >
                <SIcon size={10} />
              </button>
            );
          })}
          <button
            onClick={onDelete}
            title="Excluir"
            className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <div
        className={`text-[13px] whitespace-pre-wrap mb-2 ${styleDef.bodyClass} ${styleDef.font} ${
          note.style === "notebook" ? "max-h-72 overflow-y-auto pr-1" : ""
        }`}
      >
        {note.ai_explanation || "Sem explicação automática."}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={flush}
        placeholder="O que você entendeu desta parte?"
        className={
          "w-full text-xs p-2 rounded border border-border/70 bg-background/70 resize-y focus:outline-none focus:ring-1 focus:ring-primary " +
          (note.style === "notebook" ? "min-h-[120px]" : "min-h-[64px]")
        }
      />
    </div>
  );
}
