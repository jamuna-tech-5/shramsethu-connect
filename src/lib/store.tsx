import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyProfile, updateMySettings } from "@/lib/api.functions";

export type WorkCategory =
  | "Delivery Partner"
  | "Driver"
  | "Construction Worker"
  | "Freelancer"
  | "Daily Wage Worker"
  | "Other";

export type Profile = {
  fullName: string;
  email: string;
  phone: string;
  category?: WorkCategory;
  skills?: string;
  experience?: string;
  location?: string;
  workType?: string;
  languages?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  photoDataUrl?: string;
  idDocName?: string;
  onboarded?: boolean;
  status?: "online" | "offline" | "on_duty" | "available";
  preferences?: {
    notifications: boolean;
    darkMode: boolean;
    locationSharing: boolean;
  };
  isAdmin?: boolean;
};

type SignUpArgs = { fullName: string; email: string; phone: string; password: string };

type Ctx = {
  profile: Profile | null;
  session: Session | null;
  isAuthed: boolean;
  loading: boolean;
  signUp: (p: SignUpArgs) => Promise<{ ok: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  update: (patch: Partial<Profile>) => Promise<void>;
  reset: () => Promise<void>;
};

const StoreContext = createContext<Ctx | null>(null);

type RawProfile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  category: string | null;
  skills: string | null;
  experience: string | null;
  location: string | null;
  work_type: string | null;
  languages: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  photo_url: string | null;
  id_doc_name: string | null;
  onboarded: boolean | null;
  status: string | null;
};
type RawSettings = {
  notifications: boolean | null;
  dark_mode: boolean | null;
  location_sharing: boolean | null;
  language?: string | null;
} | null;

function toProfile(raw: RawProfile | null, settings: RawSettings, isAdmin: boolean): Profile | null {
  if (!raw) return null;
  return {
    fullName: raw.full_name ?? "",
    email: raw.email ?? "",
    phone: raw.phone ?? "",
    category: (raw.category ?? undefined) as WorkCategory | undefined,
    skills: raw.skills ?? undefined,
    experience: raw.experience ?? undefined,
    location: raw.location ?? undefined,
    workType: raw.work_type ?? undefined,
    languages: raw.languages ?? undefined,
    emergencyName: raw.emergency_name ?? undefined,
    emergencyPhone: raw.emergency_phone ?? undefined,
    photoDataUrl: raw.photo_url ?? undefined,
    idDocName: raw.id_doc_name ?? undefined,
    onboarded: raw.onboarded ?? false,
    status: (raw.status ?? "offline") as Profile["status"],
    preferences: {
      notifications: settings?.notifications ?? true,
      darkMode: settings?.dark_mode ?? false,
      locationSharing: settings?.location_sharing ?? true,
    },
    isAdmin,
  };
}

const camelToSnake: Record<string, string> = {
  fullName: "full_name",
  phone: "phone",
  category: "category",
  skills: "skills",
  experience: "experience",
  location: "location",
  workType: "work_type",
  languages: "languages",
  emergencyName: "emergency_name",
  emergencyPhone: "emergency_phone",
  photoDataUrl: "photo_url",
  idDocName: "id_doc_name",
  onboarded: "onboarded",
  status: "status",
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const res = await getMyProfile();
      setProfile(toProfile(res.profile as RawProfile | null, res.settings as RawSettings, res.isAdmin));
      const savedLang = (res.settings as RawSettings)?.language;
      if (savedLang && typeof window !== "undefined") {
        const local = window.localStorage.getItem("ss_lang");
        if (local !== savedLang) {
          window.localStorage.setItem("ss_lang", savedLang);
          window.dispatchEvent(new CustomEvent("shramsethu:lang", { detail: { lang: savedLang } }));
        }
      }
    } catch (e) {
      console.error("loadProfile failed", e);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) loadProfile().finally(() => setLoading(false));
      else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (s) {
        setTimeout(() => loadProfile(), 0);
      } else {
        setProfile(null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<Ctx>(
    () => ({
      profile,
      session,
      isAuthed: !!session,
      loading,
      signUp: async ({ fullName, email, phone, password }) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { full_name: fullName, phone },
          },
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      },
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return !error;
      },
      signInWithGoogle: async () => {
        const { lovable } = await import("@/integrations/lovable");
        await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      },
      signOut: async () => {
        // Clear only this user's App Lock unlock session.
        const uid = session?.user?.id;
        if (uid) {
          const { relock } = await import("@/lib/app-lock");
          relock(uid);
        }
        await supabase.auth.signOut();
        setProfile(null);
      },
      update: async (patch) => {
        // Optimistic
        setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
        // Split settings vs profile
        if (patch.preferences) {
          await updateMySettings({
            data: {
              notifications: patch.preferences.notifications,
              dark_mode: patch.preferences.darkMode,
              location_sharing: patch.preferences.locationSharing,
            },
          }).catch(console.error);
        }
        const dbPatch: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(patch)) {
          if (k === "preferences" || k === "isAdmin") continue;
          const dbKey = camelToSnake[k];
          if (dbKey) dbPatch[dbKey] = v;
        }
        if (Object.keys(dbPatch).length > 0) {
          await updateMyProfile({ data: dbPatch }).catch(console.error);
        }
      },
      reset: async () => {
        const uid = session?.user?.id;
        if (uid) {
          const { relock } = await import("@/lib/app-lock");
          relock(uid);
        }
        await supabase.auth.signOut();
        setProfile(null);
      },
    }),
    [profile, session, loading, loadProfile],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function profileCompletion(p: Profile | null): number {
  if (!p) return 0;
  const fields: (keyof Profile)[] = [
    "fullName","email","phone","category","skills","experience","location",
    "workType","languages","emergencyName","emergencyPhone","photoDataUrl","idDocName",
  ];
  const filled = fields.filter((f) => !!p[f]).length;
  return Math.round((filled / fields.length) * 100);
}