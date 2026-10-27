// The words of the date parts: the placeholders of the segments, their names for screen readers,
// and the labels of the Calendar and the DatePicker. An I18nProvider looks up the strings of its
// locale while it renders on the server, and the parts read them from a context. Only that object
// goes to the browser. The table of every language stays on the server: the parts import the
// context, never `stringsOf`. Outside an I18nProvider the context holds null, and the parts use
// their English words.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import { PLACEHOLDERS, SEGMENT_NAMES } from './segments.ts';

/** The parts of a date or a time that a segment edits. */
export type SegmentName = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'dayPeriod';

/** The text of a year, a month and a day that is not set. */
export interface DatePlaceholders {
  year: string;
  month: string;
  day: string;
}

/** Every string that the date parts show or announce. */
export interface DateStrings {
  /** What an empty year, month or day segment shows, as the date input of a browser does. */
  placeholders: DatePlaceholders;
  /** The name of each segment for screen readers. */
  segmentNames: Record<SegmentName, string>;
  /** The spoken value of a segment that is not set. */
  empty: string;
  /** The `aria-label` of the Button that shows the earlier months. */
  previous: string;
  /** The `aria-label` of the Button that shows the later months. */
  next: string;
  /** The `aria-label` of the Button that opens the Calendar of a DatePicker. */
  calendar: string;
  /** Starts the label of today's cell. */
  today: string;
  /** Ends the label of a selected cell. */
  selected: string;
  /** Ends the label of the first date that can be picked. */
  firstAvailable: string;
  /** Ends the label of the last date that can be picked. */
  lastAvailable: string;
}

/** What differs between languages by hand. The segment names come from the browser. */
type Words = Omit<DateStrings, 'segmentNames'>;

const ENGLISH: Words = {
  placeholders: PLACEHOLDERS,
  empty: 'Empty',
  previous: 'Previous',
  next: 'Next',
  calendar: 'Calendar',
  today: 'Today',
  selected: 'selected',
  firstAvailable: 'First available date',
  lastAvailable: 'Last available date',
};

/**
 * The words of each language, by its language subtag. The placeholders follow what browsers show
 * in their own date inputs. To add a language, add an entry. A language with no entry shows
 * English.
 */
const LANGUAGES: Record<string, Words> = {
  en: ENGLISH,
  de: {
    placeholders: { year: 'jjjj', month: 'mm', day: 'tt' },
    empty: 'Leer',
    previous: 'Zurück',
    next: 'Weiter',
    calendar: 'Kalender',
    today: 'Heute',
    selected: 'ausgewählt',
    firstAvailable: 'Erstes verfügbares Datum',
    lastAvailable: 'Letztes verfügbares Datum',
  },
  fr: {
    placeholders: { year: 'aaaa', month: 'mm', day: 'jj' },
    empty: 'Vide',
    previous: 'Précédent',
    next: 'Suivant',
    calendar: 'Calendrier',
    today: "Aujourd'hui",
    selected: 'sélectionné',
    firstAvailable: 'Première date disponible',
    lastAvailable: 'Dernière date disponible',
  },
  es: {
    placeholders: { year: 'aaaa', month: 'mm', day: 'dd' },
    empty: 'Vacío',
    previous: 'Anterior',
    next: 'Siguiente',
    calendar: 'Calendario',
    today: 'Hoy',
    selected: 'seleccionado',
    firstAvailable: 'Primera fecha disponible',
    lastAvailable: 'Última fecha disponible',
  },
  ja: {
    placeholders: { year: '年', month: '月', day: '日' },
    empty: '空',
    previous: '前へ',
    next: '次へ',
    calendar: 'カレンダー',
    today: '今日',
    selected: '選択済み',
    firstAvailable: '選択可能な最初の日付',
    lastAvailable: '選択可能な最後の日付',
  },
  zh: {
    placeholders: { year: '年', month: '月', day: '日' },
    empty: '空',
    previous: '上一个',
    next: '下一个',
    calendar: '日历',
    today: '今天',
    selected: '已选择',
    firstAvailable: '第一个可用日期',
    lastAvailable: '最后一个可用日期',
  },
};

/** The language subtag of a locale, such as `de` for `de-DE`. */
function languageOf(locale: string): string {
  try {
    return new Intl.Locale(locale).language;
  } catch {
    return locale.split(/[-_]/)[0]!.toLowerCase();
  }
}

/** The name of a segment in a locale, from the browser, or the English one. */
function nameOf(names: Intl.DisplayNames | undefined, type: SegmentName): string {
  try {
    const name = names?.of(type);
    // A locale that the browser lacks answers with the code itself.
    return name && name !== type ? name : SEGMENT_NAMES[type];
  } catch {
    return SEGMENT_NAMES[type];
  }
}

/** The strings of a locale. A language with no table shows English. */
export function stringsOf(locale: string): DateStrings {
  const language = languageOf(locale);
  const words = LANGUAGES[language] ?? ENGLISH;
  let names: Intl.DisplayNames | undefined;
  // Only a language with a table gets names from the browser, since the labels are in English
  // otherwise, and mixed languages read worse than English alone.
  if (words !== ENGLISH || language === 'en') {
    try {
      names = new Intl.DisplayNames(locale, { type: 'dateTimeField' });
    } catch {
      names = undefined;
    }
  }
  return {
    ...words,
    segmentNames: {
      year: nameOf(names, 'year'),
      month: nameOf(names, 'month'),
      day: nameOf(names, 'day'),
      hour: nameOf(names, 'hour'),
      minute: nameOf(names, 'minute'),
      second: nameOf(names, 'second'),
      dayPeriod: nameOf(names, 'dayPeriod'),
    },
  };
}

/** The strings of the parts inside an I18nProvider. Null outside one, where the parts use English. */
export const DateStringsContext: Context<DateStrings | null> = createContext<DateStrings | null>(
  'brumate-ui:date-strings',
  null,
);
