const EVENT = "ai-paywall:open";

export function isPaymentRequiredError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.includes("PAYMENT_REQUIRED");
}

export function openAiPaywall() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Returns true if the error was a payment-required error and the paywall was opened. */
export function handleAiError(err: unknown): boolean {
  if (isPaymentRequiredError(err)) {
    openAiPaywall();
    return true;
  }
  return false;
}

export function onAiPaywallOpen(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
