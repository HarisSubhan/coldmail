import { describe, expect, it } from "vitest";
import { buildSearchQueries, placeKey } from "../lib/extraction-queries.js";

describe("exact Google Maps search query", () => {
  it("searches the keyword exactly as entered, without adding city or codes", () => {
    expect(buildSearchQueries("saloons in Islamabad")).toEqual(["saloons in Islamabad"]);
  });
  it("keeps a postal code the user typed inside the keyword", () => {
    expect(buildSearchQueries("dentists 44000 Islamabad")).toEqual(["dentists 44000 Islamabad"]);
  });
  it("adds area codes only when the user entered them, one search each", () => {
    expect(buildSearchQueries("saloons in Islamabad", ["44000", "44010"])).toEqual(["saloons in Islamabad 44000", "saloons in Islamabad 44010"]);
  });
  it("keeps two branches with different Maps identities separate", () => {
    const a = placeKey("https://www.google.com/maps/place/Glam/data=!4m7!3m6!1s0x38df:0x6a57!8m2");
    const b = placeKey("https://www.google.com/maps/place/Glam/data=!4m7!3m6!1s0x38df:0x9999!8m2");
    expect(a).not.toBe(b);
    expect(placeKey("https://www.google.com/maps/place/Glam/data=!1s0x38df:0x6a57?entry=ttu")).toBe(a);
  });
});
