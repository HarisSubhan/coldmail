// Endpoint used by the Origami99 Maps Extractor Chrome extension (authenticated by connect code).
// Two-stage protocol: Stage A queues every discovered listing (extraction_items),
// Stage B processes each queued listing one by one and reports a per-listing status.
import { z } from "zod";
import { dbClient } from "./db.js";
import { sha256 } from "./functions/crm.js";
import { saveBusinesses, saveListing, syncToRecipients } from "./crm.js";
import { extensionInput as body, validationIssues } from "./extraction-validation.js";
import { buildSearchQueries, placeKey } from "../src/lib/extraction-queries.js";

export async function extensionHandler(req, res) {
  res.set({ "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, authorization" });
  if (req.method === "OPTIONS") return res.status(204).end();
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!/^o99_[a-f0-9]{48}$/.test(token)) return res.status(401).json({ error: "Invalid connect code" });
  const db = dbClient({ admin: true });
  const { data: tok } = await db.from("extension_tokens").select("user_id").eq("token_hash", sha256(token)).maybeSingle();
  if (!tok) return res.status(401).json({ error: "Invalid connect code" });
  const userId = tok.user_id;
  const { data: profile } = await db.from("profiles").select("status,full_name,email").eq("id", userId).maybeSingle();
  if (!profile || profile.status !== "active") return res.status(403).json({ error: "Account paused" });
  const { data: subscription } = await db.from("subscriptions").select("expires_at").eq("user_id", userId).maybeSingle();
  if (subscription?.expires_at && new Date(subscription.expires_at) < new Date()) return res.status(403).json({ error: "Subscription expired" });
  let input;
  try { input = body.parse(req.body); } catch (error) { return res.status(400).json({ error: "Extraction request contains invalid fields", issues: error instanceof z.ZodError ? validationIssues(error) : [] }); }

  if (input.action === "whoami") return res.json({ ok: true, name: profile.full_name || profile.email || "Connected" });
  const { data: cfg } = await db.from("app_settings").select("extraction_max_results,extraction_email_finder").eq("id", 1).maybeSingle();
  const cap = cfg?.extraction_max_results ?? null; // Super Admin limit, if configured
  const limitFor = (ext) => Math.min(ext.max_results ?? Infinity, cap ?? Infinity);

  if (input.action === "job") {
    const { data: jobs } = await db.from("lead_extractions").select("*").eq("user_id", userId).in("status", ["pending", "running"]).order("created_at").limit(1);
    const job = jobs?.[0] ?? null;
    if (!job) return res.json({ job: null });
    if (job.status === "pending") await db.from("lead_extractions").update({ status: "running", started_at: job.started_at ?? new Date().toISOString() }).eq("id", job.id);
    // A restarted extension re-processes listings that were in flight when it stopped.
    await db.from("extraction_items").update({ status: "pending", updated_at: new Date().toISOString() }).eq("extraction_id", job.id).eq("status", "processing");
    const limit = limitFor(job);
    return res.json({ job: { ...job, max_results: Number.isFinite(limit) ? limit : null, queries: buildSearchQueries(job.keyword, job.area_codes), find_emails: job.find_emails && cfg?.extraction_email_finder !== false } });
  }
  const { data: ext } = await db.from("lead_extractions").select("*").eq("id", input.id).eq("user_id", userId).maybeSingle();
  if (!ext) return res.status(404).json({ error: "Not found" });
  if (!["pending", "running"].includes(ext.status)) return res.json({ stop: true });
  const counts = async () => {
    const { data } = await db.from("extraction_items").select("status").eq("extraction_id", ext.id);
    const c = { pending: 0, processing: 0, completed: 0, partial: 0, failed: 0 };
    for (const r of data ?? []) if (r.status in c) c[r.status]++;
    return { ...c, total: (data ?? []).length };
  };

  if (input.action === "progress") {
    const patch = { current_area: input.area, areas_done: input.areasDone };
    if (input.query) patch.current_query = input.query;
    if (input.discoveryDone) patch.discovery_done = true;
    // Coverage is complete only if every search reached Google's end-of-list.
    if (input.endReached !== undefined) patch.end_reached = ext.end_reached === false ? false : input.endReached;
    await db.from("lead_extractions").update(patch).eq("id", ext.id);
    return res.json({ ok: true });
  }
  if (input.action === "queue") {
    const c = await counts();
    const room = Math.max(0, limitFor(ext) - c.total);
    const seen = new Set();
    const rows = input.listings
      .map((l) => ({ ...l, key: placeKey(l.maps_url) }))
      .filter((l) => !seen.has(l.key) && seen.add(l.key))
      .map((l) => ({ user_id: userId, extraction_id: ext.id, place_key: l.key, business_name: l.business_name.slice(0, 300), maps_url: l.maps_url, area: input.area || null, search_query: input.query }));
    // Listings already queued are ignored; the limit only applies when one was set.
    const { data: existing } = rows.length ? await db.from("extraction_items").select("place_key").eq("extraction_id", ext.id).in("place_key", rows.map((r) => r.place_key)) : { data: [] };
    const known = new Set((existing ?? []).map((r) => r.place_key));
    const fresh = rows.filter((r) => !known.has(r.place_key)).slice(0, Number.isFinite(room) ? room : undefined);
    if (fresh.length) {
      const { error } = await db.from("extraction_items").insert(fresh);
      if (error) return res.status(500).json({ error: error.message });
    }
    const total = c.total + fresh.length;
    const limited = rows.length - known.size > fresh.length;
    await db.from("lead_extractions").update({ found: total, ...(limited ? { coverage_note: `Stopped queuing at the ${limitFor(ext)}-business limit for this search.` } : {}) }).eq("id", ext.id);
    return res.json({ ok: true, queued: fresh.length, total, limited });
  }
  if (input.action === "next") {
    const { data: items } = await db.from("extraction_items").select("id,business_name,maps_url,area,attempts").eq("extraction_id", ext.id).eq("status", "pending").order("discovered_at").order("id").limit(input.limit);
    for (const it of items ?? []) await db.from("extraction_items").update({ status: "processing", attempts: it.attempts + 1, updated_at: new Date().toISOString() }).eq("id", it.id);
    return res.json({ items: items ?? [], counts: await counts() });
  }
  if (input.action === "results") {
    if (!input.item) {
      // Legacy extension versions: save a batch without per-listing status.
      const r = await saveBusinesses(db, userId, ext, input.area, input.businesses);
      await db.from("lead_extractions").update({ found: ext.found + input.businesses.length, saved: ext.saved + r.saved, failed: ext.failed + input.failed }).eq("id", ext.id);
      return res.json({ ok: true, saved: r.saved, duplicates: r.duplicates });
    }
    const { data: item } = await db.from("extraction_items").select("id,status").eq("id", input.item.id).eq("extraction_id", ext.id).maybeSingle();
    if (!item) return res.status(404).json({ error: "Listing not in this search queue" });
    const b = input.businesses[0];
    let status = input.item.status, error = input.item.error ?? null, leadId = null;
    if (b) {
      try { leadId = (await saveListing(db, userId, ext, input.area, b)).leadId; } catch (e) { status = "failed"; error = e.message.slice(0, 300); }
    } else status = "failed";
    await db.from("extraction_items").update({
      status, error, crm_lead_id: leadId, has_phone: !!b?.phone, has_email: !!b?.email, has_website: !!b?.website, updated_at: new Date().toISOString()
    }).eq("id", item.id);
    const c = await counts();
    await db.from("lead_extractions").update({ saved: c.completed + c.partial, failed: c.failed, found: c.total }).eq("id", ext.id);
    return res.json({ ok: true, saved: leadId ? 1 : 0, status, counts: c });
  }
  // complete: only when every queued listing has a final status.
  const c = await counts();
  if (!input.error && (c.pending || c.processing)) return res.json({ ok: false, remaining: c.pending + c.processing, counts: c });
  await syncToRecipients(db, userId);
  await db.from("lead_extractions").update({
    status: input.error ? "failed" : "completed", error: input.error ?? null, completed_at: new Date().toISOString(),
    areas_done: ext.area_codes.length || 1, found: c.total, saved: c.completed + c.partial, failed: c.failed
  }).eq("id", ext.id);
  return res.json({ ok: true, counts: c });
}
