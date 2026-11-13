import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stateSource = readFileSync("extension/job-state.js", "utf8").replace(/export /g, "");
const background = readFileSync("extension/background.js", "utf8")
  .replace(/^import .*;\n/gm, "")
  .replace("const sleep = (ms) => new Promise((r) => setTimeout(r, ms));", "const sleep = async () => {};");
const load = new Function("chrome", "fetch", "discoverListings", "readListingDetails", stateSource + "\n" + background + "\nreturn {runJob, mergeListings, newCheckpoint};");

/** In-memory stand-in for the Origami99 extension API queue. */
function fakeServer() {
  const items = []; const saved = []; let failNextResult = false; let ext = {};
  const counts = () => { const c = { pending: 0, processing: 0, completed: 0, partial: 0, failed: 0, total: items.length }; for (const i of items) c[i.status]++; return c; };
  const handle = (b) => {
    switch (b.action) {
      case "progress": Object.assign(ext, b); return { ok: true };
      case "queue": for (const l of b.listings) if (!items.some((i) => i.maps_url === l.maps_url)) items.push({ id: crypto.randomUUID(), ...l, area: b.area, query: b.query, status: "pending" }); return { ok: true, total: items.length };
      case "next": { const n = items.filter((i) => i.status === "pending").slice(0, b.limit); n.forEach((i) => (i.status = "processing")); return { items: n.map((i) => ({ ...i })), counts: counts() }; }
      case "results": {
        if (failNextResult) { failNextResult = false; return { status: 503, body: { error: "Temporary outage" } }; }
        const it = items.find((i) => i.id === b.item.id); it.status = b.item.status; saved.push(b.businesses[0]); return { ok: true, counts: counts() };
      }
      case "complete": { const c = counts(); return c.pending || c.processing ? { ok: false, remaining: c.pending + c.processing } : { ok: true, counts: c }; }
    }
    return { ok: true };
  };
  const fetch = async (_url, options) => {
    const r = handle(JSON.parse(options.body));
    return r.status ? { ok: false, status: r.status, json: async () => r.body } : { ok: true, json: async () => r };
  };
  return { items, saved, ext, fetch, failOnce: () => (failNextResult = true), resetProcessing: () => items.forEach((i) => i.status === "processing" && (i.status = "pending")) };
}

function fakeChrome(stored, listings, details) {
  const opened = [];
  return { opened, chrome: {
    storage: { local: {
      get: async (keys) => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, structuredClone(stored[key])])),
      set: async (values) => Object.assign(stored, structuredClone(values)),
      remove: async (key) => { delete stored[key]; }
    } },
    runtime: { onMessage: { addListener() {} }, onStartup: { addListener() {} } },
    alarms: { create() {}, onAlarm: { addListener() {} } },
    windows: { create: async () => ({ id: 9, tabs: [{ id: 1 }] }), remove: async () => {} },
    tabs: { create: async () => ({ id: 1 }), update: async (_id, { url }) => { opened.push(url); }, get: async () => ({ status: "complete" }), remove: async () => {} },
    scripting: { executeScript: async ({ func }) => {
      if (func.name === "discoverListings") return [{ result: { listings, endReached: true } }];
      return [{ result: details(opened[opened.length - 1]) }];
    } }
  } };
}

const listings = Array.from({ length: 120 }, (_, i) => ({ business_name: `Salon ${i}`, maps_url: `https://www.google.com/maps/place/Salon${i}/data=!1s0x1:0x${i.toString(16)}` }));
const job = { id: "search-1", name: "Saloons", keyword: "saloons in Islamabad", queries: ["saloons in Islamabad"], area_codes: [], max_results: null, areas_done: 0 };

describe("extension two-stage extraction", () => {
  it("searches the exact keyword, queues all 120 listings and processes each, keeping ones without contacts", async () => {
    const server = fakeServer();
    const stored = { url: "https://app.test", tok: "t" };
    // Every third listing has no phone/website; listing 7's detail page never loads.
    const { chrome, opened } = fakeChrome(stored, listings, (url) => {
      const i = Number(url.match(/Salon(\d+)/)?.[1]);
      if (i === 7) return null;
      return { business_name: `Salon ${i}`, maps_url: url, phone: i % 3 ? "+92300000" + i : null, website: null, email: null };
    });
    await load(chrome, server.fetch, function discoverListings() {}, function readListingDetails() {}).runJob(structuredClone(job));
    expect(opened[0]).toBe("https://www.google.com/maps/search/saloons%20in%20Islamabad?hl=en");
    expect(server.items).toHaveLength(120);
    expect(server.items.filter((i) => i.status === "completed")).toHaveLength(119);
    expect(server.items.find((i) => i.business_name === "Salon 7").status).toBe("partial");
    expect(server.saved).toHaveLength(120);
    expect(server.saved.filter((b) => !b.phone).length).toBeGreaterThan(30);
    expect(stored["checkpoint"]).toBeUndefined();
  });

  it("replays a result whose upload was interrupted without reopening its listing", async () => {
    const server = fakeServer();
    const stored = { url: "https://app.test", tok: "t" };
    const two = listings.slice(0, 2);
    const { chrome, opened } = fakeChrome(stored, two, (url) => ({ business_name: "x", maps_url: url, phone: "+92511234567" }));
    const ext = load(chrome, server.fetch, function discoverListings() {}, function readListingDetails() {});
    // Three consecutive failures exhaust retries: fail the first upload persistently.
    let failures = 3; const realFetch = server.fetch;
    const flaky = async (u, o) => (JSON.parse(o.body).action === "results" && failures-- > 0 ? { ok: false, status: 503, json: async () => ({ error: "Temporary outage" }) } : realFetch(u, o));
    await load(chrome, flaky, function discoverListings() {}, function readListingDetails() {}).runJob(structuredClone({ ...job, max_results: 2 }));
    expect(stored["paused"]).toBe(true);
    expect(stored["checkpoint"].pending.business.phone).toBe("+92511234567");
    const detailVisits = opened.filter((u) => u.includes("/place/")).length;
    stored["paused"] = false; server.resetProcessing();
    await ext.runJob(structuredClone({ ...job, discovery_done: true }));
    expect(server.items.every((i) => i.status === "completed")).toBe(true);
    expect(opened.filter((u) => u.includes("/place/")).length - detailVisits).toBe(1); // only the second listing
    expect(stored["checkpoint"]).toBeUndefined();
  });

  it("deduplicates the same listing despite tracking parameters", () => {
    const helpers = new Function(stateSource + ";return {mergeListings};")();
    const rows = helpers.mergeListings([{ business_name: "Dental", maps_url: "https://www.google.com/maps/place/Dental/data=!1s0x1:0x2?entry=1" }], [{ business_name: "Dental", maps_url: "https://www.google.com/maps/place/Dental/data=!1s0x1:0x2?entry=2" }]);
    expect(rows).toHaveLength(1);
  });
  it("reloads the search and keeps going when Google Maps stops loading at 29 of 117 results", async () => {
    const server = fakeServer();
    const stored = { url: "https://app.test", tok: "t" };
    const all = Array.from({ length: 117 }, (_, i) => listings[i] ?? { business_name: `Salon ${i}`, maps_url: `https://www.google.com/maps/place/Salon${i}/data=!1s0x1:0x${i.toString(16)}` });
    const { chrome } = fakeChrome(stored, [], (url) => ({ business_name: "x", maps_url: url }));
    const passes = [{ listings: all.slice(0, 29), endReached: false, reason: "no-more-loading" }, { listings: all, endReached: true, reason: "end" }];
    let discoveryRuns = 0;
    const exec = chrome.scripting.executeScript;
    chrome.scripting.executeScript = async (args) => args.func.name === "discoverListings" ? [{ result: passes[discoveryRuns++] }] : exec(args);
    await load(chrome, server.fetch, function discoverListings() {}, function readListingDetails() {}).runJob(structuredClone(job));
    expect(discoveryRuns).toBe(2);
    expect(server.items).toHaveLength(117);
  });
});
