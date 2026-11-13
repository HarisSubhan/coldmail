import { dedupeBusinesses, dedupeKey, isEmailable } from "../src/lib/crm-sync.js";
import { ensureStages } from "./db.js";

export async function firstStageId(db, userId) {
  await ensureStages(userId);
  const { data } = await db.from("crm_stages").select("id").eq("user_id", userId).order("position").limit(1);
  return data?.[0]?.id ?? null;
}

/** Save a batch of scraped businesses as CRM leads (deduplicated per user). */
export async function saveBusinesses(db, userId, ext, area, rows) {
  const { data: existing } = await db.from("crm_leads").select("business_name,phone,maps_url").eq("user_id", userId).limit(20000);
  const keys = (existing ?? []).map(dedupeKey);
  const { rows: fresh, duplicates } = dedupeBusinesses(rows, keys);
  if (!fresh.length) return { saved: 0, duplicates };
  const stage = await firstStageId(db, userId);
  const { error } = await db.from("crm_leads").insert(fresh.map((b) => ({
    user_id: userId, extraction_id: ext.id, stage_id: stage,
    business_name: b.business_name.slice(0, 300), category: b.category ?? null, address: b.address ?? null,
    phone: b.phone ?? null, website: b.website ?? null, email: b.email ? b.email.toLowerCase() : null,
    maps_url: b.maps_url ?? null, city: ext.city, area_code: area || null, keyword: ext.keyword,
    search_location: [ext.city, area].filter(Boolean).join(" "), source: "lead_finder",
  })));
  if (error) throw new Error(error.message);
  return { saved: fresh.length, duplicates };
}

const ENRICH = ["category", "address", "phone", "website", "email", "maps_url", "place_id", "rating", "reviews_count", "open_status", "opening_hours", "latitude", "longitude"];

/**
 * Save one processed listing. An existing CRM lead with the same Maps identity is enriched
 * (missing fields filled, existing values kept) instead of duplicated. Returns the CRM lead id.
 */
export async function saveListing(db, userId, ext, area, b) {
  const key = dedupeKey(b);
  const place = b.maps_url?.match(/!1s([^!]+)/)?.[1];
  let q = db.from("crm_leads").select("*").eq("user_id", userId).limit(50);
  q = place ? q.like("maps_url", `%!1s${place}%`) : q.eq("business_name", b.business_name);
  const { data: candidates } = await q;
  const existing = (candidates ?? []).find((c) => dedupeKey(c) === key);
  const now = new Date().toISOString();
  if (existing) {
    const patch = { extracted_at: now };
    for (const f of ENRICH) if ((existing[f] === null || existing[f] === undefined) && b[f] != null) patch[f] = f === "email" ? String(b[f]).toLowerCase() : b[f];
    await db.from("crm_leads").update(patch).eq("id", existing.id);
    return { leadId: existing.id, duplicate: true };
  }
  const stage = await firstStageId(db, userId);
  const { data, error } = await db.from("crm_leads").insert({
    user_id: userId, extraction_id: ext.id, stage_id: stage,
    business_name: b.business_name.slice(0, 300),
    category: b.category ?? null, address: b.address ?? null, phone: b.phone ?? null, website: b.website ?? null,
    email: b.email ? b.email.toLowerCase() : null, maps_url: b.maps_url ?? null,
    place_id: b.place_id ?? null, rating: b.rating ?? null, reviews_count: b.reviews_count ?? null,
    open_status: b.open_status ?? null, opening_hours: b.opening_hours ?? null, latitude: b.latitude ?? null, longitude: b.longitude ?? null,
    city: ext.city, area_code: area || null, keyword: ext.keyword,
    search_location: [ext.city, area].filter(Boolean).join(" "), source: "lead_finder", extracted_at: now
  }).select("id").single();
  if (error) throw new Error(error.message);
  return { leadId: data.id, duplicate: false };
}

/** Make CRM leads with a valid email available as email recipients (leads table). */
export async function syncToRecipients(db, userId, crmIds) {
  let q = db.from("crm_leads").select("id,business_name,contact_person,email,website,city,phone,keyword,lead_id,unsubscribed").eq("user_id", userId).is("lead_id", null).not("email", "is", null);
  if (crmIds) q = q.in("id", crmIds);
  const { data: rows } = await q.limit(5000);
  const candidates = (rows ?? []).filter(isEmailable);
  if (!candidates.length) return 0;
  const { data: leads } = await db.from("leads").select("id,email").eq("user_id", userId);
  const byEmail = new Map((leads ?? []).map((l) => [l.email.toLowerCase(), l.id]));
  let created = 0;
  for (const c of candidates) {
    const email = c.email.toLowerCase();
    let leadId = byEmail.get(email);
    if (!leadId) {
      const { data: ins } = await db.from("leads").insert({ user_id: userId, email, name: c.contact_person, business_name: c.business_name, website: c.website, source: "crm", custom_fields: { city: c.city ?? "", phone: c.phone ?? "", keyword: c.keyword ?? "" } }).select("id").single();
      if (!ins) continue;
      leadId = ins.id;
      byEmail.set(email, leadId);
      created++;
    }
    await db.from("crm_leads").update({ lead_id: leadId }).eq("id", c.id);
  }
  return created;
}
