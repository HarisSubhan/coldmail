import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("extension/listing-details.js", "utf8");
const readDetails = new Function(source.replace(/export /g, "") + ";return readListingDetails;")();
const discover = new Function(source.replace(/export /g, "").replace("const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));", "const wait = async () => {};") + ";return discoverListings;")();
const fast = { settleMs: 0, patienceMs: 0 };

function virtualFeed(total, { lazyPage = 0, stalls = false } = {}) {
  document.body.innerHTML = '<div role="feed"></div>';
  const feed = document.querySelector('[role="feed"]');
  let top = 0, loaded = lazyPage || total, bottomHits = 0;
  const height = () => loaded * 100 + 1000;
  const render = () => {
    const first = Math.floor(top / 100);
    feed.innerHTML = Array.from({ length: Math.max(0, Math.min(10, loaded - first)) }, (_, i) => `<a class="hfpxzc" aria-label="Salon ${first + i}" href="https://www.google.com/maps/place/Salon${first + i}"></a>`).join("")
      + (loaded >= total && top >= height() - 1000 ? "<span>You've reached the end of the list.</span>" : "");
  };
  Object.defineProperties(feed, {
    clientHeight: { value: 1000 }, scrollHeight: { get: height },
    scrollTop: { get: () => top, set: (v) => {
      top = Math.max(0, Math.min(height() - 1000, v));
      // Lazy loading: the next page arrives only after the panel has sat at the bottom for a while.
      if (top >= height() - 1000 && !stalls && loaded < total && ++bottomHits % 3 === 0) loaded = Math.min(total, loaded + lazyPage);
      render();
    } }
  });
  render();
}

describe("extension business listing contacts", () => {
  it("reads the phone and website from the individual listing, not a result card", () => {
    document.body.innerHTML = `<h1 class="DUwDvf">City Dental</h1><button data-item-id="phone:tel:+92511234567">Call</button><a data-item-id="authority" href="https://citydental.test">Website</a><button data-item-id="address"><span class="Io6YTe">12 Main Road</span></button>`;
    expect(readDetails()).toMatchObject({ business_name: "City Dental", phone: "+92511234567", website: "https://citydental.test/", address: "12 Main Road" });
  });
  it("reads rating, hours, place id and coordinates when the listing shows them", () => {
    window.history.pushState({}, "", "/maps/place/City+Dental/data=!4m7!3m6!1s0x38df:0xb01e!8m2!3d33.6933549!4d73.013593!19sChIJ5z5L8Iq");
    document.body.innerHTML = `<h1 class="DUwDvf">City Dental</h1><div class="F7nice"><span aria-hidden="true">4.5</span><span aria-label="1,234 reviews"></span></div><button aria-label="Show open hours for the week">Open · Closes 11 PM</button><table class="eK4R0e"><tr><td>Friday</td><td>11 AM–11 PM</td></tr></table>`;
    expect(readDetails("0x38df:0xb01e")).toMatchObject({ rating: 4.5, reviews_count: 1234, open_status: "Open · Closes 11 PM", opening_hours: "Friday 11 AM–11 PM", place_id: "ChIJ5z5L8Iq", latitude: 33.6933549, longitude: 73.013593 });
  });
  it("refuses to attribute details when the page still shows a different business", () => {
    window.history.pushState({}, "", "/maps/place/Other/data=!1s0x38df:0xaaaa");
    document.body.innerHTML = `<h1 class="DUwDvf">Other Salon</h1>`;
    expect(readDetails("0x38df:0xbbbb")).toBeNull();
  });
  it("returns a public email when the listing provides one", () => {
    document.body.innerHTML = `<h1>City Dental</h1><a href="mailto:Office@CityDental.test?subject=Hello">Email</a>`;
    expect(readDetails().email).toBe("office@citydental.test");
  });
  it("does not invent missing contact details", () => {
    document.body.innerHTML = `<h1>City Dental</h1>`;
    expect(readDetails()).toMatchObject({ phone: null, website: null, email: null });
  });
  it("does not treat a loading page as a business", () => {
    document.body.innerHTML = `<div>Loading</div>`;
    expect(readDetails()).toBeNull();
  });
  it("collects all 150 virtualized cards from first to last with no record limit", async () => {
    virtualFeed(150);
    const { listings, endReached } = await discover(0, null, fast);
    expect(listings).toHaveLength(150);
    expect(listings[0].business_name).toBe("Salon 0");
    expect(listings[149].business_name).toBe("Salon 149");
    expect(endReached).toBe(true);
  });
  it("keeps waiting at the bottom while Maps loads more, going past the first 20 results to 120", async () => {
    virtualFeed(120, { lazyPage: 20 });
    const { listings, endReached } = await discover(0, null, { settleMs: 0, patienceMs: 50 });
    expect(listings).toHaveLength(120);
    expect(endReached).toBe(true);
  });
  it("reports honestly when the list stops loading without Google's end-of-list message", async () => {
    virtualFeed(60, { lazyPage: 20, stalls: true });
    const result = await discover(0, null, fast);
    expect(result.endReached).toBe(false);
    expect(result.reason).toBe("no-more-loading");
    expect(result.listings).toHaveLength(20);
  });
  it("does not give up after the search window was hidden for a while", async () => {
    virtualFeed(120, { lazyPage: 20 });
    let hiddenChecks = 0;
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hiddenChecks++ < 40 ? "hidden" : "visible") });
    globalThis.chrome = { runtime: { sendMessage: async () => ({ paused: false }) } };
    const { listings } = await discover(0, { jobId: "j", areaIndex: 0, listings: [] }, { settleMs: 0, patienceMs: 50 });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    expect(listings).toHaveLength(120);
  });
});
