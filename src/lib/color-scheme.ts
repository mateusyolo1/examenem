import { useEffect, useState } from "react";

export type ColorScheme =
  | "default"
  | "azul"
  | "vermelho"
  | "verde"
  | "preto"
  | "cinza"
  | "clinica"
  | "newspaper"
  | "terroso"
  | "vegetal";

export const COLOR_SCHEMES: {
  id: ColorScheme;
  label: string;
  description: string;
  swatch: string[];
}[] = [
  { id: "default", label: "Padrão", description: "Índigo, o tema original.", swatch: ["#f5f3ee", "#4f46e5", "#e0e7ff", "#111827"] },
  { id: "azul", label: "Azul", description: "Confiável e sereno.", swatch: ["#f0f7ff", "#2563eb", "#bfdbfe", "#0f172a"] },
  { id: "vermelho", label: "Vermelho", description: "Foco e intensidade.", swatch: ["#fff5f5", "#dc2626", "#fecaca", "#450a0a"] },
  { id: "verde", label: "Verde", description: "Fresco e estimulante.", swatch: ["#f2fbf5", "#16a34a", "#bbf7d0", "#052e16"] },
  { id: "preto", label: "Preto", description: "Alto contraste minimalista.", swatch: ["#ffffff", "#111111", "#e5e5e5", "#000000"] },
  { id: "cinza", label: "Cinza", description: "Neutro e sofisticado.", swatch: ["#f5f5f5", "#475569", "#cbd5e1", "#0f172a"] },
  { id: "clinica", label: "Clínica", description: "Turquesa hospitalar, muito branco.", swatch: ["#f5fbfd", "#0ea5b7", "#cffafe", "#083344"] },
  { id: "newspaper", label: "Jornal", description: "Papel creme, tinta preta.", swatch: ["#f6efe0", "#111111", "#e8ddc4", "#1a1a1a"] },
  { id: "terroso", label: "Terroso", description: "Ocre, argila e areia.", swatch: ["#f8f0e6", "#a3672a", "#ecd9bf", "#3f2a17"] },
  { id: "vegetal", label: "Vegetal", description: "Sálvia, oliva, folhagem.", swatch: ["#f3f5ec", "#4d7c0f", "#d9e5c4", "#1a2e05"] },
];

const KEY = "exame:scheme";

export function getStoredScheme(): ColorScheme {
  if (typeof window === "undefined") return "default";
  const v = localStorage.getItem(KEY) as ColorScheme | null;
  return v && COLOR_SCHEMES.some((s) => s.id === v) ? v : "default";
}

export function applyColorScheme(scheme: ColorScheme) {
  if (typeof document === "undefined") return;
  if (scheme === "default") document.documentElement.removeAttribute("data-scheme");
  else document.documentElement.setAttribute("data-scheme", scheme);
}

export function useColorScheme() {
  const [scheme, setScheme] = useState<ColorScheme>("default");
  useEffect(() => {
    const s = getStoredScheme();
    setScheme(s);
    applyColorScheme(s);
  }, []);
  const change = (next: ColorScheme) => {
    localStorage.setItem(KEY, next);
    applyColorScheme(next);
    setScheme(next);
  };
  return { scheme, change };
}

/**
 * CSS injected once in <head>. Only overrides tokens that change per scheme,
 * keeping the site's overall identity (typography, spacing, radius).
 */
export const COLOR_SCHEME_CSS = `
/* Azul */
:root[data-scheme="azul"] { --primary: #2563eb; --primary-foreground: #ffffff; --ring: rgba(37,99,235,0.5); --accent: #dbeafe; --accent-foreground: #1e3a8a; }
:root[data-scheme="azul"].dark { --primary: #60a5fa; --primary-foreground: #0b1220; --ring: rgba(96,165,250,0.55); --accent: #1e293b; --accent-foreground: #dbeafe; }

/* Vermelho */
:root[data-scheme="vermelho"] { --primary: #dc2626; --primary-foreground: #ffffff; --ring: rgba(220,38,38,0.5); --accent: #fee2e2; --accent-foreground: #7f1d1d; }
:root[data-scheme="vermelho"].dark { --primary: #f87171; --primary-foreground: #1a0606; --ring: rgba(248,113,113,0.55); --accent: #2a1010; --accent-foreground: #fecaca; }

/* Verde */
:root[data-scheme="verde"] { --primary: #16a34a; --primary-foreground: #ffffff; --ring: rgba(22,163,74,0.5); --accent: #dcfce7; --accent-foreground: #14532d; }
:root[data-scheme="verde"].dark { --primary: #4ade80; --primary-foreground: #05130a; --ring: rgba(74,222,128,0.55); --accent: #0f2a17; --accent-foreground: #bbf7d0; }

/* Preto */
:root[data-scheme="preto"] { --primary: #111111; --primary-foreground: #ffffff; --ring: rgba(0,0,0,0.5); --accent: #f3f4f6; --accent-foreground: #111111; }
:root[data-scheme="preto"].dark { --primary: #f5f5f5; --primary-foreground: #0a0a0a; --ring: rgba(245,245,245,0.55); --accent: #1f1f1f; --accent-foreground: #f5f5f5; }

/* Cinza */
:root[data-scheme="cinza"] { --primary: #475569; --primary-foreground: #ffffff; --ring: rgba(71,85,105,0.5); --accent: #e2e8f0; --accent-foreground: #0f172a; }
:root[data-scheme="cinza"].dark { --primary: #94a3b8; --primary-foreground: #0b1220; --ring: rgba(148,163,184,0.55); --accent: #1e293b; --accent-foreground: #e2e8f0; }

/* Clínica */
:root[data-scheme="clinica"] {
  --background: #f5fbfd; --card: #ffffff; --popover: #ffffff;
  --primary: #0ea5b7; --primary-foreground: #ffffff; --ring: rgba(14,165,183,0.5);
  --accent: #cffafe; --accent-foreground: #083344; --muted: #ecf7fa; --muted-foreground: #4b6b74;
  --border: rgba(15,50,60,0.10); --input: rgba(15,50,60,0.14);
}
:root[data-scheme="clinica"].dark {
  --background: #06181c; --card: #0b2028; --popover: #0b2028;
  --primary: #22d3ee; --primary-foreground: #052027; --ring: rgba(34,211,238,0.55);
  --accent: #0f2a32; --accent-foreground: #cffafe; --muted: #0f2a32; --muted-foreground: #9ec4cd;
}

/* Newspaper (papel) */
:root[data-scheme="newspaper"] {
  --background: #f6efe0; --card: #fdfaf3; --popover: #fdfaf3;
  --foreground: #1a1a1a; --card-foreground: #1a1a1a; --popover-foreground: #1a1a1a;
  --primary: #111111; --primary-foreground: #f6efe0; --ring: rgba(17,17,17,0.55);
  --accent: #e8ddc4; --accent-foreground: #1a1a1a; --muted: #efe7d3; --muted-foreground: #4b463b;
  --border: rgba(26,26,26,0.14); --input: rgba(26,26,26,0.18);
}
:root[data-scheme="newspaper"].dark {
  --background: #14110a; --card: #1c1811; --popover: #1c1811;
  --primary: #f6efe0; --primary-foreground: #14110a; --ring: rgba(246,239,224,0.55);
  --accent: #2a2418; --accent-foreground: #f6efe0; --muted: #241f16; --muted-foreground: #c9bfa6;
}

/* Terroso */
:root[data-scheme="terroso"] {
  --background: #f8f0e6; --card: #fdf6ec; --popover: #fdf6ec;
  --primary: #a3672a; --primary-foreground: #ffffff; --ring: rgba(163,103,42,0.5);
  --accent: #ecd9bf; --accent-foreground: #3f2a17; --muted: #f0e2cd; --muted-foreground: #6b5236;
  --border: rgba(63,42,23,0.14); --input: rgba(63,42,23,0.18);
}
:root[data-scheme="terroso"].dark {
  --background: #1a120a; --card: #22180e; --popover: #22180e;
  --primary: #d29a63; --primary-foreground: #1a0f05; --ring: rgba(210,154,99,0.55);
  --accent: #2e2114; --accent-foreground: #f2ddc0; --muted: #261a10; --muted-foreground: #c6a988;
}

/* Vegetal */
:root[data-scheme="vegetal"] {
  --background: #f3f5ec; --card: #f9faf3; --popover: #f9faf3;
  --primary: #4d7c0f; --primary-foreground: #ffffff; --ring: rgba(77,124,15,0.5);
  --accent: #d9e5c4; --accent-foreground: #1a2e05; --muted: #e5ebd5; --muted-foreground: #4b5b34;
  --border: rgba(26,46,5,0.14); --input: rgba(26,46,5,0.18);
}
:root[data-scheme="vegetal"].dark {
  --background: #0f1608; --card: #172010; --popover: #172010;
  --primary: #a3e635; --primary-foreground: #0a1204; --ring: rgba(163,230,53,0.55);
  --accent: #1e2a12; --accent-foreground: #e4f0c9; --muted: #1a2410; --muted-foreground: #b7c99a;
}
`;
