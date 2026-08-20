import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("nginx kwong proxy snippet", () => {
  const snippet = readFileSync("deploy/nginx/kwong-proxy.conf.snippet", "utf8");

  it("proxies to kwong-web:3000 with forwarded headers", () => {
    expect(snippet).toContain("proxy_pass http://kwong-web:3000;");
    expect(snippet).toContain("X-Forwarded-Proto https");
    expect(snippet).toContain("X-Real-IP");
  });

  it("does not redefine Xray gRPC locations", () => {
    for (const path of ["/trgrpc", "/vlgrpc", "/vmgrpc", "/ssgrpc", "/vlxh/"]) {
      expect(snippet).not.toContain(path);
    }
  });
});
