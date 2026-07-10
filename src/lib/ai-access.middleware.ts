import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWLIST = new Set<string>([
  "mateusyolo@agenciaskills.com.br",
  "mateusyolo1@gmail.com",
]);

/**
 * Middleware that requires either an allow-listed email or an active
 * paid subscription to access AI features. Throws "PAYMENT_REQUIRED"
 * (message includes the token) when access is denied.
 */
export const requireAiAccess = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const claims = context.claims as { email?: string } | undefined;
    const email = claims?.email?.toLowerCase();
    if (email && ALLOWLIST.has(email)) {
      return next();
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("status,current_period_end")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("[requireAiAccess] subscription lookup failed", error);
      throw new Error("PAYMENT_REQUIRED: unable to verify subscription");
    }

    const now = Date.now();
    const isActive = (data ?? []).some((s) => {
      const end = s.current_period_end
        ? new Date(s.current_period_end).getTime()
        : Number.POSITIVE_INFINITY;
      if (["active", "trialing", "past_due"].includes(s.status) && end > now) {
        return true;
      }
      if (s.status === "canceled" && end > now) {
        return true;
      }
      return false;
    });

    if (!isActive) {
      throw new Error(
        "PAYMENT_REQUIRED: assinatura necessária para usar recursos de IA",
      );
    }

    return next();
  });
