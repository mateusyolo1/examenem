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

type Task = {
  id: string;
  date: string;
  title: string;
  area: string;
  type: string;
  minutes: number;
  status: string;
};

export default defineTool({
  name: "get_study_plan",
  title: "Get the full study plan",
  description:
    "Returns the student's complete ENEM study plan: all scheduled tasks, config, and progress counts. Optionally filter to a date range.",
  inputSchema: {
    fromDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Inclusive lower bound (YYYY-MM-DD)."),
    toDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Inclusive upper bound (YYYY-MM-DD)."),
    limit: z.number().int().min(1).max(500).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ fromDate, toDate, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return {
        content: [{ type: "text", text: "Not authenticated" }],
        isError: true,
      };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("user_study_plan")
      .select("cronograma, config, updated_at")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    if (!data?.cronograma) {
      return {
        content: [{ type: "text", text: "No study plan generated yet." }],
        structuredContent: { hasPlan: false },
      };
    }
    const plan = data.cronograma as { tasks?: Task[]; config?: unknown };
    let tasks = plan.tasks ?? [];
    if (fromDate) tasks = tasks.filter((t) => t.date >= fromDate);
    if (toDate) tasks = tasks.filter((t) => t.date <= toDate);
    if (limit) tasks = tasks.slice(0, limit);

    const done = tasks.filter((t) => t.status === "concluida").length;
    const summary = `Study plan (updated ${data.updated_at ?? "?"}): ${tasks.length} tasks, ${done} completed.`;

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: {
        hasPlan: true,
        updatedAt: data.updated_at,
        config: data.config,
        totalTasks: tasks.length,
        completed: done,
        tasks,
      },
    };
  },
});
