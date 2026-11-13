import { api } from "@/lib/db-client";
const createExtensionToken = (opts) => api("/api/fn/createExtensionToken", { data: opts?.data ?? null }).then((r) => r.result);
const syncCrmToRecipients = (opts) => api("/api/fn/syncCrmToRecipients", { data: opts?.data ?? null }).then((r) => r.result);
export { createExtensionToken, syncCrmToRecipients };
