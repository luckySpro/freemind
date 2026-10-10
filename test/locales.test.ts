// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { START_EN } from "../src/components/start/messages";
import { THEME_EN } from "../src/components/themeDesignerMessages";
import { CORE_EN } from "../src/i18n/core";
import { loadLocaleMessages } from "../src/i18n/loadLocale";
import { LOCALE_PREF_KEY, resolveLocale, setLocale, t } from "../src/i18n/registry";
import { WRITING_EN } from "../src/i18n/writingMessages";
import { IO_EN } from "../src/io/messages";
import { CANVAS_EN } from "../src/mindmap/flow/messages";
import { PRESENT_EN } from "../src/present/presentMessages";

const core = import.meta.glob<{ default: Record<string, string | { other: string }> }>(
  "../src/**/locales/*.json",
  { eager: true },
);
const placeholders = (message: string) => [...message.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort();

afterEach(() => {
  setLocale("en");
  localStorage.removeItem(LOCALE_PREF_KEY);
  vi.restoreAllMocks();
});

describe("bundled offline languages", () => {
  for (const locale of ["zh-Hans", "zh-Hant", "ja"] as const) {
    it(`${locale} covers the entire core catalog and preserves interpolation`, () => {
      for (const [path, english] of Object.entries({
        i18n: CORE_EN,
        "i18n/writing": WRITING_EN,
        "components/start": START_EN,
        "components/theme": THEME_EN,
        io: IO_EN,
        "mindmap/flow": CANVAS_EN,
        present: PRESENT_EN,
      })) {
        const messages = core[`../src/${path}/locales/${locale}.json`].default;
        expect(Object.keys(messages).sort(), path).toEqual(Object.keys(english).sort());
        for (const [key, source] of Object.entries(english)) {
          const translation = messages[key];
          const text = typeof translation === "string" ? translation : translation.other;
          const original = typeof source === "string" ? source : source.other;
          expect(text, key).toBeTruthy();
          expect(placeholders(text), key).toEqual(placeholders(original));
        }
      }
    });
    it(`${locale} loads locally and translates chrome and engineering writing`, async () => {
      await loadLocaleMessages(locale);
      setLocale(locale);
      expect(t("settings.language")).not.toBe("Language");
      for (const key of Object.keys(WRITING_EN) as (keyof typeof WRITING_EN)[]) {
        expect(t(key, { alt: "diagram", error: "disk" })).not.toBe(WRITING_EN[key]);
      }
      expect(document.documentElement.lang).toBe(locale);
      expect(localStorage.getItem(LOCALE_PREF_KEY)).toBe(locale);
    });
  }
  it.each([
    ["zh-CN", "zh-Hans"],
    ["zh-SG", "zh-Hans"],
    ["zh-Hans", "zh-Hans"],
    ["zh-TW", "zh-Hant"],
    ["zh-HK", "zh-Hant"],
    ["zh-MO", "zh-Hant"],
    ["zh-Hant-CN", "zh-Hant"],
    ["ja-JP", "ja"],
    ["en-US", "en"],
  ])("resolves OS language %s as %s", (tag, expected) => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue([tag]);
    expect(resolveLocale()).toBe(expected);
  });
  it("keeps an explicit user choice ahead of the OS language", () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["ja-JP"]);
    localStorage.setItem(LOCALE_PREF_KEY, "zh-Hant");
    expect(resolveLocale()).toBe("zh-Hant");
  });
});
