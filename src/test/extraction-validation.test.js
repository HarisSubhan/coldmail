import { describe, it, expect } from "vitest";
import { businessInput, extensionInput, validationIssues } from "../../server/extraction-validation.js";
describe("extraction field validation", () => {
  it("keeps missing business information unavailable", () => {
    const row = businessInput.parse({ business_name: "Dental Clinics" });
    expect(row.email).toBeNull();
    expect(row.phone).toBeNull();
    expect(row.website).toBeNull();
  });
  it("normalizes available phones without inventing a country code", () => {
    expect(businessInput.parse({ business_name: "Dental Clinics", phone: "+92 (51) 123-4567" }).phone).toBe("+92511234567");
  });
  it("invalid optional contact data does not reject the whole results batch", () => {
    const result = extensionInput.parse({ action: "results", id: "08d466da-be4e-479e-800a-aab145e9a1a4", area: "44000", businesses: [{ business_name: "Dental Clinics", email: "contact@bad", website: "javascript:alert(1)" }] });
    if (result.action !== "results") throw new Error("Wrong action");
    expect(result.businesses[0]?.email).toBeNull();
    expect(result.businesses[0]?.website).toBeNull();
  });
  it("still rejects unnamed listings and identifies the offending field", () => {
    const parsed = extensionInput.safeParse({ action: "results", id: "08d466da-be4e-479e-800a-aab145e9a1a4", area: "44000", businesses: [{ business_name: "" }] });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Expected invalid input");
    expect(validationIssues(parsed.error).some((i) => i.field === "businesses.0.business_name")).toBe(true);
  });
});
