import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
vi.mock("@/core/db/client", () => ({
  prisma: { $queryRaw: (...args: unknown[]) => queryRaw(...args) },
}));

describe("getHealth", () => {
  beforeEach(() => {
    queryRaw.mockReset();
    vi.resetModules();
  });

  it("reports ok when database responds", async () => {
    queryRaw.mockResolvedValue([{ ok: 1 }]);
    const { getHealth } = await import("./health");
    const result = await getHealth();
    expect(result).toMatchObject({ status: "ok", db: "up" });
    expect(() => new Date(result.time).toISOString()).not.toThrow();
  });

  it("reports degraded when database fails", async () => {
    queryRaw.mockRejectedValue(new Error("db down"));
    const { getHealth } = await import("./health");
    const result = await getHealth();
    expect(result).toMatchObject({ status: "degraded", db: "down" });
  });
});
