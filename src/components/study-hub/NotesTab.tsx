import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronRight,
  FileText,
  List,
  NotebookPen,
  StickyNote,
  Tag,
} from "lucide-react";
import { listAllVideoNotes } from "@/lib/study-hub.functions";
import { GenerateFromVideoButton } from "./GenerateFromVideoButton";

export function NotesTab() {
  const listFn = useServerFn(listAllVideoNotes);
  const { data: notes = [] } = useQuery({
    queryKey: ["all-video-notes"],
    queryFn: () => listFn(),
  });

  if (notes.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-md p-10 text-center text-sm text-muted-foreground bg-card">
        Suas notas de vídeo aparecerão aqui. Assista aulas e crie notas no timeline dos vídeos.
      </div>
    );
  }

  // Group: topic → video → notes
  const byTopic = new Map<
    string,
    { topicTitle: string; videos: Map<string, { videoTitle: string; channel: string; youtubeId: string; notes: typeof notes }> }
  >();
  for (const n of notes as any[]) {
    const tKey = n.topic_id ?? `__no_topic__`;
    if (!byTopic.has(tKey)) byTopic.set(tKey, { topicTitle: n.topic_title, videos: new Map() });
    const bucket = byTopic.get(tKey)!;
    if (!bucket.videos.has(n.video_id)) {
      bucket.videos.set(n.video_id, {
        videoTitle: n.video_title,
        channel: n.channel_name,
        youtubeId: n.youtube_id,
        notes: [] as any,
      });
    }
    (bucket.videos.get(n.video_id)!.notes as any[]).push(n);
  }

  return (
    <div className="space-y-8">
      {Array.from(byTopic.entries()).map(([tKey, { topicTitle, videos }]) => (
        <section key={tKey} className="space-y-4">
          <h2 className="text-sm font-mono uppercase tracking-widest text-foreground/80 border-b border-border pb-1">
            {topicTitle}
          </h2>
          {Array.from(videos.entries()).map(([vId, v]) => (
            <div key={vId} className="space-y-2">
              <div className="flex items-baseline gap-2 text-xs">
                <span className="font-medium text-foreground truncate">{v.videoTitle}</span>
                {v.channel && <span className="text-muted-foreground truncate">· {v.channel}</span>}
                <span className="text-muted-foreground">· {v.notes.length} nota{v.notes.length > 1 ? "s" : ""}</span>
                <GenerateFromVideoButton variant="card" videoId={vId} videoTitle={v.videoTitle} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {v.notes.map((n: any) => (
                  <div key={n.id} className="border border-border rounded-md p-3 bg-card">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                      <span className="inline-flex items-center gap-1.5">
                        {(() => {
                          const s = String(n.style ?? "").toLowerCase();
                          if (s.includes("topico")) return <List size={11} strokeWidth={2} />;
                          if (s.includes("resumo")) return <FileText size={11} strokeWidth={2} />;
                          if (s.includes("notinha") || s.includes("nota")) return <NotebookPen size={11} strokeWidth={2} />;
                          if (s.includes("post")) return <StickyNote size={11} strokeWidth={2} />;
                          return <Tag size={11} strokeWidth={2} />;
                        })()}
                        <span>{n.style}</span>
                      </span>
                      <span>{new Date(n.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{n.ai_explanation}</p>
                    {n.user_note && (
                      <div className="mt-2 pt-2 border-t border-border text-xs text-foreground/90 whitespace-pre-wrap">
                        <span className="font-mono uppercase text-[10px] text-muted-foreground">Eu: </span>
                        {n.user_note}
                      </div>
                    )}
                    <a
                      href={`https://youtu.be/${n.youtube_id}?t=${n.timestamp_seconds}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight size={11} /> Abrir no YouTube
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
