import { createServerFn } from "../serverfn.js";
import { z } from "zod";
import { requireAuth } from "../serverfn.js";
import { assertMonitoringRole } from "../monitoring-access.js";
const filters = z.object({ userId: z.string().uuid().optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional(), module: z.string().max(60).optional(), search: z.string().max(100).optional() });
export const getOperationalMonitoring = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((input) => filters.parse(input)).handler(async ({ context, data }) => {
  const { data: adminRole, error: roleError } = await context.db.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
  assertMonitoringRole(adminRole, !!roleError);
  const { adminDb: db } = await import("../admin-client.js");
  const since = performance.now();
  let logs = db.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200);
  if (data.userId)
    logs = logs.eq("user_id", data.userId);
  if (data.from)
    logs = logs.gte("created_at", data.from);
  if (data.to)
    logs = logs.lt("created_at", data.to);
  if (data.module)
    logs = logs.eq("module", data.module);
  if (data.search)
    logs = logs.ilike("description", `%${data.search}%`);
  const count = async (table, status, field) => {
    let query = table === "crm_leads" ? db.from("crm_leads").select("id", { count: "exact", head: true }) : db.from(table).select("id", { count: "exact", head: true });
    if (data.userId)
      query = query.eq("user_id", data.userId);
    if (data.from)
      query = query.gte("created_at", data.from);
    if (data.to)
      query = query.lt("created_at", data.to);
    if (status && table !== "crm_leads") {
      let statusQuery = db.from(table).select("id", { count: "exact", head: true }).eq("status", status);
      if (data.userId)
        statusQuery = statusQuery.eq("user_id", data.userId);
      if (data.from)
        statusQuery = statusQuery.gte("created_at", data.from);
      if (data.to)
        statusQuery = statusQuery.lt("created_at", data.to);
      const result = await statusQuery;
      if (result.error)
        throw new Error(result.error.message);
      return result.count ?? 0;
    }
    if (field)
      query = query.not(field, "is", null);
    const result = await query;
    if (result.error)
      throw new Error(result.error.message);
    return result.count ?? 0;
  };
  const [audit, crm, searches, campaigns, sent, failed] = await Promise.all([logs, count("crm_leads"), count("lead_extractions"), count("campaigns"), count("campaign_emails", "sent"), count("campaign_emails", "failed")]);
  if (audit.error)
    throw new Error(audit.error.message);
  const databaseLatencyMs = Math.round(performance.now() - since);
  const [failedSearches, phones, emails, websites] = await Promise.all([count("lead_extractions", "failed"), count("crm_leads", undefined, "phone"), count("crm_leads", undefined, "email"), count("crm_leads", undefined, "website")]);
  let extractionQuery = db.from("lead_extractions").select("*").order("created_at", { ascending: false }).limit(100);
  let campaignQuery = db.from("campaigns").select("id,user_id,name,status,created_at").order("created_at", { ascending: false }).limit(100);
  let pipelineQuery = db.from("crm_leads").select("stage_id,crm_stages(name)").limit(5000);
  if (data.userId) {
    extractionQuery = extractionQuery.eq("user_id", data.userId);
    campaignQuery = campaignQuery.eq("user_id", data.userId);
    pipelineQuery = pipelineQuery.eq("user_id", data.userId);
  }
  if (data.from) {
    extractionQuery = extractionQuery.gte("created_at", data.from);
    campaignQuery = campaignQuery.gte("created_at", data.from);
    pipelineQuery = pipelineQuery.gte("created_at", data.from);
  }
  if (data.to) {
    extractionQuery = extractionQuery.lt("created_at", data.to);
    campaignQuery = campaignQuery.lt("created_at", data.to);
    pipelineQuery = pipelineQuery.lt("created_at", data.to);
  }
  const [extractions, campaignRows, pipelineRows, authUser] = await Promise.all([extractionQuery, campaignQuery, pipelineQuery, data.userId ? db.auth.admin.getUserById(data.userId) : Promise.resolve(null)]);
  for (const r of [extractions, campaignRows, pipelineRows])
    if (r.error)
      throw new Error(r.error.message);
  const pipeline = {};
  for (const row of pipelineRows.data ?? []) {
    const name = row.crm_stages?.name ?? "Unassigned";
    pipeline[name] = (pipeline[name] ?? 0) + 1;
  }
  return { logs: audit.data ?? [], counts: { crm, searches, campaigns, sent, failed, failedSearches, phones, emails, websites }, extractions: extractions.data ?? [], campaigns: campaignRows.data ?? [], pipeline, pipelineTruncated: (pipelineRows.data?.length ?? 0) === 5000, databaseLatencyMs, lastLogin: authUser?.data.user?.last_sign_in_at ?? null, measuredAt: new Date().toISOString() };
});
