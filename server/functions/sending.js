import { createServerFn } from "../serverfn.js";
import { z } from "zod";
import { requireAuth } from "../serverfn.js";
const smtpSchema = z.object({
  sender_name: z.string().min(1).max(100),
  sender_email: z.string().email(),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  username: z.string().max(255),
  password: z.string().max(500).optional(),
  encryption: z.enum(["ssl", "tls", "none"]),
  reply_to: z.string().email().or(z.literal("")).nullable(),
  signature: z.string().max(2e4).nullable()
});
const stripHtml = (s) => s.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim();
const escHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function composeParts(body, signature) {
  if (!signature) return { text: body };
  const isHtml = signature.trimStart().startsWith("<");
  const text = `${body}

--
${isHtml ? stripHtml(signature) : signature}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222222;line-height:1.5;">${escHtml(body).replace(/\n/g, "<br>")}</div><br>${isHtml ? signature : `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;">${escHtml(signature).replace(/\n/g, "<br>")}</div>`}`;
  return { text, html };
}
async function loadSmtp(userId) {
  const { adminDb } = await import("../admin-client.js");
  const { decryptSecret } = await import("../crypto.js");
  const { data } = await adminDb.from("smtp_settings").select("*").eq("user_id", userId).maybeSingle();
  if (!data || !data.password_encrypted) throw new Error("SMTP settings are not configured");
  return {
    row: data,
    cfg: {
      host: data.host,
      port: data.port,
      username: data.username,
      password: await decryptSecret(data.password_encrypted),
      encryption: data.encryption
    }
  };
}
const saveSmtpSettings = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((d) => smtpSchema.parse(d)).handler(async ({ data, context }) => {
  const { adminDb } = await import("../admin-client.js");
  const { encryptSecret } = await import("../crypto.js");
  const { password, ...rest } = data;
  const row = {
    ...rest,
    reply_to: rest.reply_to || null,
    user_id: context.userId,
    verified: false,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (password) row["password_encrypted"] = await encryptSecret(password);
  const { error } = await adminDb.from("smtp_settings").upsert(row, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  return { ok: true };
});
const testSmtpConnection = createServerFn({ method: "POST" }).middleware([requireAuth]).handler(async ({ context }) => {
  const { adminDb } = await import("../admin-client.js");
  const { testSmtp } = await import("../smtp.js");
  try {
    const { cfg } = await loadSmtp(context.userId);
    await testSmtp(cfg);
    await adminDb.from("smtp_settings").update({ verified: true }).eq("user_id", context.userId);
    return { ok: true };
  } catch (e) {
    await adminDb.from("smtp_settings").update({ verified: false }).eq("user_id", context.userId);
    return { ok: false, error: e.message };
  }
});
const processCampaignBatch = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((d) => z.object({ campaignId: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  const sb = context.db;
  const { data: campaign } = await sb.from("campaigns").select("id,status").eq("id", data.campaignId).single();
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "running") return { sent: 0, failed: 0, remaining: 0, status: campaign.status };
  const { row, cfg } = await loadSmtp(context.userId);
  if (!row.verified) throw new Error("Verify your SMTP connection before sending");
  const { sendMail } = await import("../smtp.js");
  const { data: batch } = await sb.from("campaign_emails").select("id, subject, body, attempts, leads(email)").eq("campaign_id", data.campaignId).eq("status", "approved").order("created_at").limit(3);
  let sent = 0;
  let failed = 0;
  for (const e of batch ?? []) {
    const to = e.leads?.email;
    if (!to) continue;
    const parts = composeParts(e.body, row.signature);
    try {
      await sendMail(cfg, {
        fromName: row.sender_name,
        fromEmail: row.sender_email,
        to,
        replyTo: row.reply_to,
        subject: e.subject,
        text: parts.text,
        html: parts.html
      });
      await sb.from("campaign_emails").update({ status: "sent", sent_at: (/* @__PURE__ */ new Date()).toISOString(), error: null, attempts: e.attempts + 1 }).eq("id", e.id);
      await sb.from("email_logs").insert({ user_id: context.userId, campaign_id: data.campaignId, email_id: e.id, message: `Sent to ${to}` });
      sent++;
    } catch (err) {
      const msg = err.message.slice(0, 500);
      await sb.from("campaign_emails").update({ status: "failed", error: msg, attempts: e.attempts + 1 }).eq("id", e.id);
      await sb.from("email_logs").insert({ user_id: context.userId, campaign_id: data.campaignId, email_id: e.id, level: "error", message: `Failed to ${to}: ${msg}` });
      failed++;
    }
  }
  const { count } = await sb.from("campaign_emails").select("id", { count: "exact", head: true }).eq("campaign_id", data.campaignId).eq("status", "approved");
  const remaining = count ?? 0;
  if (remaining === 0) {
    await sb.from("campaigns").update({ status: "completed", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", data.campaignId);
  }
  return { sent, failed, remaining, status: remaining === 0 ? "completed" : "running" };
});
const saveSignature = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator(
  (d) => z.object({
    template: z.string().max(50),
    data: z.record(z.string(), z.string()),
    html: z.string().max(2e4)
  }).parse(d)
).handler(async ({ data, context }) => {
  const { adminDb } = await import("../admin-client.js");
  const { error } = await adminDb.from("smtp_settings").upsert(
    {
      user_id: context.userId,
      signature: data.html,
      signature_template: data.template,
      signature_data: data.data,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
  return { ok: true };
});
const getFollowupStats = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((d) => z.object({ campaignId: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  const sb = context.db;
  const [{ data: emails }, { data: replies }] = await Promise.all([
    sb.from("campaign_emails").select("id,lead_id,subject,status,is_followup,leads(name,email,business_name)").eq("campaign_id", data.campaignId),
    sb.from("replies").select("lead_id").eq("campaign_id", data.campaignId)
  ]);
  const initial = (emails ?? []).filter((e) => !e.is_followup);
  const followups = (emails ?? []).filter((e) => e.is_followup);
  const repliedLeads = new Set((replies ?? []).map((r) => r.lead_id).filter(Boolean));
  const followedUp = new Set(followups.map((f) => f.lead_id));
  const sent = initial.filter((e) => e.status === "sent");
  const eligible = sent.filter((e) => !repliedLeads.has(e.lead_id) && !followedUp.has(e.lead_id)).map((e) => ({
    email_id: e.id,
    lead_id: e.lead_id,
    subject: e.subject,
    name: e.leads?.name ?? null,
    email: e.leads?.email ?? "",
    business_name: e.leads?.business_name ?? null
  }));
  return {
    sent: sent.length,
    replied: initial.filter((e) => repliedLeads.has(e.lead_id)).length,
    noReply: sent.filter((e) => !repliedLeads.has(e.lead_id)).length,
    failed: initial.filter((e) => e.status === "failed").length,
    followupsSent: followups.filter((f) => f.status === "sent").length,
    eligible
  };
});
const sendReply = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((d) => z.object({ replyId: z.string().uuid(), body: z.string().min(1).max(1e4) }).parse(d)).handler(async ({ data, context }) => {
  const { data: reply } = await context.db.from("replies").select("*").eq("id", data.replyId).single();
  if (!reply) throw new Error("Reply not found");
  const { row, cfg } = await loadSmtp(context.userId);
  const { sendMail } = await import("../smtp.js");
  const parts = composeParts(data.body, row.signature);
  await sendMail(cfg, {
    fromName: row.sender_name,
    fromEmail: row.sender_email,
    to: reply.from_email,
    replyTo: row.reply_to,
    subject: reply.subject?.startsWith("Re:") ? reply.subject : `Re: ${reply.subject ?? ""}`,
    text: parts.text,
    html: parts.html
  });
  await context.db.from("replies").update({ responded: true, suggested_response: data.body }).eq("id", data.replyId);
  return { ok: true };
});
export {
  getFollowupStats,
  processCampaignBatch,
  saveSignature,
  saveSmtpSettings,
  sendReply,
  testSmtpConnection
};
