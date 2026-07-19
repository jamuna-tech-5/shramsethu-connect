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
  useEffect(() => {
    if (!loading && !isAuthed) navigate({ to: "/auth" });
  }, [isAuthed, loading, navigate]);
  if (loading) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isAuthed) return null;
  return <AppShell />;
}