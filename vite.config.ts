// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Outside Lovable the deploy plugin defaults to the Cloudflare preset. On Vercel
// that produces a Worker bundle Vercel cannot run, so every server function
// (admin dashboard, OCR, nearby places) 404s in production. Detect Vercel's
// build env and pin the matching Nitro preset instead.
const isVercel = !!process.env.VERCEL;

export default defineConfig({
  // Note: Vercel's default function timeout (10s on Hobby) can abort the
  // OCR + forensic AI audit; raise the function max duration in Vercel
  // project settings if verification stalls on "Needs Review".
  ...(isVercel ? { nitro: { preset: "vercel" } } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
