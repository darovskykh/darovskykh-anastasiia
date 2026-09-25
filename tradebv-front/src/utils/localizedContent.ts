/**
 * Locale codes recognised by the marker parser. Add a new locale here AND in
 * the regex below to extend coverage.
 */
export const SUPPORTED_LOCALES = ['en', 'uk', 'ar', 'es', 'pt', 'ru'] as const;
export type LocaleCode = typeof SUPPORTED_LOCALES[number];

export const LOCALE_LABELS: Record<LocaleCode, { code: string; native: string; english: string }> = {
  en: { code: 'EN', native: 'English', english: 'English' },
  uk: { code: 'UK', native: 'Українська', english: 'Ukrainian' },
  ar: { code: 'AR', native: 'العربية', english: 'Arabic' },
  es: { code: 'ES', native: 'Español', english: 'Spanish' },
  pt: { code: 'PT', native: 'Português', english: 'Portuguese' },
  ru: { code: 'RU', native: 'Русский', english: 'Russian' },
};

const MARKER_RE = /<!--\s*(en|uk|ar|es|pt|ru)\s*-->([\s\S]*?)(?=<!--\s*(?:en|uk|ar|es|pt|ru)\s*-->|$)/gi;

/**
 * Extracts a locale-specific slice from a case content field that may carry
 * several language versions inside the same string, demarcated by HTML-comment
 * markers (`<!-- en --> ... <!-- uk --> ... <!-- ar --> ...`).
 *
 * Fallback chain: requested locale → en → uk → first available section → raw
 * input (so legacy single-language content keeps working without migration).
 */
export function extractLocalizedContent(content: string, locale: string): string {
  if (!content) return content;

  MARKER_RE.lastIndex = 0;
  const sections: Record<string, string> = {};
  let match: RegExpExecArray | null;
  while ((match = MARKER_RE.exec(content)) !== null) {
    const key = match[1].toLowerCase();
    if (!(key in sections)) sections[key] = match[2].trim();
  }

  const found = Object.keys(sections);
  if (found.length === 0) return content;

  const want = (SUPPORTED_LOCALES as readonly string[]).includes(locale) ? locale : 'en';
  return sections[want] ?? sections.en ?? sections.uk ?? sections[found[0]] ?? content;
}

/**
 * Splits a marker-delimited content string into all 6 locale slots. Locales
 * that have no marker in the input come back as empty strings. If the input
 * has no markers at all (legacy single-language entry), the entire content is
 * placed into the `uk` slot — that mirrors the historical behaviour of
 * splitLocalizedContent and lets the admin migrate manually.
 */
export function splitAllLocales(content: string | null | undefined): Record<LocaleCode, string> {
  const empty = SUPPORTED_LOCALES.reduce(
    (acc, l) => ({ ...acc, [l]: '' }),
    {} as Record<LocaleCode, string>,
  );

  if (!content) return empty;

  MARKER_RE.lastIndex = 0;
  const sections: Partial<Record<LocaleCode, string>> = {};
  let match: RegExpExecArray | null;
  while ((match = MARKER_RE.exec(content)) !== null) {
    const key = match[1].toLowerCase() as LocaleCode;
    if (!(key in sections)) sections[key] = match[2].trim();
  }

  if (Object.keys(sections).length === 0) {
    return { ...empty, uk: content };
  }

  return SUPPORTED_LOCALES.reduce(
    (acc, l) => ({ ...acc, [l]: sections[l] ?? '' }),
    {} as Record<LocaleCode, string>,
  );
}

/**
 * Combines a per-locale map back into a single marker-delimited string.
 * Empty slots are skipped. If every slot is empty, returns "" (so the field
 * stays empty rather than becoming a sea of empty markers).
 */
export function combineAllLocales(parts: Record<LocaleCode, string>): string {
  const filled = SUPPORTED_LOCALES
    .map(l => ({ l, v: (parts[l] || '').trim() }))
    .filter(p => p.v.length > 0);

  if (filled.length === 0) return '';
  return filled.map(p => `<!-- ${p.l} -->\n${p.v}`).join('\n');
}

/**
 * Splits a dual-locale string into its UA and EN halves. Kept for backward
 * compatibility — new call sites should use splitAllLocales instead.
 */
export function splitLocalizedContent(content: string | null | undefined): { uk: string; en: string } {
  const all = splitAllLocales(content);
  return { uk: all.uk, en: all.en };
}

/**
 * Combines UA and EN halves back into a single field value with markers.
 * Kept for backward compatibility — new call sites should use combineAllLocales.
 */
export function combineLocalizedContent(uk: string, en: string): string {
  return combineAllLocales({ en, uk, ar: '', es: '', pt: '', ru: '' });
}
