const DEFAULT_STAGES = ["New Leads", "Contacted", "Email Sent", "Follow-up Required", "Interested", "Meeting Scheduled", "Converted", "Not Interested", "Closed / Lost"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isValidEmail = (e) => !!e && EMAIL_RE.test(e.trim());
const digits = (s) => (s ?? "").replace(/\D/g, "");
function dedupeKey(b) {
  const place = b.maps_url?.match(/!1s([^!]+)/)?.[1] ?? b.maps_url?.split("?")[0];
  if (place) return `m:${place}`;
  return `p:${digits(b.phone)}:${b.business_name.trim().toLowerCase()}`;
}
function dedupeBusinesses(rows, existingKeys = []) {
  const seen = new Set(existingKeys);
  const out = [];
  let duplicates = 0;
  for (const r of rows) {
    if (!r.business_name?.trim()) continue;
    const k = dedupeKey(r);
    if (seen.has(k)) {
      duplicates++;
      continue;
    }
    seen.add(k);
    out.push(r);
  }
  return { rows: out, duplicates };
}
const isEmailable = (l) => isValidEmail(l.email) && !l.unsubscribed;
function extractEmail(html) {
  const found = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const ok = found.map((e) => e.toLowerCase()).find((e) => !/\.(png|jpe?g|gif|svg|webp)$/.test(e) && !/example\.|sentry|wixpress|domain\.com/.test(e));
  return ok ?? null;
}
function dateRange(preset, now = /* @__PURE__ */ new Date(), from, to) {
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const add = (d, n) => new Date(d.getTime() + n * 864e5);
  const today = day(now);
  switch (preset) {
    case "today":
      return { gte: today.toISOString(), lt: add(today, 1).toISOString() };
    case "yesterday":
      return { gte: add(today, -1).toISOString(), lt: today.toISOString() };
    case "7d":
      return { gte: add(today, -6).toISOString(), lt: add(today, 1).toISOString() };
    case "30d":
      return { gte: add(today, -29).toISOString(), lt: add(today, 1).toISOString() };
    case "custom":
      return {
        gte: from ? (/* @__PURE__ */ new Date(from + "T00:00:00")).toISOString() : void 0,
        lt: to ? add(/* @__PURE__ */ new Date(to + "T00:00:00"), 1).toISOString() : void 0
      };
    default:
      return {};
  }
}
export {
  DEFAULT_STAGES,
  dateRange,
  dedupeBusinesses,
  dedupeKey,
  extractEmail,
  isEmailable,
  isValidEmail
};
