import { discoverListings, readListingDetails } from "./listing-details.js";
import { listingKey, mergeListings, newCheckpoint } from "./job-state.js";
// Origami99 Maps Extractor — two-stage engine:
//  Stage A: search the exact query in a visible window, scroll to the end, queue every listing on the server.
//  Stage B: take queued listings one by one, open each, save available details (missing fields stay empty).
let busy = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const setStatus = (status) => chrome.storage.local.set({ status });

async function api(action, extra = {}) {
  const { url, tok } = await chrome.storage.local.get(["url", "tok"]);
  if (!url || !tok) throw new Error("Not connected");
  const r = await fetch(url + "/api/public/extension", {
    signal: AbortSignal.timeout(20000),
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + tok },
    body: JSON.stringify({ action, ...extra }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const error = new Error([j.error || "Request failed " + r.status, ...(j.issues || []).map((issue) => issue.field + ": " + issue.reason)].join(" · "));
    error.status = r.status; throw error;
  }
  return j;
}

async function retryApi(action, extra = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await api(action, extra); }
    catch (error) {
      if (attempt === 2 || error.status && error.status < 500 && error.status !== 429) throw error;
      await sleep(1000 * 2 ** attempt);
    }
  }
}

// Queue listings on the server in chunks; the server ignores ones already queued.
async function queueListings(cp, job, listings) {
  const fresh = listings.filter((l) => !cp.queued.includes(listingKey(l.maps_url)));
  for (let i = 0; i < fresh.length; i += 200) {
    const chunk = fresh.slice(i, i + 200);
    const r = await retryApi("queue", { id: job.id, area: job.area_codes?.[cp.areaIndex] || "", query: job.queries[cp.areaIndex], listings: chunk.map(({ business_name, maps_url }) => ({ business_name, maps_url })) });
    if (r.stop) return r;
    cp.queued.push(...chunk.map((l) => listingKey(l.maps_url)));
    cp.total = r.total;
  }
  return { ok: true };
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.type === "discovery-checkpoint") {
    (async () => {
      const stored = await chrome.storage.local.get(["checkpoint", "paused"]);
      const cp = stored.checkpoint;
      if (cp && cp.jobId === message.jobId && cp.areaIndex === message.areaIndex && sender.tab?.id === cp.tabId) {
        cp.listings = mergeListings(cp.listings, message.listings);
        await chrome.storage.local.set({ checkpoint: cp });
        if (message.hidden || message.stuck) await bringToFront(cp);
        await setStatus(message.hidden
          ? "Waiting: keep the Origami99 search window visible (not minimised) so Google Maps keeps loading results."
          : `Discovering results… ${cp.listings.length} businesses found so far for “${cp.query}”`);
      }
      reply({ paused: !!stored.paused });
    })().catch(() => reply({ paused: true }));
    return true;
  }
  if (sender.tab) return;
  if (message.type === "pause" || message.type === "resume") {
    chrome.storage.local.set({ paused: message.type === "pause" }).then(async () => {
      await setStatus(message.type === "pause" ? "Paused. Progress saved." : "Resuming saved search…");
      reply({ msg: message.type === "pause" ? "Paused" : "Resuming" });
      if (message.type === "resume") tick();
    });
    return true;
  }
  if (message.type === "check") {
    api("whoami").then((result) => { setStatus("Connected as " + result.name + ". Waiting for searches…"); reply({ msg: "Connected as " + result.name }); tick(); })
      .catch((error) => { setStatus(error.message); reply({ msg: error.message }); });
    return true;
  }
});

chrome.alarms.create("poll", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => tick());
chrome.runtime.onStartup.addListener(() => tick());

function extractEmail(html) {
  const found = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return found.map((e) => e.toLowerCase()).find((e) => !/\.(png|jpe?g|gif|svg|webp)$/.test(e) && !/example\.|sentry|wixpress|domain\.com/.test(e)) || null;
}
async function findEmail(site) {
  for (const path of ["", "/contact", "/contact-us"]) {
    try {
      const u = new URL(path, site).href;
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
      let html;
      try { const response = await fetch(u, { signal: ctl.signal, credentials: "omit" }); if (!response.ok) continue; html = await response.text(); } finally { clearTimeout(t); }
      const e = extractEmail(html); if (e) return e;
    } catch {}
  }
  return null;
}

async function openPage(tabId, url) {
  await chrome.tabs.update(tabId, { url, active: true });
  for (let attempt = 0; attempt < 40; attempt++) {
    await sleep(500);
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") { await sleep(1200); return; }
  }
  throw new Error("Google Maps page timed out");
}

async function readDetails(tabId, listing) {
  await openPage(tabId, listing.maps_url);
  const key = listingKey(listing.maps_url);
  for (let attempt = 0; attempt < 12; attempt++) {
    const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: readListingDetails, args: [key] });
    if (result?.result) return result.result;
    await sleep(750);
  }
  throw new Error("Business details unavailable");
}

// Covered or minimised windows stop Google Maps from loading more results: bring the search window back (at most every 5s).
let lastFront = 0;
async function bringToFront(cp) {
  if (Date.now() - lastFront < 5000) return;
  lastFront = Date.now();
  try {
    if (cp.windowId && chrome.windows?.update) await chrome.windows.update(cp.windowId, { state: "normal", focused: true });
  } catch {}
}

// A dedicated, visible window: Google Maps only loads more results while its page is visible.
async function openWorkWindow() {
  if (chrome.windows?.create) {
    const win = await chrome.windows.create({ url: "about:blank", focused: true, width: 1200, height: 900, type: "normal" });
    return { windowId: win.id, tabId: win.tabs[0].id };
  }
  const tab = await chrome.tabs.create({ url: "about:blank", active: true });
  return { windowId: null, tabId: tab.id };
}
async function closeWorkWindow(cp) {
  if (cp.windowId && chrome.windows?.remove) await chrome.windows.remove(cp.windowId).catch(() => {});
  else if (cp.tabId) await chrome.tabs.remove(cp.tabId).catch(() => {});
}

async function runJob(job) {
  const queries = job.queries?.length ? job.queries : [job.keyword];
  job.queries = queries;
  const stored = await chrome.storage.local.get(["checkpoint", "tok"]);
  let cp = stored.checkpoint?.jobId === job.id && stored.checkpoint.account === stored.tok ? stored.checkpoint : newCheckpoint(job, stored.tok);
  cp.queued ||= []; cp.total ||= 0;
  if (job.discovery_done) cp.discoveryDone = true;
  await closeWorkWindow(cp); // orphaned window from a suspended worker
  Object.assign(cp, await openWorkWindow());
  const save = () => chrome.storage.local.set({ checkpoint: cp });
  const stopped = async () => { await chrome.storage.local.remove("checkpoint"); await setStatus("Search stopped"); };
  const checkPause = async () => { if ((await chrome.storage.local.get("paused")).paused) throw new Error("Extraction paused"); };
  const deliver = async () => {
    if (!cp.pending) return false;
    const { item, business, status, error } = cp.pending;
    const response = await retryApi("results", { id: job.id, area: item.area || "", businesses: business ? [business] : [], item: { id: item.id, status, ...(error ? { error } : {}) } });
    if (response.stop) { await stopped(); return true; }
    cp.counts = response.counts; cp.pending = null;
    await save();
    return false;
  };
  try {
    await save();
    // ---- Stage A: complete listing discovery for each exact query ----
    while (!cp.discoveryDone) {
      await checkPause();
      const query = queries[cp.areaIndex];
      cp.query = query; await save();
      const area = job.area_codes?.[cp.areaIndex] || "";
      const progress = await retryApi("progress", { id: job.id, area, areasDone: cp.areaIndex, query });
      if (progress.stop) return stopped();
      await setStatus(`Searching Google Maps for exactly: “${query}” (search ${cp.areaIndex + 1} of ${queries.length})`);
      // Up to 4 passes: if Maps stops loading before its end-of-list message, reload the search and keep scrolling.
      let found = { listings: [], endReached: false };
      for (let pass = 0; pass < 4; pass++) {
        await checkPause();
        const before = cp.listings.length;
        await bringToFront(cp);
        await openPage(cp.tabId, "https://www.google.com/maps/search/" + encodeURIComponent(query) + "?hl=en");
        const [result] = await chrome.scripting.executeScript({ target: { tabId: cp.tabId }, func: discoverListings, args: [job.max_results || 0, { jobId: job.id, areaIndex: cp.areaIndex, listings: cp.listings }] });
        found = result?.result || { listings: [], endReached: false };
        cp.listings = mergeListings((await chrome.storage.local.get("checkpoint")).checkpoint?.listings || cp.listings, found.listings);
        await save();
        if (found.endReached || found.reason === "limit" || found.reason === "single-result" || (pass > 0 && cp.listings.length === before)) break;
        await setStatus(`Google Maps paused at ${cp.listings.length} results for “${query}”. Reloading to continue (attempt ${pass + 2} of 4)…`);
        lastFront = 0;
      }
      const queued = await queueListings(cp, job, cp.listings);
      if (queued.stop) return stopped();
      const last = cp.areaIndex + 1 >= queries.length;
      const done = await retryApi("progress", { id: job.id, area, areasDone: cp.areaIndex + 1, query, discoveryDone: last, endReached: !!found.endReached });
      if (done.stop) return stopped();
      if (last) cp.discoveryDone = true; else cp.areaIndex++;
      cp.listings = [];
      await save();
    }
    // ---- Stage B: process every queued listing individually ----
    if (await deliver()) return;
    for (;;) {
      await checkPause();
      const next = await retryApi("next", { id: job.id, limit: 5 });
      if (next.stop) return stopped();
      if (!next.items.length) break;
      for (const item of next.items) {
        await checkPause();
        const c = next.counts;
        await setStatus(`“${job.name}”: ${item.business_name} · done ${(cp.counts?.completed ?? c.completed) + (cp.counts?.partial ?? c.partial)} of ${c.total} · failed ${cp.counts?.failed ?? c.failed}`);
        let business = null, error = null;
        for (let attempt = 0; attempt < 3 && !business; attempt++) {
          try { business = await readDetails(cp.tabId, item); }
          catch (e) {
            if (/Access check/.test(e.message)) throw e;
            error = e.message;
            if (attempt < 2) { await checkPause(); await sleep(1000 * 2 ** attempt); }
          }
        }
        // Never discard a discovered business: save what the results list provided and mark it partial.
        const status = business ? "completed" : "partial";
        business ||= { business_name: item.business_name, maps_url: item.maps_url };
        if (job.find_emails && !business.email && business.website) business.email = await findEmail(business.website);
        cp.pending = { item, business, status, error: business && status === "completed" ? null : error };
        await save();
        if (await deliver()) return;
        await sleep(800);
      }
    }
    const complete = await retryApi("complete", { id: job.id });
    if (complete.ok === false) { await setStatus(`${complete.remaining} businesses still queued; continuing on the next check.`); return; }
    await chrome.storage.local.remove("checkpoint");
    const c = complete.counts || {};
    await setStatus(`Finished “${job.name}”: ${c.total ?? 0} discovered · ${c.completed ?? 0} completed · ${c.partial ?? 0} partial · ${c.failed ?? 0} failed.`);
  } catch (error) {
    // Keep the server job running and save progress instead of failing a recoverable interruption.
    await chrome.storage.local.set({ paused: true });
    await setStatus(error.message === "Extraction paused" ? "Paused. Progress saved; click Resume to continue." : "Paused: " + error.message + ". Progress saved; resolve the issue and click Resume.");
  } finally {
    await closeWorkWindow(cp);
  }
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    if ((await chrome.storage.local.get("paused")).paused) return;
    const { job } = await retryApi("job");
    if (job) await runJob(job);
  } catch (e) {
    if (e.message !== "Not connected") setStatus(e.message);
  } finally { busy = false; }
}
