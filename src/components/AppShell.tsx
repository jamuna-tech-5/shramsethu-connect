import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  BadgeCheck,
  Bell,
  BarChart3,
  Battery,
  FileCheck2,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MapPin,
  Menu,
  Settings,
  Sparkles,
  User,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};
const nav: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/profile", label: "Worker Profile", icon: User },
  { to: "/app/gigscore", label: "GigScore", icon: Sparkles },
  { to: "/app/income", label: "Income Analytics", icon: BarChart3 },
  { to: "/app/schemes", label: "Government Schemes", icon: Landmark },
  { to: "/app/loan", label: "Loan Eligibility", icon: Wallet },
  { to: "/app/charging", label: "EV Charging", icon: Battery },
  { to: "/app/location", label: "Live Location", icon: MapPin },
  { to: "/app/documents", label: "Documents", icon: FileCheck2 },
  { to: "/app/sos", label: "Emergency SOS", icon: LifeBuoy },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const { profile, signOut } = useStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const handleSignOut = () => {
    signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Link to="/app" className="flex items-center gap-2">
            <Logo size={30} withWordmark />
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {nav.map((item) => {
              const active = item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                      active
                        ? "gradient-primary text-white shadow-soft"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full gradient-primary text-sm font-semibold text-white">
              {profile?.fullName?.[0]?.toUpperCase() ?? "S"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{profile?.fullName ?? "Worker"}</div>
              <div className="truncate text-xs text-muted-foreground">{profile?.email}</div>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-background hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar shadow-elevated">
            <div className="flex h-16 items-center justify-between border-b px-5">
              <Logo size={28} withWordmark />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-2 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              {nav.map((item) => {
                const active = item.exact
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                      active
                        ? "gradient-primary text-white"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="rounded-lg p-2 hover:bg-muted lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="truncate text-xs text-muted-foreground">Welcome back</div>
              <div className="truncate text-sm font-semibold text-foreground">
                {profile?.fullName ?? "Worker"}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-full" asChild>
              <Link to="/app/sos" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Status
              </Link>
            </Button>
            <button
              className="relative rounded-full border p-2 text-muted-foreground hover:bg-muted"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </button>
            <BadgeCheck className="hidden h-5 w-5 text-primary sm:block" />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}