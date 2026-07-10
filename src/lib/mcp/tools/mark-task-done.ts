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
  status: string;
  topicSlug?: string;
};

export default defineTool({
  name: "mark_task_done",
  title: "Mark a study task done",
  description:
    "Marks a study task (or all tasks matching a topic slug on a date) as completed in the student's plan. Provide either taskId or topicSlug.",
  inputSchema: {
    taskId: z.string().optional().describe("Exact task id from get_today_agenda."),
    topicSlug: z.string().optional().describe("Topic slug to match instead."),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Restrict topicSlug matches to this date."),
    toggle: z
      .boolean()
      .optional()
      .describe("If true, toggle completion instead of forcing done."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ taskId, topicSlug, date, toggle }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return {
        content: [{ type: "text", text: "Not authenticated" }],
        isError: true,
      };
    }
    if (!taskId && !topicSlug) {
      return {
        content: [{ type: "text", text: "Provide taskId or topicSlug." }],
        isError: true,
      };
    }
    const supabase = supabaseForUser(ctx);
    const { data: row, error } = await supabase
      .from("user_study_plan")
      .select("cronograma")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    if (!row?.cronograma) {
      return {
        content: [{ type: "text", text: "No study plan to update." }],
        isError: true,
      };
    }
    const plan = row.cronograma as { tasks: Task[] };
    let updated = 0;
    const nextTasks = plan.tasks.map((t) => {
      const match = taskId
        ? t.id === taskId
        : t.topicSlug === topicSlug && (!date || t.date === date);
      if (!match) return t;
      const wantDone = toggle ? t.status !== "concluida" : true;
      if (t.status === (wantDone ? "concluida" : "pendente")) return t;
      updated += 1;
      return { ...t, status: wantDone ? "concluida" : "pendente" };
    });
    if (updated > 0) {
      const { error: upErr } = await supabase
        .from("user_study_plan")
        .update({
          cronograma: { ...plan, tasks: nextTasks } as never,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", ctx.getUserId());
      if (upErr) {
        return {
          content: [{ type: "text", text: upErr.message }],
          isError: true,
        };
      }
    }
    return {
      content: [
        { type: "text", text: `Updated ${updated} task(s).` },
      ],
      structuredContent: { updated },
    };
  },
});
