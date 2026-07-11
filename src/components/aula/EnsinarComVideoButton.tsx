// Botão "Ensinar com vídeo" — captura timestamp do player e abre o painel
// de micro-aprendizado. Pausa o vídeo ao abrir para o(a) aluno(a) focar.

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Brain, Loader2 } from "lucide-react";
import {
  generateMicroLearningCycle,
  type MicroLearningCycle,
} from "@/lib/micro-learning.functions";
import { MicroLearningPanel } from "./MicroLearningPanel";

interface Props {
  topicId: string;
  topicTitle: string;
  topicArea: string;
  youtubeId: string;
  getCurrentTime: () => number;
  pausePlayer: () => void;
}

export function EnsinarComVideoButton({
  topicId,
  topicTitle,
  topicArea,
  youtubeId,
  getCurrentTime,
  pausePlayer,
}: Props) {
  const [open, setOpen] = useState(false);
  const [timestamp, setTimestamp] = useState(0);
  const generate = useServerFn(generateMicroLearningCycle);

  const mutation = useMutation({
    mutationFn: (payload: {
      topicId: string;
      youtubeId: string;
      timestamp: number;
      mainTopic: string;
      subject: string;
    }) => generate({ data: payload }) as Promise<MicroLearningCycle>,
    onError: (err: Error) => {
      const msg = err?.message ?? "";
      if (msg.includes("PAYMENT_REQUIRED")) {
        // O QueryCache/MutationCache global do router já abre o paywall.
        return;
      }
      toast.error(msg || "Não consegui montar o ciclo. Tente de novo.");
    },
  });

  const trigger = () => {
    const ts = Math.max(0, Math.floor(getCurrentTime() || 0));
    setTimestamp(ts);
    try {
      pausePlayer();
    } catch {}
    setOpen(true);
    mutation.mutate({
      topicId,
      youtubeId,
      timestamp: ts,
      mainTopic: topicTitle,
      subject: topicArea,
    });
  };

  const retry = () => {
    mutation.mutate({
      topicId,
      youtubeId,
      timestamp,
      mainTopic: topicTitle,
      subject: topicArea,
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={trigger}
        disabled={mutation.isPending}
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-60"
        title="Analisar o que a professora está explicando neste momento"
      >
        {mutation.isPending ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Brain size={12} />
        )}
        Ensinar com vídeo
      </button>
      <MicroLearningPanel
        open={open}
        onOpenChange={setOpen}
        loading={mutation.isPending}
        cycle={mutation.data ?? null}
        errorMessage={
          mutation.error && !String(mutation.error.message).includes("PAYMENT_REQUIRED")
            ? mutation.error.message
            : null
        }
        timestampSec={timestamp}
        onRetry={retry}
      />
    </>
  );
}
