// Reusable "Gerar mapa mental do vídeo" button used from two places:
//   1) NotesTab video-header (compact mode: `variant="card"`) — generates
//      the map, saves it as a new mind_map, and navigates the user to the
//      Mapas mentais tab with that map opened.
//   2) MindMapsTab toolbar (`variant="toolbar"`) — opens a popover listing
//      the user's processed videos; picking one inserts the elements into
//      the CURRENT canvas beside existing content.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Network, Sparkles, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  generateMindMapFromVideo,
  saveMindMap,
  listVideosForMindMap,
} from "@/lib/study-hub.functions";
import {
  buildMindMapFromVideoElements,
  type MindMapSpec,
} from "./mindMapFromVideoBuilder";

interface CardProps {
  variant: "card";
  videoId: string;
  videoTitle: string;
}

interface ToolbarProps {
  variant: "toolbar";
  /** Called with the built Excalidraw elements + a suggested title.
   *  The parent inserts them into the active canvas. */
  onInsert: (elements: any[], meta: { title: string; videoTitle: string }) => void;
}

type Props = CardProps | ToolbarProps;

export function GenerateFromVideoButton(props: Props) {
  const generateFn = useServerFn(generateMindMapFromVideo);
  const saveFn = useServerFn(saveMindMap);
  const listVideosFn = useServerFn(listVideosForMindMap);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [openPicker, setOpenPicker] = useState(false);
  const [pending, setPending] = useState<string | null>(null); // videoId being generated

  async function generateAndPipe(
    videoId: string,
    videoTitle: string,
    mode: "save-and-open" | "insert-into-canvas",
  ) {
    setPending(videoId);
    const toastId = toast.loading("Buscando legenda e gerando mapa…");
    try {
      const spec = await generateFn({ data: { videoId } });
      if (!spec.branches || spec.branches.length === 0) {
        toast.error("A IA não conseguiu extrair ramos do vídeo.", { id: toastId });
        return;
      }
      const mindMapSpec: MindMapSpec = {
        central: spec.central,
        branches: spec.branches,
        youtubeId: spec.youtubeId,
      };
      const skeleton = buildMindMapFromVideoElements(mindMapSpec, {
        centerX: 0,
        centerY: 0,
      });
      // Normalize the raw skeleton (rectangles-with-label, line bindings) into
      // real Excalidraw scene elements (rectangle + bound text element pairs).
      // Without this step, saved maps are stored as naked rectangles and the
      // labels never render when the map is reopened.
      const m = await import("@excalidraw/excalidraw");
      const elements = m.convertToExcalidrawElements(skeleton);
      const title = `Mapa mental — ${spec.videoTitle}`.slice(0, 200);

      if (mode === "save-and-open") {
        const saved = await saveFn({
          data: {
            title,
            nodes: elements,
            edges: [
              {
                viewBackgroundColor: "#ffffff",
                files: {},
                sourceVideoId: spec.videoId,
                sourceYoutubeId: spec.youtubeId,
              },
            ],
          },
        });
        qc.invalidateQueries({ queryKey: ["mind-maps"] });
        toast.success("Mapa gerado! Abrindo…", { id: toastId });
        navigate({
          to: "/estudos",
          search: (prev: any) => ({ ...prev, tab: "mapas", openMap: saved?.id }),
        });
      } else {
        (props as ToolbarProps).onInsert(elements, { title, videoTitle: spec.videoTitle });
        toast.success("Mapa inserido no canvas.", { id: toastId });
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Falha ao gerar mapa mental.",
        { id: toastId },
      );
    } finally {
      setPending(null);
      setOpenPicker(false);
    }
  }

  if (props.variant === "card") {
    const busy = pending === props.videoId;
    return (
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={() => generateAndPipe(props.videoId, props.videoTitle, "save-and-open")}
        className="ml-auto h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
        title="Gerar mapa mental a partir deste vídeo"
      >
        {busy ? <Loader2 size={11} className="animate-spin" /> : <Network size={11} />}
        {busy ? "Gerando…" : "Gerar mapa mental"}
      </Button>
    );
  }

  return (
    <Popover open={openPicker} onOpenChange={setOpenPicker}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Sparkles size={13} />
          Gerar do vídeo…
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <VideoPicker
          disabled={!!pending}
          fetch={listVideosFn}
          onPick={(v) => generateAndPipe(v.videoId, v.title, "insert-into-canvas")}
          pending={pending}
        />
      </PopoverContent>
    </Popover>
  );
}

function VideoPicker({
  fetch,
  onPick,
  disabled,
  pending,
}: {
  fetch: () => Promise<
    Array<{ videoId: string; youtubeId: string; title: string; channel: string; thumbnail: string }>
  >;
  onPick: (v: { videoId: string; title: string }) => void;
  disabled: boolean;
  pending: string | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["videos-for-mind-map"],
    queryFn: () => fetch(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
        <Loader2 size={12} className="animate-spin" /> Carregando vídeos…
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="py-4 px-2 text-xs text-muted-foreground text-center">
        Nenhum vídeo processado ainda.<br />
        Crie notas em uma aula para poder gerar um mapa.
      </div>
    );
  }

  return (
    <div className="max-h-72 overflow-y-auto space-y-1">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-2 py-1">
        Escolha um vídeo
      </div>
      {data.map((v) => {
        const busy = pending === v.videoId;
        return (
          <button
            key={v.videoId}
            disabled={disabled}
            onClick={() => onPick(v)}
            className="w-full text-left flex items-start gap-2 p-2 rounded-md hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {v.thumbnail ? (
              <img
                src={v.thumbnail}
                alt=""
                className="w-14 h-10 object-cover rounded-sm border border-border shrink-0"
              />
            ) : (
              <div className="w-14 h-10 rounded-sm bg-muted flex items-center justify-center shrink-0">
                <Video size={14} className="text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium line-clamp-2">{v.title}</div>
              {v.channel && (
                <div className="text-[10px] text-muted-foreground truncate">{v.channel}</div>
              )}
            </div>
            {busy && <Loader2 size={12} className="animate-spin shrink-0 mt-1" />}
          </button>
        );
      })}
    </div>
  );
}
