import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-routes";

describe("isPublicPath", () => {
  it("allows public blog, home, health, login and static assets", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/blog")).toBe(true);
    expect(isPublicPath("/blog/hello-world")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/auth/login")).toBe(true);
  });

  it("treats everything else as private", () => {
    expect(isPublicPath("/stocks")).toBe(false);
    expect(isPublicPath("/interview")).toBe(false);
    expect(isPublicPath("/english")).toBe(false);
    expect(isPublicPath("/api/stocks/list")).toBe(false);
  });
});
