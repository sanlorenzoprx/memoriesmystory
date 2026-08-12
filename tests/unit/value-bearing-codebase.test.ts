import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("value-bearing codebase boundaries", () => {
  it("does not retain superseded UI generations", () => {
    expect(existsSync(join(root, "app/styles/global.css"))).toBe(false);
    expect(existsSync(join(root, "app/styles/legacy-brand-overrides.css"))).toBe(false);
    expect(existsSync(join(root, "app/features/first-experience/content.ts"))).toBe(false);
  });

  it("keeps the public startup surface free of application-only capability imports", () => {
    const main = read("app/main.tsx");

    expect(main).toContain('import "./styles/base.css"');
    expect(main).toContain('import "./styles/brand-experience.css"');
    expect(main).not.toMatch(/@clerk\/clerk-react/);
    expect(main).not.toMatch(/living-memory-runtime\.css/);
    expect(main).not.toMatch(/legacy-brand-overrides|global\.css/);
  });

  it("loads application capabilities at the route where the customer needs them", () => {
    const routes = read("app/routes.tsx");

    expect(routes).toMatch(/lazy:\s*async/);
    expect(routes).toMatch(/import\("\.\/features\/capture\/CaptureExperience"\)/);
    expect(routes).toMatch(/import\("\.\/features\/identity\/IdentityExperience"\)/);
    expect(routes).toMatch(/import\("\.\/features\/archive\/ArchiveExperience"\)/);
    expect(routes).toMatch(/import\("\.\/features\/commerce\/CommerceExperience"\)/);

    expect(routes).not.toMatch(/^import .*CaptureExperience/m);
    expect(routes).not.toMatch(/^import .*IdentityExperience/m);
    expect(routes).not.toMatch(/^import .*ArchiveExperience/m);
    expect(routes).not.toMatch(/^import .*CommerceExperience/m);
  });
});
