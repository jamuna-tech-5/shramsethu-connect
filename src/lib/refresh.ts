import type { QueryClient } from "@tanstack/react-query";

/**
 * Keys that depend on verified documents / work history / earnings.
 * Invalidate all of them whenever a document is verified so the GigScore,
 * dashboard, analytics and loan eligibility refresh immediately.
 */
export const VERIFIED_DATA_KEYS = [
  "docs",
  "work",
  "txns",
  "income-uploads",
  "gigscore",
  "loan",
  "notifs",
] as const;

export function refreshVerifiedData(qc: QueryClient) {
  for (const key of VERIFIED_DATA_KEYS) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}
