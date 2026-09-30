import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Windows PowerShell rewrites files as UTF-8 with a BOM and can double-encode
// arrows and dashes. A BOM breaks JSON.parse; mojibake corrupts product copy.
const root = fileURLToPath(new URL("../..", import.meta.url));
const scannedDirectories = ["app", "config", "docs", "migrations", "public", "scripts", "tests", "worker"];
const textExtensions = /\.(md|json|jsonc|ts|tsx|mjs|js|css|sql|html|txt)$/;
const mojibake = /â€|â†|Ã[\u0080-¿]/;

function textFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return textFiles(path);
    return textExtensions.test(name) ? [path] : [];
  });
}

describe("repository text encoding", () => {
  const files = scannedDirectories.flatMap((directory) => textFiles(join(root, directory)));

  it("stores text as UTF-8 without a byte-order mark or double-encoded characters", () => {
    const self = fileURLToPath(import.meta.url);
    const damaged = files
      .filter((path) => path !== self)
      .filter((path) => {
        const text = readFileSync(path, "utf8");
        return text.charCodeAt(0) === 0xfeff || mojibake.test(text);
      })
      .map((path) => relative(root, path));

    expect(damaged).toEqual([]);
  });
});
