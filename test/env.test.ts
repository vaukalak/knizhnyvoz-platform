import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { loadLocalEnv } from "../src/env.js";

describe("loadLocalEnv", () => {
  it("чытае токен і не перазапісвае ўжо зададзенае", () => {
    const dir = mkdtempSync(join(tmpdir(), "kv-env-"));
    const file = join(dir, ".env");
    writeFileSync(file, 'KNIZHNYVOZ_API_TOKEN="from-file"\nALREADY=from-file\n');
    process.env.ALREADY = "from-env";
    delete process.env.KNIZHNYVOZ_API_TOKEN;
    loadLocalEnv(file);
    assert.equal(process.env.KNIZHNYVOZ_API_TOKEN, "from-file");
    assert.equal(process.env.ALREADY, "from-env");
    delete process.env.KNIZHNYVOZ_API_TOKEN;
    delete process.env.ALREADY;
  });
});
