import { YoutubeTranscript } from "youtube-transcript";

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
  lang?: string;
}

export interface VideoTranscript {
  lang?: string;
  text: string;
  segmentCount: number;
}

const MAX_TRANSCRIPT_CHARS = 28_000;

function formatTimestamp(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function transcriptToLines(segments: TranscriptSegment[]) {
  return segments
    .map((segment) => {
      const text = normalizeText(segment.text);
      return text ? `${formatTimestamp(segment.offset)} — ${text}` : "";
    })
    .filter(Boolean);
}

function fitTranscript(lines: string[]) {
  const full = lines.join("\n");
  if (full.length <= MAX_TRANSCRIPT_CHARS) return full;

  const slices = 8;
  const budgetPerSlice = Math.floor(MAX_TRANSCRIPT_CHARS / slices) - 80;
  const chunkSize = Math.ceil(lines.length / slices);
  const selected: string[] = [];

  for (let i = 0; i < slices; i++) {
    const chunk = lines.slice(i * chunkSize, (i + 1) * chunkSize);
    let used = 0;
    const kept: string[] = [];
    for (const line of chunk) {
      if (used + line.length + 1 > budgetPerSlice) break;
      kept.push(line);
      used += line.length + 1;
    }
    if (kept.length > 0) {
      if (selected.length > 0) selected.push("[...]");
      selected.push(...kept);
    }
  }

  return selected.join("\n").slice(0, MAX_TRANSCRIPT_CHARS);
}

export async function fetchYoutubeTranscriptText(youtubeId: string): Promise<VideoTranscript> {
  let segments: TranscriptSegment[] | null = null;

  try {
    segments = await YoutubeTranscript.fetchTranscript(youtubeId, { lang: "pt" });
  } catch {
    try {
      segments = await YoutubeTranscript.fetchTranscript(youtubeId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "transcrição indisponível";
      throw new Error(message.includes("disabled") ? "legendas desativadas" : "sem legenda disponível");
    }
  }

  const usableSegments = (segments ?? []).filter((segment) => normalizeText(segment.text).length > 0);
  if (usableSegments.length === 0) throw new Error("sem legenda disponível");

  return {
    lang: usableSegments[0]?.lang,
    text: fitTranscript(transcriptToLines(usableSegments)),
    segmentCount: usableSegments.length,
  };
}