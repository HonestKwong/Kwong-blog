import { beforeEach, describe, expect, it } from "vitest";
import { listModules, registerModule, resetRegistry } from "./registry";

describe("module registry", () => {
  beforeEach(() => resetRegistry());

  it("registers and lists modules preserving visibility", () => {
    registerModule({
      id: "blog",
      title: "博客",
      path: "/blog",
      visibility: "public",
    });
    registerModule({
      id: "stocks",
      title: "股票",
      path: "/stocks",
      visibility: "private",
    });
    const all = listModules();
    expect(all.map((m) => m.id)).toEqual(["blog", "stocks"]);
    expect(all.find((m) => m.id === "stocks")?.visibility).toBe("private");
  });

  it("rejects duplicate module ids", () => {
    registerModule({
      id: "blog",
      title: "博客",
      path: "/blog",
      visibility: "public",
    });
    expect(() =>
      registerModule({
        id: "blog",
        title: "重复",
        path: "/x",
        visibility: "public",
      }),
    ).toThrow();
  });
});
