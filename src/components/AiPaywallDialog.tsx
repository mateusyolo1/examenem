import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";
import { onAiPaywallOpen } from "@/lib/ai-paywall";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { supabase } from "@/integrations/supabase/client";

export function AiPaywallDialog() {
  const [open, setOpen] = useState(false);
  const { openCheckout, loading } = usePaddleCheckout();

  useEffect(() => onAiPaywallOpen(() => setOpen(true)), []);

  const handleSubscribe = async () => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      window.location.href = "/auth";
      return;
    }
    await openCheckout({
      priceId: "ai_access_monthly",
      customerEmail: user.email ?? undefined,
      customData: { userId: user.id },
      successUrl: `${window.location.origin}/?checkout=success`,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-2xl">
            Desbloqueie a IA por R$ 25/mês
          </DialogTitle>
          <DialogDescription className="text-center">
            Assinatura mensal para usar todos os recursos de inteligência artificial do Exame ENEM.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 space-y-2 text-sm">
          {[
            "Tutor IA ilimitado",
            "Correção de redação com nota e feedback",
            "Planos de redação gerados por IA",
            "Resumos, flashcards e quizzes automáticos",
            "Sugestões de vídeos personalizadas",
          ].map((f) => (
            <div key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{f}</span>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? "Abrindo checkout..." : "Assinar por R$ 25/mês"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="w-full"
          >
            Agora não
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
