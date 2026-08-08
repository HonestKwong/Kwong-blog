import { describe, expect, it } from "vitest";
import { getHealth } from "./health";

describe("getHealth", () => {
  it("returns ok status with an ISO timestamp", () => {
    const result = getHealth();
    expect(result.status).toBe("ok");
    expect(() => new Date(result.time).toISOString()).not.toThrow();
    expect(new Date(result.time).toISOString()).toBe(result.time);
  });
});
