import { api } from "@/lib/db-client";
export const getOperationalMonitoring = (opts) => api("/api/fn/getOperationalMonitoring", {data: opts?.data ?? {}}).then(r => r.result);
