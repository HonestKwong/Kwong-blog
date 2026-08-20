import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();

vi.mock("@/core/db/client", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      create: (...a: unknown[]) => create(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

vi.mock("@/core/auth/password", () => ({
  hashPassword: vi.fn(async () => "hashed"),
}));

describe("seedAdmin", () => {
  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
    update.mockReset();
    vi.resetModules();
  });

  it("creates a user when missing", async () => {
    findUnique.mockResolvedValue(null);
    const { seedAdmin } = await import("./seed-admin");
    await seedAdmin({ email: "a@b.c", password: "pw" });
    expect(create).toHaveBeenCalled();
  });

  it("updates password when user exists", async () => {
    findUnique.mockResolvedValue({ id: "u1", email: "a@b.c" });
    const { seedAdmin } = await import("./seed-admin");
    await seedAdmin({ email: "a@b.c", password: "pw" });
    expect(update).toHaveBeenCalledWith({
      where: { email: "a@b.c" },
      data: { passwordHash: "hashed" },
    });
  });
});
