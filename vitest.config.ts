import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "deploy/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
  },
});
