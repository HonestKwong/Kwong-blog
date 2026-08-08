import { describe, expect, it } from "vitest";
import { prisma } from "./client";

describe("prisma client", () => {
  it("exposes the user delegate", () => {
    expect(prisma.user).toBeDefined();
    expect(typeof prisma.user.findUnique).toBe("function");
  });
});
