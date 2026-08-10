import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  
  
  const { isAuthed, loading } = useStore();
  const navigate = useNavigate();

  const demoMode =
    typeof window !== "undefined" &&
    sessionStorage.getItem("shramsethu_demo") === "true";

  useEffect(() => {
    if (loading) return;

    // Allow demo users to enter the dashboard without registration
    if (!isAuthed && !demoMode) {
      navigate({ to: "/auth" });
    }
  }, [isAuthed, loading, navigate, demoMode]);

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!isAuthed && !demoMode) {
    return null;
  }

  return <AppShell />;
}
//   const { isAuthed, loading } = useStore();
//   const navigate = useNavigate();
//   useEffect(() => {
//     if (!loading && !isAuthed) navigate({ to: "/auth" });
//   }, [isAuthed, loading, navigate]);
//   if (loading) {
//     return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Loading…</div>;
//   }
//   if (!isAuthed) return null;
//   return <AppShell />;
// }
