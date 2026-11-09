import { api } from "@/lib/db-client";
const saveSmtpSettings = (opts) => api("/api/fn/saveSmtpSettings", { data: opts?.data ?? null }).then((r) => r.result);
const testSmtpConnection = (opts) => api("/api/fn/testSmtpConnection", { data: opts?.data ?? null }).then((r) => r.result);
const processCampaignBatch = (opts) => api("/api/fn/processCampaignBatch", { data: opts?.data ?? null }).then((r) => r.result);
const saveSignature = (opts) => api("/api/fn/saveSignature", { data: opts?.data ?? null }).then((r) => r.result);
const getFollowupStats = (opts) => api("/api/fn/getFollowupStats", { data: opts?.data ?? null }).then((r) => r.result);
const sendReply = (opts) => api("/api/fn/sendReply", { data: opts?.data ?? null }).then((r) => r.result);
export {
  getFollowupStats,
  processCampaignBatch,
  saveSignature,
  saveSmtpSettings,
  sendReply,
  testSmtpConnection
};
