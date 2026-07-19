import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Phone, User as UserIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});

function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const { signUp, signIn, signInWithGoogle, isAuthed, profile } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthed) {
      if (profile && !profile.onboarded) navigate({ to: "/onboarding" });
      else navigate({ to: "/app" });
    }
  }, [isAuthed, profile, navigate]);

  const strength = useMemo(() => passwordStrength(form.password), [form.password]);
  const strengthLabel = ["Too weak", "Weak", "Okay", "Strong", "Excellent"][strength];
  const strengthColor = ["bg-destructive", "bg-destructive", "bg-warning", "bg-primary", "bg-success"][strength];

  const validate = () => {
    const e: Record<string, string> = {};
    if (mode === "signup") {
      if (!form.fullName.trim()) e.fullName = "Full name is required";
      if (!/^\+?\d[\d\s-]{7,}$/.test(form.phone)) e.phone = "Enter a valid phone number";
      if (form.password !== form.confirm) e.confirm = "Passwords do not match";
      if (form.password.length < 8) e.password = "At least 8 characters";
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter a valid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    if (mode === "signup") {
      const res = await signUp({ fullName: form.fullName, email: form.email, phone: form.phone, password: form.password });
      setSubmitting(false);
      if (!res.ok) {
        toast.error(res.error ?? "Sign up failed");
        return;
      }
      toast.success("Account created. Check your email if confirmation is required.");
      // Onboarding redirect handled by useEffect when session hydrates
    } else {
      const ok = await signIn(form.email, form.password);
      setSubmitting(false);
      if (!ok) {
        toast.error("Invalid email or password.");
        return;
      }
      toast.success("Signed in");
    }
  };

  const google = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Google sign-in failed");
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_80%_60%,rgba(255,255,255,0.25),transparent_45%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link to="/" className="inline-flex">
            <Logo size={40} withWordmark className="[&_.text-foreground]:text-white [&_.text-muted-foreground]:text-white/70 [&_.text-gradient]:!text-white [&_.text-gradient]:[background-image:none]" />
          </Link>
          <div>
            <h2 className="text-3xl font-bold leading-tight">Your work. Your identity. Your future.</h2>
            <p className="mt-3 max-w-md text-white/85">
              Build a portable digital work profile that unlocks credit, benefits and
              opportunity across platforms.
            </p>
          </div>
          <div className="text-xs text-white/70">Secure by design · Consent-based sharing</div>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center bg-background p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden mb-6">
            <Logo size={34} withWordmark />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Join ShramSethu — takes less than a minute."
              : "Sign in to continue building your work identity."}
          </p>

          <div className="mt-6 inline-flex rounded-full border bg-muted p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`rounded-full px-4 py-1.5 font-medium transition ${mode === "signin" ? "bg-white shadow-soft text-foreground" : "text-muted-foreground"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-full px-4 py-1.5 font-medium transition ${mode === "signup" ? "bg-white shadow-soft text-foreground" : "text-muted-foreground"}`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fullName"
                    className="pl-9"
                    placeholder="Riya Sharma"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  />
                </div>
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="pl-9"
                  placeholder="you@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    className="pl-9"
                    placeholder="+91 98xxx xxxxx"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  className="pl-9 pr-10"
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === "signup" && form.password && (
                <div className="mt-1.5">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full ${i < strength ? strengthColor : "bg-muted"}`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Strength: {strengthLabel}</p>
                </div>
              )}
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input
                  id="confirm"
                  type={show ? "text" : "password"}
                  placeholder="Re-enter password"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                />
                {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full rounded-xl gradient-primary text-white shadow-soft">
              {submitting ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"} <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wider"><span className="bg-background px-2 text-muted-foreground">or</span></div>
            </div>
            <Button type="button" variant="outline" size="lg" className="w-full rounded-xl" onClick={google}>
              <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6-2.73-6-6.1s2.69-6.1 6-6.1c1.88 0 3.14.8 3.86 1.48l2.63-2.53C16.86 3.4 14.65 2.4 12 2.4 6.79 2.4 2.6 6.6 2.6 12s4.19 9.6 9.4 9.6c5.42 0 9-3.8 9-9.14 0-.61-.06-1.08-.14-1.55H12z"/></svg>
              Continue with Google
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              By continuing you agree to ShramSethu's Terms and Privacy Policy.
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}