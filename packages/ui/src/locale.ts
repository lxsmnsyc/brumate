// The locale of the parts, for the I18nProvider.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

export interface Locale {
  /** A BCP 47 language tag, such as `en-US` or `ar-EG`. */
  locale: string;
  direction: 'ltr' | 'rtl';
}

// The scripts and languages that are written right to left.
const RTL_SCRIPTS = new Set([
  'Arab',
  'Syrc',
  'Samr',
  'Mand',
  'Thaa',
  'Mend',
  'Nkoo',
  'Adlm',
  'Rohg',
  'Hebr',
]);
const RTL_LANGUAGES = new Set([
  'ae',
  'ar',
  'arc',
  'bcc',
  'bqi',
  'ckb',
  'dv',
  'fa',
  'glk',
  'he',
  'ku',
  'mzn',
  'nqo',
  'pnb',
  'ps',
  'sd',
  'ug',
  'ur',
  'yi',
]);

/** True for a locale that is written right to left. */
export function isRTL(locale: string): boolean {
  try {
    const parsed = new Intl.Locale(locale).maximize();
    if (parsed.script) {
      return RTL_SCRIPTS.has(parsed.script);
    }
    return RTL_LANGUAGES.has(parsed.language);
  } catch {
    return RTL_LANGUAGES.has(locale.split('-')[0]!.toLowerCase());
  }
}

/** The locale and the direction of a language tag. */
export function localeOf(locale: string): Locale {
  return { locale, direction: isRTL(locale) ? 'rtl' : 'ltr' };
}

/**
 * The locale of the parts inside an I18nProvider. The default is `en-US`, so the server and the
 * browser format the same way. A language of the browser would differ from the server, which does
 * not know it.
 */
export const LocaleContext: Context<Locale> = createContext<Locale>(
  'brumate-ui:locale',
  localeOf('en-US'),
);
