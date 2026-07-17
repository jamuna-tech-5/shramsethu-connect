import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { isAuthed } = useStore();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isAuthed) navigate({ to: "/auth" });
  }, [isAuthed, navigate]);
  return <AppShell />;
}