import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  StickyNote,
  NotebookPen,
  BookOpen,
  FileText,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  createVideoNote,
  deleteVideoNote,
  listVideoNotes,
  updateVideoNote,
} from "@/lib/video-notes.functions";

export type NoteStyle = "post-it" | "notinha" | "notepad" | "notebook";

const STYLES: {
  id: NoteStyle;
  label: string;
  icon: typeof StickyNote;
  color: string;
}[] = [
  { id: "post-it", label: "Post-it", icon: StickyNote, color: "text-yellow-500" },
  { id: "notinha", label: "Notinha", icon: FileText, color: "text-pink-500" },
  { id: "notepad", label: "Notepad", icon: NotebookPen, color: "text-blue-500" },
  { id: "notebook", label: "Notebook", icon: BookOpen, color: "text-emerald-500" },
];

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
    mutationFn: () => {
      const t = Math.max(0, Math.floor(getCurrentTime()));
      return createFn({
        data: {
          videoId,
          youtubeId,
          videoTitle,
          topicTitle,
          timestampSeconds: t,
          style,
        },
      });
    },
    onSuccess: (n) => {
      qc.setQueryData<Note[]>(key, (prev) =>
        [...(prev ?? []), n as Note].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds),
      );
      setOpenId((n as Note).id);
      toast.success(`Nota criada em ${fmt((n as Note).timestamp_seconds)}`);
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
  });

  return (
    <div className="mt-3 space-y-2">
      {/* Discreet toolbar */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border/60 hover:bg-accent hover:text-foreground transition-colors"
          title="Criar nota no momento atual do vídeo"
        >
          {create.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Plus size={12} />
          )}
          Criar nota
          <span className="font-mono text-[10px] opacity-70">
            (em {fmt(getCurrentTime())})
          </span>
        </button>
        <div className="flex items-center gap-0.5 opacity-70">
          {STYLES.map((s) => {
            const Icon = s.icon;
            const active = style === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                title={s.label}
                className={
                  "p-1 rounded hover:bg-accent transition-colors " +
                  (active ? `${s.color} bg-accent` : "text-muted-foreground")
                }
              >
                <Icon size={12} />
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
            const styleDef =
              STYLES.find((s) => s.id === n.style) ?? STYLES[0];
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
                  title={`Nota em ${fmt(n.timestamp_seconds)}`}
                >
                  <Icon size={12} />
                </button>
                {isOpen && (
                  <NoteCard
                    note={n as Note}
                    position={percentPosition(n.timestamp_seconds, notes)}
                    onClose={() => setOpenId(null)}
                    onDelete={() => remove.mutate(n.id)}
                    onSaveUserNote={(text) =>
                      update.mutate({ id: n.id, userNote: text })
                    }
                    onChangeStyle={(s) => {
                      qc.setQueryData<Note[]>(key, (prev) =>
                        (prev ?? []).map((x) =>
                          x.id === n.id ? { ...x, style: s } : x,
                        ),
                      );
                      update.mutate({ id: n.id, style: s });
                    }}
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
  // Distribute markers across a virtual 0..max range (with a floor of 60s)
  // so single markers don't stack at 0%.
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  // Anchor the popover based on marker position so it doesn't overflow.
  const align =
    position > 70 ? "right-0" : position < 30 ? "left-0" : "left-1/2 -translate-x-1/2";

  return (
    <div
      ref={ref}
      className={`absolute top-6 z-20 w-72 bg-card border border-border rounded-md shadow-lg p-3 text-left ${align}`}
      onMouseLeave={() => {
        if (text !== note.user_note) onSaveUserNote(text);
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {fmt(note.timestamp_seconds)}
        </span>
        <div className="flex items-center gap-0.5">
          {STYLES.map((s) => {
            const Icon = s.icon;
            const active = note.style === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onChangeStyle(s.id)}
                title={s.label}
                className={
                  "p-0.5 rounded hover:bg-accent " +
                  (active ? `${s.color}` : "text-muted-foreground opacity-60")
                }
              >
                <Icon size={11} />
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
      <div className="text-xs leading-relaxed text-foreground whitespace-pre-wrap mb-2">
        {note.ai_explanation || "Sem explicação automática."}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text !== note.user_note) onSaveUserNote(text);
        }}
        placeholder="O que você entendeu desta parte?"
        className="w-full min-h-[64px] text-xs p-2 rounded border border-border bg-background resize-y focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
