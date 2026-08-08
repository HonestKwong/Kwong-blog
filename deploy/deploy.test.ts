import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("deploy.sh", () => {
  const script = readFileSync("deploy/deploy.sh", "utf8");

  it("pulls and recreates only kwong-web", () => {
    expect(script).toContain("docker compose");
    expect(script).toContain("up -d --no-deps --force-recreate kwong-web");
    expect(script).not.toContain("compose down");
    expect(script).not.toMatch(/restart\s+xray/);
    expect(script).not.toMatch(/restart\s+nginx/);
  });

  it("health-checks and rolls back previous image on failure", () => {
    expect(script).toContain("/api/health");
    expect(script).toContain("PREVIOUS_IMAGE");
    expect(script).toContain("rollback");
  });
});
