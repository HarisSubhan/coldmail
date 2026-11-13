import { createServerFn } from "../serverfn.js";
import { z } from "zod";
import { requireAuth } from "../serverfn.js";
async function assertAdmin(context) {
  const { data } = await context.db.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
  if (!data)
    throw new Error("Forbidden");
  const { adminDb } = await import("../admin-client.js");
  return adminDb;
}
async function recordAdminAction(db, actorId, action, targetId) {
  const { error } = await db.from("activity_logs").insert({
    user_id: targetId ?? actorId,
    actor_id: actorId,
    module: "administration",
    activity_type: action,
    description: action.replaceAll("_", " "),
    related_record_id: targetId ?? null
  });
  if (error)
    throw new Error("The action succeeded, but its audit record could not be saved");
}
async function anyAdmin() {
  const { adminDb } = await import("../admin-client.js");
  const { count } = await adminDb.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "super_admin");
  return { adminDb, exists: (count ?? 0) > 0 };
}
export const getSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { exists } = await anyAdmin();
  return { needsSetup: !exists };
});
export const bootstrapSuperAdmin = createServerFn({ method: "POST" }).inputValidator((d) => z.object({ email: z.string().email(), password: z.string().min(8), full_name: z.string().min(1).max(100) }).parse(d)).handler(async ({ data }) => {
  const { adminDb, exists } = await anyAdmin();
  if (exists)
    throw new Error("Setup already completed");
  const { data: created, error } = await adminDb.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { full_name: data.full_name }
  });
  if (error || !created.user)
    throw new Error(error?.message ?? "Could not create user");
  await adminDb.from("user_roles").insert({ user_id: created.user.id, role: "super_admin" });
  return { ok: true };
});
export const adminListUsers = createServerFn({ method: "GET" }).middleware([requireAuth]).handler(async ({ context }) => {
  const admin = await assertAdmin(context);
  const [{ data: profiles }, { data: subs }, { data: roles }] = await Promise.all([
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
    admin.from("subscriptions").select("*"),
    admin.from("user_roles").select("user_id, role")
  ]);
  return (profiles ?? []).map((p) => ({
    ...p,
    subscription: subs?.find((s) => s.user_id === p.id) ?? null,
    isAdmin: !!roles?.some((r) => r.user_id === p.id && r.role === "super_admin")
  }));
});
const subSchema = z.object({
  plan_name: z.string().min(1).max(60),
  price_pkr: z.number().min(0),
  billing_cycle: z.enum(["monthly", "yearly"]),
  starts_at: z.string().nullable().optional(),
  expires_at: z.string().nullable(),
  plan_id: z.string().uuid().nullable().optional()
});
export const adminStats = createServerFn({ method: "GET" }).middleware([requireAuth]).handler(async ({ context }) => {
  const admin = await assertAdmin(context);
  const now = new Date().toISOString();
  const count = async (table, fn) => {
    let q = admin.from(table).select("id", { count: "exact", head: true });
    if (fn)
      q = fn(q);
    return (await q).count ?? 0;
  };
  const [totalUsers, activeUsers, suspendedUsers, expiredSubs, totalCampaigns, emailsSent, activePlans] = await Promise.all([
    count("profiles"),
    count("profiles", (q) => q.eq("status", "active")),
    count("profiles", (q) => q.eq("status", "suspended")),
    count("subscriptions", (q) => q.lt("expires_at", now)),
    count("campaigns"),
    count("campaign_emails", (q) => q.eq("status", "sent")),
    count("plans", (q) => q.eq("active", true))
  ]);
  const today = new Date;
  today.setHours(0, 0, 0, 0);
  const [totalExtractions, runningExtractions, totalCrmLeads, crmToday, crmWithEmail] = await Promise.all([
    count("lead_extractions"),
    count("lead_extractions", (q) => q.in("status", ["pending", "running"])),
    count("crm_leads"),
    count("crm_leads", (q) => q.gte("extracted_at", today.toISOString())),
    count("crm_leads", (q) => q.not("email", "is", null))
  ]);
  const { data: recentExtractions } = await admin.from("lead_extractions").select("id,name,keyword,city,status,saved,found,created_at,user_id").order("created_at", { ascending: false }).limit(15);
  const ids = [...new Set((recentExtractions ?? []).map((e) => e.user_id))];
  const { data: owners } = ids.length ? await admin.from("profiles").select("id,email").in("id", ids) : { data: [] };
  const ownerMap = new Map((owners ?? []).map((o) => [o.id, o.email]));
  const { data: subs } = await admin.from("subscriptions").select("price_pkr,billing_cycle,expires_at");
  const live = (subs ?? []).filter((s) => !s.expires_at || s.expires_at > now);
  const monthlyRevenue = live.filter((s) => s.billing_cycle === "monthly").reduce((a, s) => a + Number(s.price_pkr), 0);
  const yearlyRevenue = live.filter((s) => s.billing_cycle === "yearly").reduce((a, s) => a + Number(s.price_pkr), 0);
  const [{ data: recentUsers }, { data: recentCampaigns }, { data: recentSubs }] = await Promise.all([
    admin.from("profiles").select("id,full_name,email,created_at,status").order("created_at", { ascending: false }).limit(5),
    admin.from("campaigns").select("id,name,status,created_at,user_id").order("created_at", { ascending: false }).limit(5),
    admin.from("subscriptions").select("id,user_id,plan_name,price_pkr,billing_cycle,created_at").order("created_at", { ascending: false }).limit(5)
  ]);
  return {
    totalUsers,
    activeUsers,
    suspendedUsers,
    expiredSubs,
    totalCampaigns,
    emailsSent,
    activePlans,
    monthlyRevenue,
    yearlyRevenue,
    recentUsers: recentUsers ?? [],
    recentCampaigns: recentCampaigns ?? [],
    recentSubs: recentSubs ?? [],
    totalExtractions,
    runningExtractions,
    totalCrmLeads,
    crmToday,
    crmWithEmail,
    recentExtractions: (recentExtractions ?? []).map((e) => ({ ...e, owner: ownerMap.get(e.user_id) ?? "" }))
  };
});
export const adminDeleteUser = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  const admin = await assertAdmin(context);
  if (data.userId === context.userId)
    throw new Error("You cannot delete your own account");
  const { error } = await admin.auth.admin.deleteUser(data.userId);
  if (error)
    throw new Error(error.message);
  await recordAdminAction(admin, context.userId, "deleted_user", data.userId);
  return { ok: true };
});
const planSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(500),
  price_monthly_pkr: z.number().min(0),
  price_yearly_pkr: z.number().min(0),
  features: z.array(z.string().max(120)).max(20),
  active: z.boolean(),
  sort_order: z.number().int().min(0).max(999)
});
export const adminListPlans = createServerFn({ method: "GET" }).middleware([requireAuth]).handler(async ({ context }) => {
  const admin = await assertAdmin(context);
  const { data } = await admin.from("plans").select("*").order("sort_order");
  return data ?? [];
});
export const adminCreatePlan = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((d) => planSchema.parse(d)).handler(async ({ data, context }) => {
  const admin = await assertAdmin(context);
  const { error } = await admin.from("plans").insert(data);
  if (error)
    throw new Error(error.message);
  await recordAdminAction(admin, context.userId, "created_plan");
  return { ok: true };
});
export const adminUpdatePlan = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((d) => z.object({ id: z.string().uuid(), plan: planSchema }).parse(d)).handler(async ({ data, context }) => {
  const admin = await assertAdmin(context);
  const { error } = await admin.from("plans").update(data.plan).eq("id", data.id);
  if (error)
    throw new Error(error.message);
  await recordAdminAction(admin, context.userId, "updated_plan");
  return { ok: true };
});
export const adminDeletePlan = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  const admin = await assertAdmin(context);
  const { error } = await admin.from("plans").delete().eq("id", data.id);
  if (error)
    throw new Error(error.message);
  await recordAdminAction(admin, context.userId, "deleted_plan");
  return { ok: true };
});
export const adminUpdateSettings = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((d) => z.object({
  whatsapp_number: z.string().max(20).optional(),
  whatsapp_message: z.string().max(500).optional(),
  ai_model: z.string().max(100).optional()
}).parse(d)).handler(async ({ data, context }) => {
  const admin = await assertAdmin(context);
  const patch = {
    updated_at: new Date().toISOString()
  };
  if (data.whatsapp_number !== undefined)
    patch.whatsapp_number = data.whatsapp_number;
  if (data.whatsapp_message !== undefined)
    patch.whatsapp_message = data.whatsapp_message;
  if (data.ai_model !== undefined)
    patch.ai_model = data.ai_model;
  const { error } = await admin.from("app_settings").update(patch).eq("id", 1);
  if (error)
    throw new Error(error.message);
  await recordAdminAction(admin, context.userId, "updated_platform_settings");
  return { ok: true };
});
export const adminCreateUser = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((d) => z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1).max(100),
  company: z.string().max(100).optional(),
  subscription: subSchema
}).parse(d)).handler(async ({ data, context }) => {
  const admin = await assertAdmin(context);
  const { data: created, error } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { full_name: data.full_name }
  });
  if (error || !created.user)
    throw new Error(error?.message ?? "Could not create user");
  const id = created.user.id;
  if (data.company)
    await admin.from("profiles").update({ company: data.company }).eq("id", id);
  const { error: subscriptionError } = await admin.from("subscriptions").upsert({
    user_id: id,
    plan_name: data.subscription.plan_name,
    price_pkr: data.subscription.price_pkr,
    billing_cycle: data.subscription.billing_cycle,
    starts_at: data.subscription.starts_at ?? new Date().toISOString(),
    expires_at: data.subscription.expires_at,
    plan_id: data.subscription.plan_id ?? null
  }, { onConflict: "user_id" });
  if (subscriptionError)
    throw new Error("User created, but the subscription could not be saved");
  await recordAdminAction(admin, context.userId, "created_user", id);
  return { id };
});
export const adminUpdateUser = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((d) => z.object({
  userId: z.string().uuid(),
  status: z.enum(["active", "suspended"]).optional(),
  password: z.string().min(8).optional(),
  subscription: subSchema.optional()
}).parse(d)).handler(async ({ data, context }) => {
  const admin = await assertAdmin(context);
  if (data.status) {
    const { error } = await admin.from("profiles").update({ status: data.status }).eq("id", data.userId);
    if (error)
      throw new Error(error.message);
    await recordAdminAction(admin, context.userId, data.status === "active" ? "activated_user" : "suspended_user", data.userId);
  }
  if (data.password) {
    const { error } = await admin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error)
      throw new Error(error.message);
    await recordAdminAction(admin, context.userId, "reset_user_password", data.userId);
  }
  if (data.subscription) {
    const { error } = await admin.from("subscriptions").upsert({
      user_id: data.userId,
      plan_name: data.subscription.plan_name,
      price_pkr: data.subscription.price_pkr,
      billing_cycle: data.subscription.billing_cycle,
      starts_at: data.subscription.starts_at ?? new Date().toISOString(),
      expires_at: data.subscription.expires_at,
      plan_id: data.subscription.plan_id ?? null
    }, { onConflict: "user_id" });
    if (error)
      throw new Error(error.message);
    await recordAdminAction(admin, context.userId, "updated_subscription", data.userId);
  }
  return { ok: true };
});
