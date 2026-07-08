// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          // Excalidraw touches `window` at module top level. If Rollup lets it become
          // the vendor chunk for shared modules (react-dom, jsx-runtime, globalthis, ...)
          // every other lib ends up importing from it, executing Excalidraw at Worker
          // startup and crashing SSR with "window is not defined".
          // Force Excalidraw + mermaid into their own leaf chunks so nothing else pulls
          // them in — they are only fetched when the client-side lazy() factory runs.
          manualChunks(id) {
            if (id.includes("@excalidraw/excalidraw")) return "excalidraw";
            if (id.includes("@excalidraw/mermaid-to-excalidraw")) return "excalidraw-mermaid";
            if (id.includes("node_modules/mermaid/")) return "mermaid";
            return undefined;
          },
        },
      },
    },
  },
});
