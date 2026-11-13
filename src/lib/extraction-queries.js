/** Google Maps queries for an extraction: the user's keyword exactly, plus one extra query per explicitly entered area code. */
export function buildSearchQueries(keyword, areaCodes = []) {
  const exact = (keyword ?? "").trim();
  if (!exact) return [];
  const areas = areaCodes.map((a) => (a ?? "").trim()).filter(Boolean);
  return areas.length ? areas.map((a) => `${exact} ${a}`) : [exact];
}

/** Stable identity of a Google Maps listing: its feature id when present, otherwise the URL without query/tracking parts. */
export function placeKey(url) {
  const id = String(url ?? "").match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i)?.[1];
  if (id) return id.toLowerCase();
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}
