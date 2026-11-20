import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import test from "node:test";

test("dry run without a Google key still reads the CSV and does not pretend to import", async () => {
  const child = spawn(
    path.join(process.cwd(), "node_modules", ".bin", "tsx"),
    ["scripts/geocode-import.ts", "--dry-run"],
    {
      cwd: process.cwd(),
      env: { ...process.env, GOOGLE_MAPS_SERVER_KEY: "", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" },
    }
  );
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const code = await new Promise((resolve) => child.on("close", resolve));
  assert.equal(code, 0);
  assert.match(output, /831 rows/);
  assert.match(output, /GOOGLE_MAPS_SERVER_KEY is not set/);
});
