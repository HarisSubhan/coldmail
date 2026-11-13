import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { createServerFn, requireAuth } from "../serverfn.js";
import { dbClient } from "../db.js";

export const sha256 = (s) => createHash("sha256").update(s).digest("hex");

/** Issue (or replace) the user's extension connect code. Shown once. */
export const createExtensionToken = createServerFn({ method: "POST" }).middleware([requireAuth]).handler(async ({ context }) => {
  const admin = dbClient({ admin: true });
  const { data: p } = await admin.from("profiles").select("status").eq("id", context.userId).maybeSingle();
  if (!p || p.status !== "active") throw new Error("Account is not active");
  const token = "o99_" + randomBytes(24).toString("hex");
  await admin.from("extension_tokens").delete().eq("user_id", context.userId);
  const { error } = await admin.from("extension_tokens").insert({ user_id: context.userId, token_hash: sha256(token) });
  if (error) throw new Error(error.message);
  return { token };
});

/** Make CRM leads with valid emails available as campaign recipients; returns their lead ids. */
export const syncCrmToRecipients = createServerFn({ method: "POST" }).middleware([requireAuth])
  .inputValidator((d) => z.object({ crmIds: z.array(z.string().uuid()).max(5000).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { syncToRecipients } = await import("../crm.js");
    const created = await syncToRecipients(context.db, context.userId, data.crmIds);
    let leadIds = [], skipped = 0;
    if (data.crmIds) {
      const { data: rows } = await context.db.from("crm_leads").select("lead_id,unsubscribed").in("id", data.crmIds);
      leadIds = [...new Set((rows ?? []).filter((r) => r.lead_id && !r.unsubscribed).map((r) => r.lead_id))];
      skipped = data.crmIds.length - leadIds.length;
    }
    return { created, leadIds, skipped };
  });
