import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("eslint boundaries config", () => {
  it("declares module element types and forbids cross-module imports", () => {
    const config = readFileSync(".eslintrc.cjs", "utf8");
    expect(config).toContain('plugins: ["boundaries"]');
    expect(config).toContain("boundaries/dependencies");
    expect(config).toContain("modules");
  });
});
