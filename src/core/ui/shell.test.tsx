import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./shell";

describe("AppShell", () => {
  it("renders its children inside a main region", () => {
    render(<AppShell>hello content</AppShell>);
    expect(screen.getByRole("main").textContent).toContain("hello content");
  });
});
