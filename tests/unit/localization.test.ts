import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { esMX } from "@clerk/localizations";
import { normalizeUiLocale, sourceLanguageTag, requestUiLocale } from "../../app/localization/locale";
import { translate, spanishMessages, noticeKey } from "../../app/localization/messages";
import { apiMessageKey } from "../../app/localization/errors";
import { getLocale, setLocale, languageStorageKey } from "../../app/localization/language";

const root = fileURLToPath(new URL("../../app", import.meta.url));
afterEach(() => { setLocale("en-US"); vi.unstubAllGlobals(); });

describe("English and Spanish interface boundaries", () => {
  it("keeps supported UI locales separate from source-language metadata", () => {
    expect(normalizeUiLocale("es-PR")).toBe("es-PR");
    expect(normalizeUiLocale("es_US")).toBe("es-US");
    expect(normalizeUiLocale("es-MX")).toBe("es-US");
    expect(normalizeUiLocale("fr-FR")).toBe("en-US");
    expect(sourceLanguageTag("spa")).toBe("es");
    expect(sourceLanguageTag("eng")).toBe("en");
    expect(sourceLanguageTag('en" onload=bad')).toBe("und");
    expect(requestUiLocale(new Request("https://example.test/?lang=en-US", { headers: { "Accept-Language": "es-PR,es;q=0.9" } }))).toBe("en-US");
    expect(requestUiLocale(new Request("https://example.test/", { headers: { "Accept-Language": "es-PR,es;q=0.9" } }))).toBe("es-PR");
  });

  it("translates completion, accessibility and placeholders without changing English copy", () => {
    const completion = "This memory is now part of your family's history.";
    expect(translate(completion, "en-US")).toBe(completion);
    expect(translate(completion, "es-PR")).toBe("Este recuerdo ya forma parte de la historia de tu familia.");
    expect(translate("Use {size} text", "es-US", { size: "grande" })).toBe("Usar texto grande");
    for (const [key, spanish] of Object.entries(spanishMessages)) {
      expect(spanish.trim()).not.toBe("");
      expect([...spanish.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort())
        .toEqual([...key.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort());
    }
    expect(esMX.signIn?.start?.title).toMatch(/sesión/i);
  });

  it("retains an explicit preference, applies document language, and works without storage", () => {
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => stored.get(key), setItem: (key: string, value: string) => stored.set(key, value) });
    vi.stubGlobal("document", { documentElement: { lang: "en-US" } });
    setLocale("es-PR");
    expect(stored.get(languageStorageKey)).toBe("es-PR");
    expect(getLocale()).toBe("es-PR");
    expect(document.documentElement.lang).toBe("es-PR");
    vi.stubGlobal("localStorage", { setItem() { throw new Error("Storage unavailable"); } });
    expect(() => setLocale("es-US")).not.toThrow();
    expect(getLocale()).toBe("es-US");
  });

  it("uses API codes for safe system notices and can rerender notices after language changes", () => {
    const key = apiMessageKey("review_conflict", "The Living Memory request could not be completed.");
    expect(translate(key, "es-PR")).toContain("otro dispositivo");
    const spanish = translate(key, "es-US");
    expect(translate(noticeKey(spanish), "en-US")).toBe(key);
    expect(noticeKey("Unrecognized provider diagnostic with private content")).toBe("Something went wrong. Please try again.");
    expect(apiMessageKey("new_server_code", "The account request could not be completed.")).toBe("The account request could not be completed.");
  });

  it("has catalog entries for static interface messages and leaves no English-only control labels", () => {
    const paths: string[] = [];
    function collect(dir: string) { for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) collect(join(dir, entry.name));
      else if (entry.name.endsWith(".tsx")) paths.push(join(dir, entry.name));
    } }
    collect(join(root, "features")); paths.push(join(root, "routes.tsx"), join(root, "localization/LanguageControl.tsx"));
    const canonical = new Set(["Memories:", "My Story", "Muse", "M", "English", "Español", "Español (Puerto Rico)", "s", "s /"]);
    const missing: string[] = [];
    for (const file of paths) {
      const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node: ts.Node) {
        if (ts.isCallExpression(node) && node.expression.getText(source) === "t" && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
          const key = node.arguments[0].text.replace(/\s+/g, " ").trim();
          if (!spanishMessages[key]) missing.push(key);
        }
        if (ts.isJsxText(node)) {
          const text = node.text.replace(/\s+/g, " ").trim();
          if (/[A-Za-z]/.test(text) && !canonical.has(text)) missing.push(`${file}: ${text}`);
        }
        if (ts.isJsxAttribute(node) && ["alt", "title", "placeholder", "aria-label"].includes(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) missing.push(`${file}: ${node.initializer.text}`);
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(missing).toEqual([]);
  });
});
