import { auth, defineMcp } from "@lovable.dev/mcp-js";

import getGigscore from "./tools/get-gigscore";
import getProfile from "./tools/get-profile";
import listDocuments from "./tools/list-documents";
import listIncome from "./tools/list-income";
import searchSchemes from "./tools/search-schemes";

// The OAuth issuer must be the direct Supabase host; the project ref is the one
// value that survives publish unchanged.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "shramsethu-your-digital-work-passport",
  title: "ShramSethu: Your Digital Work Passport",
  version: "0.1.0",
  instructions:
    "Tools for ShramSethu, a digital work identity platform for gig workers. Every tool acts as the signed-in worker: read their profile, GigScore, uploaded documents and income records, and search government schemes.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getProfile, getGigscore, listDocuments, listIncome, searchSchemes],
});
