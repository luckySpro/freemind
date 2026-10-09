import { strFromU8, unzipSync } from "fflate";
// The exporters must stamp the ACTIVE locale, not a baked "en".
//
// `<html lang>` is what a screen reader uses to pick a voice and what a browser uses to hyphenate, and
// PPTX's run-level `lang` is what PowerPoint uses to choose a spellcheck dictionary. A Danish map
// exported with `lang="en"` gets read aloud in English and spellchecked against an English dictionary.
//
// English is the only shipped locale, so asserting today's output would be tautological — it would pass
// just as well against the hardcoded string it replaced. Instead these tests ACTIVATE a second locale
// the way a real one will and assert the output follows. `setLocale` is typed to the shipped `LOCALES`,
// so the cast is the point: it exercises the path a second language takes, before there is one.
import { afterEach, describe, expect, it } from "vitest";
import { type Locale, setLocale } from "../src/i18n";
import { buildDeckHtml } from "../src/io/deck";
import { wrapSvgHtml } from "../src/io/html";
import { buildPptx } from "../src/io/pptx";
import type { MindMapDoc } from "../src/model/types";

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Plan",
  root: { id: "r", topic: "Plan", children: [{ id: "a", topic: "Alpha", children: [] }] },
};

afterEach(() => setLocale("en"));

describe("exports carry the active locale", () => {
  it("stamps <html lang> from the locale, not a constant", () => {
    expect(wrapSvgHtml("<svg/>", "t")).toContain('<html lang="en">');
    setLocale("da" as Locale);
    expect(wrapSvgHtml("<svg/>", "t")).toContain('<html lang="da">');
  });

  it("stamps the slide deck's <html lang> too", () => {
    setLocale("da" as Locale);
    expect(buildDeckHtml(doc)).toContain('<html lang="da">');
  });

  it("stamps the PPTX run language, which drives PowerPoint's spellcheck dictionary", () => {
    setLocale("da" as Locale);
    const zip = unzipSync(buildPptx(doc));
    const slides = Object.entries(zip)
      .filter(([name]) => name.startsWith("ppt/slides/") && name.endsWith(".xml"))
      .map(([, bytes]) => strFromU8(bytes))
      .join("");
    expect(slides).toContain('lang="da"');
    expect(slides).not.toContain('lang="en-US"');
  });
});
