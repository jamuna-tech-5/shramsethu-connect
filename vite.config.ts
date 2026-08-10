// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
// import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// Outside Lovable the deploy plugin defaults to the Cloudflare preset. On Vercel
// that produces a Worker bundle Vercel cannot run, so every server function
// (admin dashboard, OCR, nearby places) 404s in production. Detect Vercel's
// build env and pin the matching Nitro preset instead.
// VERCEL is set by Vercel's own builder, but some CI/GitHub-driven builds only
// expose VERCEL_ENV / NOW_BUILDER. Miss it and Nitro falls back to the
// Cloudflare preset, whose env injection never populates process.env on
// Vercel — every server function (OCR/Gemini included) then behaves as if
// GEMINI_API_KEY were missing.
const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_BUILDER);

export default defineConfig({
  // Note: Vercel's default function timeout (10s on Hobby) can abort the
  // OCR + forensic AI audit; raise the function max duration in Vercel
  // project settings if verification stalls on "Needs Review".
  ...(isVercel ? { nitro: { preset: "vercel" } } : {}),
  plugins: [],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
