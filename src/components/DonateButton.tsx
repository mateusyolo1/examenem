import { useEffect, useState } from "react";
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
  { priceId: "donation_5", label: "R$ 5", value: 5 },
  { priceId: "donation_10", label: "R$ 10", value: 10 },
  { priceId: "donation_25", label: "R$ 25", value: 25 },
  { priceId: "donation_50", label: "R$ 50", value: 50 },
];

const STORAGE_KEY = "donation:last";
const PENDING_KEY = "donation:pending";
const DAY_MS = 24 * 60 * 60 * 1000;

type LastDonation = { amount: number; at: number };

function readLast(): LastDonation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LastDonation;
  } catch {
    return null;
  }
}

export function DonateButton() {
  const [open, setOpen] = useState(false);
  const [thanksOpen, setThanksOpen] = useState(false);
  const [last, setLast] = useState<LastDonation | null>(null);
  const { openCheckout, loading } = usePaddleCheckout();

  // Hydrate + handle ?donation=success return
  useEffect(() => {
    setLast(readLast());
    const url = new URL(window.location.href);
    if (url.searchParams.get("donation") === "success") {
      const pendingRaw = localStorage.getItem(PENDING_KEY);
      const amount = pendingRaw ? Number(pendingRaw) || 0 : 0;
      const entry: LastDonation = { amount, at: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
      localStorage.removeItem(PENDING_KEY);
      setLast(entry);
      setThanksOpen(true);
      url.searchParams.delete("donation");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  }, []);

  const handleDonate = async (priceId: string, value: number) => {
    localStorage.setItem(PENDING_KEY, String(value));
    await openCheckout({
      priceId,
      successUrl: `${window.location.origin}/?donation=success`,
    });
    setOpen(false);
  };

  const daysSince = last ? Math.floor((Date.now() - last.at) / DAY_MS) : null;
  const withinThanks = daysSince !== null && daysSince < 15;
  const dimmed = daysSince !== null && daysSince >= 15 && daysSince < 31;

  const thanksMessage =
    last && last.amount >= 50
      ? "Muito obrigado pela sua doação incrível! Você é essencial para o Exame ENEM. 💜"
      : last && last.amount >= 25
      ? "Muito obrigado! Sua contribuição faz toda a diferença. 💙"
      : last && last.amount >= 10
      ? "Obrigado pelo seu apoio! Isso ajuda a manter a plataforma. 💚"
      : "Obrigado pela sua doação! Cada contribuição conta. 🧡";

  return (
    <>
      <button
        type="button"
        onClick={() => (withinThanks ? setThanksOpen(true) : setOpen(true))}
        style={{ opacity: dimmed ? 0.2 : 1 }}
        className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-opacity duration-300 hover:text-foreground"
      >
        <Heart className="h-3 w-3 animate-pulse fill-current text-rose-500" />
        {withinThanks ? "Obrigado!" : "Donate"}
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
                onClick={() => handleDonate(a.priceId, a.value)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={thanksOpen} onOpenChange={setThanksOpen}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <Heart className="h-5 w-5 fill-current text-rose-500 animate-pulse" />
              Muito obrigado!
            </DialogTitle>
            <DialogDescription className="pt-2 text-base">
              {thanksMessage}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
