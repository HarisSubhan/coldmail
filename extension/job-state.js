// Stable listing identity: Google Maps feature id when present, else URL without tracking parameters.
export function listingKey(url) {
  const id = String(url).match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i)?.[1];
  if (id) return id.toLowerCase();
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname;
  } catch { return url; }
}

export function mergeListings(existing, incoming) {
  const rows = new Map(existing.map((row) => [listingKey(row.maps_url), row]));
  for (const row of incoming) {
    if (row.business_name && row.maps_url && !rows.has(listingKey(row.maps_url))) rows.set(listingKey(row.maps_url), row);
  }
  return [...rows.values()];
}

export function newCheckpoint(job, account) {
  return { jobId: job.id, account, areaIndex: job.areas_done || 0, listings: [], discoveryDone: false, pending: null };
}
