import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getTodayAgenda from "./tools/get-today-agenda";
import getStudyPlan from "./tools/get-study-plan";
import markTaskDone from "./tools/mark-task-done";

const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "exame-enem-mcp",
  title: "Exame ENEM",
  version: "0.1.0",
  instructions:
    "Tools to read and manage a student's ENEM study plan on Exame ENEM. Use get_today_agenda for daily tasks, get_study_plan for the full plan, and mark_task_done to close a task.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getTodayAgenda, getStudyPlan, markTaskDone],
});
