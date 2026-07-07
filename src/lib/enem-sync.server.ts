import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const ENEM_API_BASE = "https://api.enem.dev/v1";

const DISCIPLINE_TO_AREA: Record<string, string> = {
  linguagens: "linguagens",
  "ciencias-humanas": "humanas",
  "ciencias-natureza": "natureza",
  matematica: "matematica",
};

export function areaFromDiscipline(discipline: string | null): string {
  if (!discipline) return "linguagens";
  return DISCIPLINE_TO_AREA[discipline] ?? discipline;
}

interface EnemApiAlternative {
  letter: string;
  text: string | null;
  file: string | null;
  isCorrect: boolean;
}

interface EnemApiQuestion {
  index: number;
  discipline: string | null;
  language: string | null;
  year: number;
  context: string | null;
  files: string[] | null;
  correctAlternative: string;
  alternativesIntroduction: string | null;
  alternatives: EnemApiAlternative[];
}

interface EnemApiQuestionsResponse {
  metadata: { limit: number; offset: number; total: number; hasMore: boolean };
  questions: EnemApiQuestion[];
}

/**
 * Fetches questions for a given ENEM year+day from api.enem.dev and
 * upserts them into public.enem_questions using the admin client.
 * Idempotent: if 45+ questions already exist locally, skips network calls.
 */
export async function syncQuestionsFor(
  userSupabase: SupabaseClient<Database>,
  adminSupabase: SupabaseClient<Database>,
  year: number,
  day: 1 | 2,
): Promise<{ imported: number; cached: boolean }> {
  // Ensure exam exists locally
  const { data: exam, error: examErr } = await userSupabase
    .from("enem_exams")
    .select("id")
    .eq("year", year)
    .eq("day", day)
    .maybeSingle();
  if (examErr) throw new Error(examErr.message);
  if (!exam) throw new Error(`Prova ${year}/dia ${day} não sincronizada`);

  const { count } = await userSupabase
    .from("enem_questions")
    .select("id", { count: "exact", head: true })
    .eq("year", year)
    .eq("day", day);
  if (count && count >= 45) return { imported: 0, cached: true };

  const offsets = [0, 50, 100, 150];
  const collected: EnemApiQuestion[] = [];
  for (const offset of offsets) {
    const url = `${ENEM_API_BASE}/exams/${year}/questions?limit=50&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const payload = (await res.json()) as EnemApiQuestionsResponse;
    collected.push(...payload.questions);
    if (!payload.metadata.hasMore) break;
  }

  const day1Disciplines = new Set(["linguagens", "ciencias-humanas"]);
  const day2Disciplines = new Set(["ciencias-natureza", "matematica"]);
  const wanted = day === 1 ? day1Disciplines : day2Disciplines;

  const filtered = collected.filter(
    (q) => q.discipline && wanted.has(q.discipline),
  );

  const rows = filtered.map((q) => ({
    exam_id: exam.id,
    year: q.year,
    day,
    question_index: q.index,
    discipline: q.discipline ?? "outros",
    area: areaFromDiscipline(q.discipline),
    language: q.language,
    context: q.context,
    files: (q.files ?? []) as unknown as never,
    alternative_introduction: q.alternativesIntroduction,
    alternatives: q.alternatives.map((a) => ({
      letter: a.letter,
      text: a.text,
      file: a.file,
    })) as unknown as never,
    correct_alternative: q.correctAlternative,
  }));

  if (rows.length === 0) return { imported: 0, cached: false };

  const { error } = await adminSupabase
    .from("enem_questions")
    .upsert(rows, { onConflict: "year,day,question_index,language" });
  if (error) throw new Error(error.message);

  return { imported: rows.length, cached: false };
}
