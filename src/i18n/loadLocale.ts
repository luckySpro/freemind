import { type Catalogue, type Locale, registerMessages } from "./registry";

// Vite packages these local JSON modules into the app and PWA cache. No translation service
// or remote URL is used; only the selected language is loaded before consumers evaluate t().
const catalogues = import.meta.glob<{ default: Catalogue }>("../**/locales/*.json");

export async function loadLocaleMessages(locale: Locale): Promise<void> {
  if (locale === "en") return;
  const selected = Object.entries(catalogues).filter(([path]) => path.endsWith(`/${locale}.json`));
  if (!selected.length) throw new Error(`Missing bundled locale: ${locale}`);
  const messages = await Promise.all(selected.map(async ([, load]) => (await load()).default));
  for (const catalogue of messages) registerMessages(locale, catalogue);
}
