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
  source: "youtube-scrape" | "supadata";
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

/**
 * Legacy scraper — YouTube frequently blocks by IP.
 * Kept as last-resort fallback after Supadata.
 */
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
    source: "youtube-scrape",
  };
}

/**
 * Supadata — reliable YouTube transcript API.
 * Docs: https://supadata.ai — GET /v1/youtube/transcript?videoId=...&lang=pt
 * Response shape: { content: [{ text, offset, duration, lang }], lang }
 * or plain-text mode: { content: "full text", lang }
 */
interface SupadataResponse {
  content?:
    | string
    | Array<{ text?: string; offset?: number; duration?: number; lang?: string }>;
  lang?: string;
  error?: string;
  message?: string;
}

export async function fetchSupadataTranscript(youtubeId: string): Promise<VideoTranscript> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) throw new Error("SUPADATA_API_KEY não configurado");

  const url = new URL("https://api.supadata.ai/v1/youtube/transcript");
  url.searchParams.set("videoId", youtubeId);
  url.searchParams.set("lang", "pt");
  url.searchParams.set("text", "false");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: { "x-api-key": apiKey },
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    const msg = error instanceof Error ? error.message : "erro de rede";
    throw new Error(`supadata_network: ${msg}`);
  }
  clearTimeout(timeoutId);

  const raw = await res.text();
  let body: SupadataResponse = {};
  try {
    body = JSON.parse(raw) as SupadataResponse;
  } catch {
    // leave empty
  }

  if (!res.ok) {
    const msg = body.error ?? body.message ?? raw.slice(0, 200);
    if (res.status === 401 || res.status === 403) {
      throw new Error(`supadata_forbidden: ${msg}`);
    }
    if (res.status === 404) {
      throw new Error("supadata_not_found: transcrição indisponível");
    }
    if (res.status === 429) {
      throw new Error("supadata_rate_limit");
    }
    throw new Error(`supadata_${res.status}: ${msg}`);
  }

  // Normalize both response shapes
  let segments: TranscriptSegment[] = [];
  if (Array.isArray(body.content)) {
    segments = body.content
      .map((seg) => ({
        text: typeof seg.text === "string" ? seg.text : "",
        offset: typeof seg.offset === "number" ? seg.offset : 0,
        duration: typeof seg.duration === "number" ? seg.duration : 0,
        lang: seg.lang,
      }))
      .filter((s) => normalizeText(s.text).length > 0);
  } else if (typeof body.content === "string" && body.content.trim().length > 0) {
    // Plain text mode — no timestamps
    segments = [
      {
        text: body.content,
        offset: 0,
        duration: 0,
        lang: body.lang,
      },
    ];
  }

  if (segments.length === 0) {
    throw new Error("supadata_empty: sem conteúdo na transcrição");
  }

  return {
    lang: segments[0]?.lang ?? body.lang,
    text: fitTranscript(transcriptToLines(segments)),
    segmentCount: segments.length,
    source: "supadata",
  };
}

/**
 * Try Supadata first (reliable), fall back to YouTube scraper.
 */
export async function fetchTranscriptWithFallback(youtubeId: string): Promise<VideoTranscript> {
  try {
    return await fetchSupadataTranscript(youtubeId);
  } catch (supadataError) {
    try {
      return await fetchYoutubeTranscriptText(youtubeId);
    } catch {
      throw supadataError instanceof Error
        ? supadataError
        : new Error("transcrição indisponível");
    }
  }
}
