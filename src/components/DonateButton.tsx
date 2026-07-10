import { useState } from "react";
import { Heart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";

const AMOUNTS = [
  { priceId: "donation_5", label: "R$ 5" },
  { priceId: "donation_10", label: "R$ 10" },
  { priceId: "donation_25", label: "R$ 25" },
  { priceId: "donation_50", label: "R$ 50" },
];

export function DonateButton() {
  const [open, setOpen] = useState(false);
  const { openCheckout, loading } = usePaddleCheckout();

  const handleDonate = async (priceId: string) => {
    await openCheckout({
      priceId,
      successUrl: `${window.location.origin}/?donation=success`,
    });
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
      >
        <Heart className="h-3 w-3" />
        Donate
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Apoie o Exame ENEM</DialogTitle>
            <DialogDescription>
              Sua contribuição ajuda a manter e melhorar a plataforma. Escolha um valor:
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-2">
            {AMOUNTS.map((a) => (
              <Button
                key={a.priceId}
                variant="outline"
                disabled={loading}
                onClick={() => handleDonate(a.priceId)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
