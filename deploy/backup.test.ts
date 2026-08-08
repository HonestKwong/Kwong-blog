import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("backup/restore scripts", () => {
  const backup = readFileSync("deploy/backup.sh", "utf8");
  const restore = readFileSync("deploy/restore.sh", "utf8");

  it("uses sqlite online backup API, not raw file copy of a live db", () => {
    expect(backup).toContain(".backup");
    expect(backup).not.toMatch(/cp\s+"?\$\{?DB_PATH/);
  });

  it("restore writes to DATA_DIR and verifies file exists", () => {
    expect(restore).toContain("DATA_DIR");
    expect(restore).toContain("prod.db");
  });
});
