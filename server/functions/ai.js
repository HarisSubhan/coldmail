import { createServerFn } from "../serverfn.js";
import { z } from "zod";
import { requireAuth } from "../serverfn.js";
import { writeColdEmail, writeFollowup, classifyReply } from "../local-writer.js";
const lengthGuide = { Short: "60-90 words", Medium: "110-160 words", Long: "180-250 words" };
async function aiModel(sb) {
  const { data } = await sb.from("app_settings").select("ai_model").eq("id", 1).maybeSingle();
  return data?.ai_model || "gpt-4o-mini";
}
function extractText(res) {
  return res.output_text ?? (res.output ?? []).flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text).join("");
}
async function writeEmail(c, lead) {
  return writeColdEmail(c, lead);
}
const generateCampaignEmails = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((d) => z.object({ campaignId: z.string().uuid(), leadIds: z.array(z.string().uuid()).max(20) }).parse(d)).handler(async ({ data, context }) => {
  const sb = context.db;
  const { data: campaign, error } = await sb.from("campaigns").select("*").eq("id", data.campaignId).single();
  if (error || !campaign) throw new Error("Campaign not found");
  const { data: leads } = await sb.from("leads").select("*").in("id", data.leadIds);
  const { data: smtp } = await sb.from("smtp_settings").select("signature").maybeSingle();
  const model = await aiModel(sb);
  let ok = 0;
  const failures = [];
  for (const lead of leads ?? []) {
    try {
      const e = await writeEmail(campaign, lead, smtp?.signature ?? null, model);
      await sb.from("campaign_emails").upsert(
        {
          user_id: context.userId,
          campaign_id: campaign.id,
          lead_id: lead.id,
          subject: e.subject,
          body: e.body,
          status: "draft",
          is_followup: false,
          error: null,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        { onConflict: "campaign_id,lead_id,is_followup" }
      );
      ok++;
    } catch (err) {
      failures.push(`${lead.email}: ${err.message}`);
    }
  }
  return { generated: ok, failures };
});
const regenerateEmail = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((d) => z.object({ emailId: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  const sb = context.db;
  const { data: row } = await sb.from("campaign_emails").select("*, campaigns(*), leads(*)").eq("id", data.emailId).single();
  if (!row) throw new Error("Email not found");
  const { data: smtp } = await sb.from("smtp_settings").select("signature").maybeSingle();
  const model = await aiModel(sb);
  const e = await writeEmail(row.campaigns, row.leads, smtp?.signature ?? null, model);
  await sb.from("campaign_emails").update({ ...e, status: "draft", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", data.emailId);
  return e;
});
const suggestReplyResponse = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator((d) => z.object({ replyId: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  const sb = context.db;
  const { data: reply } = await sb.from("replies").select("*").eq("id", data.replyId).single();
  if (!reply) throw new Error("Reply not found");
  const parsed = classifyReply(reply.subject, reply.body);
  await sb.from("replies").update({ classification: parsed.classification, suggested_response: parsed.response }).eq("id", data.replyId);
  return parsed;
});
const generateFollowups = createServerFn({ method: "POST" }).middleware([requireAuth]).inputValidator(
  (d) => z.object({
    campaignId: z.string().uuid(),
    emailIds: z.array(z.string().uuid()).max(20),
    delayDays: z.number().int().min(1).max(30)
  }).parse(d)
).handler(async ({ data, context }) => {
  const sb = context.db;
  const { data: campaign } = await sb.from("campaigns").select("*").eq("id", data.campaignId).single();
  if (!campaign) throw new Error("Campaign not found");
  const { data: originals } = await sb.from("campaign_emails").select("id,lead_id,subject,body,status,is_followup,leads(name,email,business_name)").eq("campaign_id", data.campaignId).in("id", data.emailIds);
  const { data: replies } = await sb.from("replies").select("lead_id").eq("campaign_id", data.campaignId);
  const repliedLeads = new Set((replies ?? []).map((r) => r.lead_id).filter(Boolean));
  const model = await aiModel(sb);
  let ok = 0;
  const failures = [];
  for (const orig of originals ?? []) {
    if (orig.is_followup || orig.status !== "sent" || repliedLeads.has(orig.lead_id)) continue;
    try {
      const parsed = writeFollowup(campaign, orig, data.delayDays);
      const { error } = await sb.from("campaign_emails").insert({
        user_id: context.userId,
        campaign_id: data.campaignId,
        lead_id: orig.lead_id,
        subject: orig.subject.startsWith("Re:") ? orig.subject : `Re: ${orig.subject}`,
        body: String(parsed.body ?? ""),
        status: "draft",
        is_followup: true,
        followup_of: orig.id
      });
      if (error) throw new Error(error.message);
      ok++;
    } catch (err) {
      failures.push(`${orig.leads?.email ?? orig.id}: ${err.message}`);
    }
  }
  return { generated: ok, failures };
});
export {
  generateCampaignEmails,
  generateFollowups,
  regenerateEmail,
  suggestReplyResponse
};
