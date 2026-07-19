import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Camera, FileUp, Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
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

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

const CATS: WorkCategory[] = [
  "Delivery Partner",
  "Driver",
  "Construction Worker",
  "Freelancer",
  "Daily Wage Worker",
  "Other",
];

function Onboarding() {
  const { profile, update, isAuthed, loading } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    category: "" as WorkCategory | "",
    skills: "",
    experience: "",
    location: "",
    workType: "",
    languages: "",
    emergencyName: "",
    emergencyPhone: "",
    photoDataUrl: "",
    idDocName: "",
  });

  useEffect(() => {
    if (!loading && !isAuthed) navigate({ to: "/auth", search: { mode: "signup" } });
  }, [isAuthed, loading, navigate]);

  const readFile = (file: File, cb: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => cb(String(reader.result));
    reader.readAsDataURL(file);
  };

  const finish = async () => {
    await update({
      category: (form.category || undefined) as WorkCategory | undefined,
      skills: form.skills,
      experience: form.experience,
      location: form.location,
      workType: form.workType,
      languages: form.languages,
      emergencyName: form.emergencyName,
      emergencyPhone: form.emergencyPhone,
      photoDataUrl: form.photoDataUrl || undefined,
      idDocName: form.idDocName || undefined,
      onboarded: true,
    });
    toast.success("Welcome to ShramSethu. Start building your digital work identity.");
    navigate({ to: "/app" });
  };

  const steps = [
    { title: "Language", body: "Pick a language you're most comfortable with." },
    { title: "Work Profile", body: "Tell us about the work you do." },
    { title: "Safety & ID", body: "Emergency contact and identity document." },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-background/70 backdrop-blur">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 sm:px-6">
          <Logo size={32} withWordmark />
          <button
            onClick={() => navigate({ to: "/app" })}
            className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Skip for now
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Setup · Step {step + 1} of {steps.length}
          </span>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{steps[step].title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{steps[step].body}</p>
          <div className="mt-4 flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i <= step ? "gradient-primary" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>

        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border bg-card p-6 shadow-soft"
        >
          {step === 0 && (
            <div>
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="h-4 w-4 text-primary" />
                <span>Choose your preferred language</span>
              </div>
              <LanguageSwitcher compact />
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Work Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as WorkCategory })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Years of Experience</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.experience}
                  onChange={(e) => setForm({ ...form, experience: e.target.value })}
                  placeholder="e.g. 3"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Skills</Label>
                <Textarea
                  value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })}
                  placeholder="e.g. Two-wheeler delivery, spoken English, basic route planning"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="City, State"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preferred Work Type</Label>
                <Select
                  value={form.workType}
                  onValueChange={(v) => setForm({ ...form, workType: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-time">Full-time</SelectItem>
                    <SelectItem value="Part-time">Part-time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                    <SelectItem value="Daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Languages Known</Label>
                <Input
                  value={form.languages}
                  onChange={(e) => setForm({ ...form, languages: e.target.value })}
                  placeholder="e.g. Hindi, English, Kannada"
                />
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Emergency Contact Name</Label>
                <Input
                  value={form.emergencyName}
                  onChange={(e) => setForm({ ...form, emergencyName: e.target.value })}
                  placeholder="Trusted contact"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Emergency Contact Number</Label>
                <Input
                  value={form.emergencyPhone}
                  onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })}
                  placeholder="+91 98xxx xxxxx"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Profile Picture</Label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-3 hover:bg-muted/60">
                  {form.photoDataUrl ? (
                    <img src={form.photoDataUrl} alt="Profile" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-full gradient-soft text-primary">
                      <Camera className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">Upload photo</div>
                    <div className="text-xs text-muted-foreground">PNG or JPG, up to 5MB</div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) readFile(f, (url) => setForm({ ...form, photoDataUrl: url }));
                    }}
                  />
                </label>
              </div>
              <div className="space-y-1.5">
                <Label>Identity Document</Label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-3 hover:bg-muted/60">
                  <div className="grid h-12 w-12 place-items-center rounded-xl gradient-soft text-primary">
                    <FileUp className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{form.idDocName || "Upload ID"}</div>
                    <div className="text-xs text-muted-foreground">Aadhaar, PAN or Driving License</div>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setForm({ ...form, idDocName: f.name });
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </motion.div>

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="rounded-full"
          >
            Back
          </Button>
          {step < steps.length - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              className="rounded-full gradient-primary text-white shadow-soft"
            >
              Continue <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={finish}
              className="rounded-full gradient-primary text-white shadow-soft"
            >
              Finish setup <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}