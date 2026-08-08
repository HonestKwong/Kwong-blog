import { beforeAll, describe, expect, it } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE,
} from "./session";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-that-is-long-enough-000000";
});

describe("session token", () => {
  it("round-trips a valid token", async () => {
    const token = await createSessionToken({ userId: "u1" });
    const parsed = await verifySessionToken(token);
    expect(parsed?.userId).toBe("u1");
  });

  it("rejects a tampered token", async () => {
    expect(await verifySessionToken("not.a.jwt")).toBeNull();
  });

  it("exposes a stable cookie name", () => {
    expect(SESSION_COOKIE).toBe("kwong_session");
  });
});
