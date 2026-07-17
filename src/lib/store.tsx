import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

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
  documents?: Record<string, "not_uploaded" | "pending" | "verified">;
  status?: "online" | "offline" | "on_duty" | "available";
};

type Ctx = {
  profile: Profile | null;
  isAuthed: boolean;
  signUp: (p: { fullName: string; email: string; phone: string; password: string }) => void;
  signIn: (email: string, _password: string) => boolean;
  signOut: () => void;
  update: (patch: Partial<Profile>) => void;
};

const StoreContext = createContext<Ctx | null>(null);
const KEY = "ss_profile_v1";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setProfile(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = (p: Profile | null) => {
    setProfile(p);
    if (typeof window !== "undefined") {
      if (p) localStorage.setItem(KEY, JSON.stringify(p));
      else localStorage.removeItem(KEY);
    }
  };

  const value = useMemo<Ctx>(
    () => ({
      profile,
      isAuthed: !!profile,
      signUp: ({ fullName, email, phone }) =>
        persist({
          fullName,
          email,
          phone,
          documents: {
            aadhaar: "not_uploaded",
            pan: "not_uploaded",
            license: "not_uploaded",
          },
          status: "offline",
        }),
      signIn: (email) => {
        try {
          const raw = localStorage.getItem(KEY);
          if (raw) {
            const p = JSON.parse(raw) as Profile;
            if (p.email.toLowerCase() === email.toLowerCase()) {
              setProfile(p);
              return true;
            }
          }
        } catch {}
        return false;
      },
      signOut: () => persist(null),
      update: (patch) => {
        if (!profile) return;
        persist({ ...profile, ...patch });
      },
    }),
    [profile],
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
    "fullName",
    "email",
    "phone",
    "category",
    "skills",
    "experience",
    "location",
    "workType",
    "languages",
    "emergencyName",
    "emergencyPhone",
    "photoDataUrl",
    "idDocName",
  ];
  const filled = fields.filter((f) => !!p[f]).length;
  return Math.round((filled / fields.length) * 100);
}