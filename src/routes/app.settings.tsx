import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Globe2, LogOut, Moon, Shield, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PageHeader } from "@/components/PageHeader";
import { AppSecuritySection } from "@/components/AppSecuritySection";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, update, signOut, reset } = useStore();
  const navigate = useNavigate();
  const prefs = profile?.preferences ?? { notifications: true, darkMode: false, locationSharing: true };

  const setPref = (k: keyof typeof prefs, v: boolean) => {
    update({ preferences: { ...prefs, [k]: v } });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Manage language, notifications and account preferences."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SettingCard icon={Globe2} title="Language" description="Choose your preferred language for the interface.">
          <div className="mt-4"><LanguageSwitcher /></div>
        </SettingCard>

        <SettingCard icon={Bell} title="Notifications" description="Receive alerts about work opportunities, verification and safety.">
          <Row label="Push notifications" checked={prefs.notifications} onChange={(v) => setPref("notifications", v)} />
        </SettingCard>

        <SettingCard icon={Moon} title="Appearance" description="Dark mode support is on the roadmap.">
          <Row label="Dark mode" checked={prefs.darkMode} onChange={(v) => setPref("darkMode", v)} disabled />
        </SettingCard>

        <SettingCard icon={Shield} title="Privacy" description="Share location only while on duty.">
          <Row label="Location sharing" checked={prefs.locationSharing} onChange={(v) => setPref("locationSharing", v)} />
        </SettingCard>

        <AppSecuritySection phone={profile?.phone} fullName={profile?.fullName} />

        <SettingCard icon={UserCog} title="Account" description="Manage your ShramSethu account.">
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => { signOut(); navigate({ to: "/" }); }}>
              <LogOut className="mr-1.5 h-4 w-4" /> Sign out
            </Button>
            <Button
              variant="outline"
              className="rounded-full text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("Delete all local data? This cannot be undone.")) {
                  reset();
                  toast.success("Data deleted.");
                  navigate({ to: "/" });
                }
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete data
            </Button>
          </div>
        </SettingCard>
      </div>
    </div>
  );
}

function SettingCard({ icon: Icon, title, description, children }: { icon: typeof Bell; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-soft text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Row({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="mt-4 flex items-center justify-between rounded-xl border p-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}