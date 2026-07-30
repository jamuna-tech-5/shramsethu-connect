import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Server functions carry per-user data. Behind a CDN (Vercel) a cacheable
// GET response can be served to the wrong user, which showed up as
// "dashboard data is inconsistent after deployment". Force no-store.
const noStoreMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { setResponseHeader } = await import("@tanstack/react-start/server");
  setResponseHeader("cache-control", "no-store, no-cache, must-revalidate, private");
  return await next();
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth, noStoreMiddleware],
  requestMiddleware: [errorMiddleware],
}));
