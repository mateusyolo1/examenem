// Utilitários puros da nota adesiva (StickyToolbar).
// Extraído de StudyHubTabs.tsx sem mudança de comportamento.

export const STICKY_COLORS = [
  "#fef08a",
  "#fca5a5",
  "#fdba74",
  "#86efac",
  "#93c5fd",
  "#c4b5fd",
  "#f9a8d4",
  "#e5e7eb",
];

export const STICKY_FONT_FAMILIES: { id: number; label: string }[] = [
  { id: 1, label: "Manuscrita" },
  { id: 2, label: "Normal" },
  { id: 3, label: "Código" },
];

export const STICKY_SIZE_PRESETS: { id: string; label: string; value: number }[] = [
  { id: "sm", label: "Pequeno", value: 16 },
  { id: "md", label: "Médio", value: 20 },
  { id: "lg", label: "Grande", value: 28 },
  { id: "xl", label: "Extra grande", value: 36 },
  { id: "xxl", label: "Enorme", value: 48 },
];

// Excalidraw text elements não têm fontWeight/textDecoration; simulamos com Unicode.
const toBoldChar = (ch: string) => {
  const c = ch.codePointAt(0)!;
  if (c >= 0x41 && c <= 0x5a) return String.fromCodePoint(0x1d400 + (c - 0x41));
  if (c >= 0x61 && c <= 0x7a) return String.fromCodePoint(0x1d41a + (c - 0x61));
  if (c >= 0x30 && c <= 0x39) return String.fromCodePoint(0x1d7ce + (c - 0x30));
  return ch;
};
const fromBoldChar = (ch: string) => {
  const c = ch.codePointAt(0)!;
  if (c >= 0x1d400 && c <= 0x1d419) return String.fromCharCode(0x41 + (c - 0x1d400));
  if (c >= 0x1d41a && c <= 0x1d433) return String.fromCharCode(0x61 + (c - 0x1d41a));
  if (c >= 0x1d7ce && c <= 0x1d7d7) return String.fromCharCode(0x30 + (c - 0x1d7ce));
  return ch;
};
export const applyBold = (s: string) => Array.from(s).map(toBoldChar).join("");
export const removeBold = (s: string) => Array.from(s).map(fromBoldChar).join("");
export const applyStrike = (s: string) =>
  Array.from(s.replace(/\u0336/g, ""))
    .map((ch) => ch + "\u0336")
    .join("");
export const removeStrike = (s: string) => s.replace(/\u0336/g, "");
