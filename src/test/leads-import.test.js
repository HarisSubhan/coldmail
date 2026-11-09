import { describe, expect, it } from "vitest";
import { isValidEmail, prepareLeads } from "@/lib/leads-import";
describe("lead import", () => {
  it("rejects invalid emails", () => {
    expect(isValidEmail("bad@")).toBe(false);
    expect(isValidEmail("a@b.co")).toBe(true);
  });
  it("drops duplicates within file and against existing leads, case-insensitively", () => {
    const r = prepareLeads(
      [{ Email: "A@x.com" }, { email: "a@x.com" }, { email: "old@x.com" }, { email: "new@x.com" }],
      ["OLD@x.com"]
    );
    expect(r.leads.map((l) => l.email)).toEqual(["a@x.com", "new@x.com"]);
    expect(r.duplicates).toBe(2);
  });
  it("maps known columns and keeps unknown columns as custom fields", () => {
    const r = prepareLeads([{ "Company Name": "Acme", Email: "z@acme.io", City: "Lahore" }]);
    expect(r.leads[0].business_name).toBe("Acme");
    expect(r.leads[0].custom_fields).toEqual({ City: "Lahore" });
  });
});
