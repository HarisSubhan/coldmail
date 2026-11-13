import { z } from "zod";

const optionalText = (max) => z.string().trim().max(max).nullish().transform((v) => v || null);
const webUrl = z.string().trim().max(2000).nullish().transform((v) => {
  if (!v) return null;
  try {
    const u = new URL(v);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
});
const optionalNumber = (min, max) => z.number().nullish().transform((v) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null));

export const businessInput = z.object({
  business_name: z.string().trim().min(1).max(300),
  category: optionalText(200),
  address: optionalText(500),
  phone: optionalText(60).transform((v) => (v ? v.replace(/[^\d+]/g, "") || null : null)),
  website: webUrl,
  email: optionalText(200).transform((v) => (v && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v.toLowerCase() : null)),
  maps_url: webUrl,
  place_id: optionalText(200),
  rating: optionalNumber(0, 5),
  reviews_count: optionalNumber(0, 100000000).transform((v) => (v === null ? null : Math.round(v))),
  open_status: optionalText(200),
  opening_hours: optionalText(1500),
  latitude: optionalNumber(-90, 90),
  longitude: optionalNumber(-180, 180)
});

/** A listing reference discovered in the search results (Stage A). */
export const listingInput = z.object({
  business_name: z.string().trim().min(1).max(300),
  maps_url: z.string().trim().url().max(2000)
});

const id = z.string().uuid();
export const extensionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("whoami") }),
  z.object({ action: z.literal("job") }),
  z.object({
    action: z.literal("progress"), id, area: z.string().max(40), areasDone: z.number().int().min(0).max(100),
    query: z.string().max(400).optional(), discoveryDone: z.boolean().optional(), endReached: z.boolean().optional()
  }),
  z.object({ action: z.literal("queue"), id, area: z.string().max(40), query: z.string().max(400), listings: z.array(listingInput).max(500) }),
  z.object({ action: z.literal("next"), id, limit: z.number().int().min(1).max(20).default(5) }),
  z.object({
    action: z.literal("results"), id, area: z.string().max(40), businesses: z.array(businessInput).max(200), failed: z.number().int().min(0).max(1000).default(0),
    item: z.object({ id, status: z.enum(["completed", "partial", "failed"]), error: z.string().max(300).optional() }).optional()
  }),
  z.object({ action: z.literal("complete"), id, error: z.string().max(500).optional() })
]);

export function validationIssues(error) {
  return error.issues.map((i) => ({ field: i.path.join("."), reason: i.message }));
}
