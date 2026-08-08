import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("deploy compose fragment", () => {
  const yaml = readFileSync("deploy/docker-compose.kwong.yml", "utf8");

  it("defines kwong-web without publishing host ports", () => {
    expect(yaml).toContain("container_name: kwong-web");
    expect(yaml).toContain("expose:");
    expect(yaml).toContain('"3000"');
    expect(yaml).not.toMatch(/^\s*ports:/m);
  });

  it("uses a named volume and external network", () => {
    expect(yaml).toContain("kwong_data:");
    expect(yaml).toContain("external: true");
    expect(yaml).toContain("${KWONG_DOCKER_NETWORK:-mynetwork}");
  });
});
