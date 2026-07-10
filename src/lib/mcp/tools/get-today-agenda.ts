import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Task = {
  id: string;
  date: string;
  title: string;
  area: string;
  type: string;
  minutes: number;
  status: string;
  topicSlug?: string;
  topicArea?: string;
  note?: string;
};

export default defineTool({
  name: "get_today_agenda",
  title: "Get today's study agenda",
  description:
    "Returns today's ENEM study tasks (videos, questions, flashcards, essays, mock exams) from the signed-in student's plan, grouped by type.",
  inputSchema: {
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("ISO date (YYYY-MM-DD). Defaults to today."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return {
        content: [{ type: "text", text: "Not authenticated" }],
        isError: true,
      };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("user_study_plan")
      .select("cronograma")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const plan = (data?.cronograma ?? null) as { tasks?: Task[] } | null;
    if (!plan) {
      return {
        content: [
          {
            type: "text",
            text: "No study plan generated yet. Ask the student to create one in the app first.",
          },
        ],
        structuredContent: { hasPlan: false },
      };
    }
    const target = date ?? todayISO();
    const todays = (plan.tasks ?? []).filter((t) => t.date === target);
    const byType: Record<string, Task[]> = {};
    for (const t of todays) (byType[t.type] ??= []).push(t);

    const summary = todays.length
      ? todays
          .map(
            (t) =>
              `• [${t.status}] ${t.type} — ${t.title} (${t.minutes}min, ${t.area})`,
          )
          .join("\n")
      : `No tasks scheduled for ${target}.`;

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: {
        hasPlan: true,
        date: target,
        totalTasks: todays.length,
        tasks: todays,
        byType,
      },
    };
  },
});
