import { api } from "@/lib/db-client";
const generateCampaignEmails = (opts) => api("/api/fn/generateCampaignEmails", { data: opts?.data ?? null }).then((r) => r.result);
const regenerateEmail = (opts) => api("/api/fn/regenerateEmail", { data: opts?.data ?? null }).then((r) => r.result);
const suggestReplyResponse = (opts) => api("/api/fn/suggestReplyResponse", { data: opts?.data ?? null }).then((r) => r.result);
const generateFollowups = (opts) => api("/api/fn/generateFollowups", { data: opts?.data ?? null }).then((r) => r.result);
export {
  generateCampaignEmails,
  generateFollowups,
  regenerateEmail,
  suggestReplyResponse
};
