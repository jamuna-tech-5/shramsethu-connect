import { createServerFn } from "@tanstack/react-start";

// The browser Maps key must be available at runtime even when the host did not
// expose it at build time (Vercel only inlines VITE_* vars present during the
// build). This returns a *browser* key only — never a server/secret key.
export const getMapsBrowserKey = createServerFn({ method: "GET" }).handler(async () => {
  const { serverEnvAny } = await import("@/lib/env.server");
  const key =
    serverEnvAny(
      "VITE_GOOGLE_MAPS_API_KEY",
      "GOOGLE_MAPS_BROWSER_KEY_PUBLIC",
      "GOOGLE_MAPS_BROWSER_KEY",
    ) ?? "";
  return { key: key || null };
});
