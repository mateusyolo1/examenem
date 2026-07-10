import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSeenHints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_hints_seen")
      .select("hint_key");
    if (error) throw error;
    return (data ?? []).map((r) => r.hint_key as string);
  });

export const markHintSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string }) => {
    if (!input || typeof input.key !== "string" || input.key.length === 0) {
      throw new Error("Invalid hint key");
    }
    if (input.key.length > 128) throw new Error("Hint key too long");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_hints_seen")
      .upsert(
        { user_id: context.userId, hint_key: data.key },
        { onConflict: "user_id,hint_key" },
      );
    if (error) throw error;
    return { ok: true };
  });
