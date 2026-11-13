import { describe, expect, it } from "vitest";
import { assertMonitoringRole } from "../../server/monitoring-access.js";
describe("Super Admin monitoring permissions", () => {
  it("rejects regular users", () => {
    expect(() => assertMonitoringRole(false, false)).toThrow("Forbidden");
  });
  it("rejects a failed role lookup even when its data claims admin", () => {
    expect(() => assertMonitoringRole(true, true)).toThrow("Forbidden");
  });
  it("allows a verified Super Admin", () => {
    expect(() => assertMonitoringRole(true, false)).not.toThrow();
  });
});
