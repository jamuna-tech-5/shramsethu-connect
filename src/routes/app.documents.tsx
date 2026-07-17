import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock, FileCheck2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/app/documents")({
  component: DocumentsPage,
});

const DOCS = [
  { key: "aadhaar", label: "Aadhaar Card", desc: "Government ID" },
  { key: "pan", label: "PAN Card", desc: "Tax identity" },
  { key: "license", label: "Driving License", desc: "Required for drivers" },
  { key: "other", label: "Other Documents", desc: "Certifications, permits" },
];

function DocumentsPage() {
  const { profile, update } = useStore();
  const docs = profile?.documents ?? {};

  const upload = (key: string) => {
    update({ documents: { ...docs, [key]: "pending" } });
    toast.success("Uploaded. Verification pending.");
  };

  const statusFor = (key: string) => docs[key] ?? "not_uploaded";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compliance"
        title="Document Verification"
        description="Upload your identity documents securely. Documents are encrypted at rest."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {DOCS.map((d) => {
          const s = statusFor(d.key);
          return (
            <div key={d.key} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl gradient-soft text-primary">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{d.label}</h3>
                  <p className="truncate text-xs text-muted-foreground">{d.desc}</p>
                </div>
                <StatusBadge status={s} />
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/50 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Encrypted upload
                </div>
                <label>
                  <Button asChild size="sm" variant={s === "verified" ? "outline" : "default"} className="rounded-full">
                    <span className="cursor-pointer">
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      {s === "not_uploaded" ? "Upload" : "Replace"}
                    </span>
                  </Button>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) upload(d.key);
                    }}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "verified")
    return (
      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Verified
      </span>
    );
  if (status === "pending")
    return (
      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
        <Clock className="h-3 w-3" /> Pending
      </span>
    );
  return (
    <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      Not uploaded
    </span>
  );
}