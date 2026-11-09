import { api } from "@/lib/db-client";
const getSetupStatus = (opts) => api("/api/fn/getSetupStatus", { data: opts?.data ?? null }).then((r) => r.result);
const bootstrapSuperAdmin = (opts) => api("/api/fn/bootstrapSuperAdmin", { data: opts?.data ?? null }).then((r) => r.result);
const adminListUsers = (opts) => api("/api/fn/adminListUsers", { data: opts?.data ?? null }).then((r) => r.result);
const adminStats = (opts) => api("/api/fn/adminStats", { data: opts?.data ?? null }).then((r) => r.result);
const adminDeleteUser = (opts) => api("/api/fn/adminDeleteUser", { data: opts?.data ?? null }).then((r) => r.result);
const adminListPlans = (opts) => api("/api/fn/adminListPlans", { data: opts?.data ?? null }).then((r) => r.result);
const adminCreatePlan = (opts) => api("/api/fn/adminCreatePlan", { data: opts?.data ?? null }).then((r) => r.result);
const adminUpdatePlan = (opts) => api("/api/fn/adminUpdatePlan", { data: opts?.data ?? null }).then((r) => r.result);
const adminDeletePlan = (opts) => api("/api/fn/adminDeletePlan", { data: opts?.data ?? null }).then((r) => r.result);
const adminUpdateSettings = (opts) => api("/api/fn/adminUpdateSettings", { data: opts?.data ?? null }).then((r) => r.result);
const adminCreateUser = (opts) => api("/api/fn/adminCreateUser", { data: opts?.data ?? null }).then((r) => r.result);
const adminUpdateUser = (opts) => api("/api/fn/adminUpdateUser", { data: opts?.data ?? null }).then((r) => r.result);
export {
  adminCreatePlan,
  adminCreateUser,
  adminDeletePlan,
  adminDeleteUser,
  adminListPlans,
  adminListUsers,
  adminStats,
  adminUpdatePlan,
  adminUpdateSettings,
  adminUpdateUser,
  bootstrapSuperAdmin,
  getSetupStatus
};
