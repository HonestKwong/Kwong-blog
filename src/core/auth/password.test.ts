import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("s3cret-pw");
    expect(hash).not.toBe("s3cret-pw");
    expect(await verifyPassword("s3cret-pw", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
