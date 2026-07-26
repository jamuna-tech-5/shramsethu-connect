import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useStore, type WorkCategory } from "@/lib/store";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

const CATS: WorkCategory[] = [
  "Delivery Partner",
  "Driver",
  "Construction Worker",
  "Freelancer",
  "Daily Wage Worker",
  "Other",
];

function ProfilePage() {
  const { profile, update } = useStore();
  const [form, setForm] = useState({
    fullName: profile?.fullName ?? "",
    phone: profile?.phone ?? "",
    category: profile?.category ?? ("" as WorkCategory | ""),
    skills: profile?.skills ?? "",
    experience: profile?.experience ?? "",
    location: profile?.location ?? "",
    workType: profile?.workType ?? "",
    languages: profile?.languages ?? "",
    emergencyName: profile?.emergencyName ?? "",
    emergencyPhone: profile?.emergencyPhone ?? "",
  });

  const save = () => {
    update({
      ...form,
      category: (form.category || undefined) as WorkCategory | undefined,
    });
    toast.success("Profile updated");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Digital Worker Profile"
        title="Your work identity"
        description="Keep your details up to date to unlock schemes, credit and better opportunities."
        actions={
          <Button onClick={save} className="rounded-full gradient-primary text-white shadow-soft">
            <Save className="mr-1.5 h-4 w-4" /> Save changes
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Card */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              {profile?.photoDataUrl ? (
                <img src={profile.photoDataUrl} alt="Profile" className="h-24 w-24 rounded-full object-cover" />
              ) : (
                <div className="grid h-24 w-24 place-items-center rounded-full gradient-primary text-2xl font-bold text-white">
                  {profile?.fullName?.[0]?.toUpperCase() ?? "S"}
                </div>
              )}
              <BadgeCheck className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-white p-0.5 text-primary" />
            </div>
            <div className="mt-3 text-base font-semibold">{profile?.fullName}</div>
            <div className="text-xs text-muted-foreground">{profile?.email}</div>
            {profile?.category && (
              <span className="mt-3 rounded-full gradient-soft px-3 py-1 text-xs font-medium text-primary">
                {profile.category}
              </span>
            )}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border p-3">
              <dt className="text-muted-foreground">Experience</dt>
              <dd className="mt-0.5 font-semibold text-foreground">{profile?.experience ? `${profile.experience} yrs` : "—"}</dd>
            </div>
            <div className="rounded-xl border p-3">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="mt-0.5 font-semibold text-foreground">{profile?.location || "—"}</dd>
            </div>
            <div className="col-span-2 rounded-xl border p-3">
              <dt className="text-muted-foreground">Languages</dt>
              <dd className="mt-0.5 font-semibold text-foreground">{profile?.languages || "—"}</dd>
            </div>
          </dl>
        </div>

        {/* Form */}
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold">Personal Information</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full Name">
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Location">
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Field>
              <Field label="Languages">
                <Input value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold">Work</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Work Category">
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as WorkCategory })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Years of Experience">
                <Input type="number" min={0} value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} />
              </Field>
              <Field label="Preferred Work Type">
                <Select value={form.workType} onValueChange={(v) => setForm({ ...form, workType: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-time">Full-time</SelectItem>
                    <SelectItem value="Part-time">Part-time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                    <SelectItem value="Daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Skills" full>
                <Textarea value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold">Emergency Contact</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <Input value={form.emergencyName} onChange={(e) => setForm({ ...form, emergencyName: e.target.value })} />
              </Field>
              <Field label="Number">
                <Input value={form.emergencyPhone} onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })} />
              </Field>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}