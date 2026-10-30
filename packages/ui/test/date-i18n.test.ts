// The strings and placeholders of the date parts per language, and today.
import { setLocalTimeZone } from '@internationalized/date';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import { getDateStrings } from '../src/date-strings.ts';
import { press } from './interact.ts';
import DateI18n from './fixtures/date-i18n.brm?brumate-server';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  unmount = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function mountDates(props: Record<string, unknown> = {}) {
  const mounted = await mount(DateI18n, props);
  unmount = mounted.unmount;
  return mounted;
}

type Page = Awaited<ReturnType<typeof mountDates>>;

function segmentTexts(view: Page, input: string) {
  return [...view.get(input).querySelectorAll<HTMLElement>('[data-segment]')].map(
    (item) => item.textContent,
  );
}

function names(view: Page, input: string) {
  return [...view.get(input).querySelectorAll<HTMLElement>('[role="spinbutton"]')].map((item) =>
    item.getAttribute('aria-label'),
  );
}

it('shows German placeholders in the order of the locale, and German names and labels', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
  const de = await mountDates({ locale: 'de-DE', timeZone: 'UTC', focused: '2026-10-15' });
  expect(segmentTexts(de, '.empty-input').join('')).toBe('tt.mm.jjjj');
  expect(segmentTexts(de, '.input').join('')).toBe('15.10.2026');
  expect(names(de, '.empty-input')).toEqual(['Tag', 'Monat', 'Jahr']);
  const day = de.get('.empty-input [data-type="day"]');
  expect(day.getAttribute('aria-valuetext')).toBe('Leer');
  expect(de.get('.previous').getAttribute('aria-label')).toBe('Zurück');
  expect(de.get('.next').getAttribute('aria-label')).toBe('Weiter');
  expect(de.get('.picker-button').getAttribute('aria-label')).toBe('Kalender');
  // The cell of today, selected or not, in German.
  const today = de.get('.calendar [data-today]');
  expect(today.getAttribute('aria-label')).toContain('Heute, ');
  expect(today.getAttribute('aria-label')).toContain('Donnerstag');
});

it('shows the time segments as dashes in every language', async () => {
  const fr = await mountDates({ locale: 'fr-FR' });
  expect(segmentTexts(fr, '.time-input')).toContain('––');
  expect(names(fr, '.time-input')[0]).toBe('heure');
});

it.each(['sw-KE', 'tlh', 'en-GB'])('falls back to English for %s', async (locale) => {
  const english = await mountDates({ locale });
  // The order is the locale's, and the words are English.
  const words = segmentTexts(english, '.empty-input').filter((text) => /\w/.test(text!));
  expect(words.toSorted()).toEqual(['dd', 'mm', 'yyyy']);
  expect(names(english, '.empty-input').toSorted()).toEqual(['day', 'month', 'year']);
  expect(english.get('.previous').getAttribute('aria-label')).toBe('Previous');
});

it('has a table for each of the first six languages', () => {
  const placeholders = {
    en: 'yyyy mm dd',
    de: 'jjjj mm tt',
    fr: 'aaaa mm jj',
    es: 'aaaa mm dd',
    ja: '年 月 日',
    zh: '年 月 日',
  };
  for (const [language, expected] of Object.entries(placeholders)) {
    const { year, month, day } = getDateStrings(language).placeholders;
    expect(`${year} ${month} ${day}`).toBe(expected);
  }
  for (const language of ['de', 'fr', 'es', 'ja', 'zh']) {
    expect(getDateStrings(language).previous).not.toBe('Previous');
  }
  // A region or a script does not change the language.
  expect(getDateStrings('zh-CN').next).toBe(getDateStrings('zh').next);
  // Traditional Chinese has its own table, chosen by script or by region.
  for (const locale of ['zh-Hant', 'zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant-TW']) {
    expect(getDateStrings(locale).next).toBe('下一個');
    expect(getDateStrings(locale).empty).toBe('空白');
  }
  expect(getDateStrings('zh-Hans-SG').next).toBe('下一个');
  expect(getDateStrings('not a locale').next).toBe('Next');
});

it('takes the segment names from the browser, and English where it has none', () => {
  expect(getDateStrings('ja').segmentNames.year).toBe('年');
  const display = Intl.DisplayNames;
  vi.stubGlobal(
    'Intl',
    Object.assign(Object.create(Intl), {
      DisplayNames: function DisplayNames() {
        throw new RangeError('dateTimeField is not supported');
      },
    }),
  );
  try {
    expect(getDateStrings('de-DE').segmentNames).toEqual({
      year: 'year',
      month: 'month',
      day: 'day',
      hour: 'hour',
      minute: 'minute',
      second: 'second',
      dayPeriod: 'AM/PM',
    });
    // The labels stay German.
    expect(getDateStrings('de-DE').previous).toBe('Zurück');
  } finally {
    vi.unstubAllGlobals();
  }
  expect(Intl.DisplayNames).toBe(display);
});

it('replaces the whole set with the strings of an I18nProvider', async () => {
  const strings = {
    ...getDateStrings('en-US'),
    placeholders: { year: 'YYYY', month: 'MM', day: 'DD' },
    previous: 'Earlier',
    next: 'Later',
    calendar: 'Pick',
    empty: 'None',
  };
  const custom = await mountDates({ locale: 'de-DE', strings });
  expect(segmentTexts(custom, '.empty-input').join('')).toBe('DD.MM.YYYY');
  expect(custom.get('.previous').getAttribute('aria-label')).toBe('Earlier');
  expect(custom.get('.next').getAttribute('aria-label')).toBe('Later');
  expect(custom.get('.picker-button').getAttribute('aria-label')).toBe('Pick');
  expect(custom.get('.empty-input [data-type="day"]').getAttribute('aria-valuetext')).toBe('None');
});

it('sends only the strings of the language of the page to the browser', async () => {
  const de = await mountDates({ locale: 'de-DE' });
  const html = document.documentElement.innerHTML;
  // The words of German reach the page: the markup and the state.
  expect(html).toContain('Zurück');
  // No other language does.
  const others = ['en', 'fr', 'es', 'ja', 'zh'];
  for (const language of others) {
    const strings = getDateStrings(language);
    // English words such as `Calendar` and `selected` are also in the markup and the names of
    // attributes, so English is checked by its longer phrases.
    const words =
      language === 'en'
        ? [strings.previous, strings.firstAvailable, strings.lastAvailable]
        : [
            strings.previous,
            strings.next,
            strings.calendar,
            strings.today,
            strings.selected,
            strings.firstAvailable,
            strings.lastAvailable,
          ];
    const german = Object.values(getDateStrings('de'));
    const leaked = words.filter((word) => !german.includes(word) && html.includes(word));
    expect(leaked).toEqual([]);
  }
  de.unmount();
  unmount = undefined;
});

/** The ISO dates of the cells that show as today. */
function todays(view: Page) {
  return [...view.container.querySelectorAll<HTMLElement>('.calendar [data-today]')].map((cell) =>
    cell.getAttribute('data-date'),
  );
}

beforeEach(() => {
  setLocalTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
});

it('renders the date of the server first, then takes the date of the browser', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  // Ten in the evening of the 27th in Honolulu is already the 28th in Auckland.
  vi.setSystemTime(new Date('2026-10-28T08:00:00Z'));
  setLocalTimeZone('Pacific/Honolulu');
  const rendered = await mountDates({ focused: '2026-10-15' });
  // The server's zone: the 27th, in the HTML and in the first render.
  expect(todays(rendered)).toEqual(['2026-10-27']);
  // The browser is in another zone, and takes its own date.
  setLocalTimeZone('Pacific/Auckland');
  await rendered.waitFor(() => expect(todays(rendered)).toEqual(['2026-10-28']));
});

it('uses the time zone of the app, in the server and in the browser', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-28T08:00:00Z'));
  setLocalTimeZone('Pacific/Honolulu');
  const tokyo = await mountDates({ timeZone: 'Asia/Tokyo' });
  expect(todays(tokyo)).toEqual(['2026-10-28']);
  setLocalTimeZone('America/Los_Angeles');
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(todays(tokyo)).toEqual(['2026-10-28']);
});

it('moves the highlight past midnight and when the tab shows again', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-27T23:59:00Z'));
  const delays: [() => void, number][] = [];
  const real = globalThis.setTimeout;
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
    callback: () => void,
    delay?: number,
    ...rest: unknown[]
  ) => {
    // Only the timers of today, which wait for midnight, are held.
    if (delay !== undefined && delay > 50_000) {
      delays.push([callback, delay]);
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }
    return real(callback, delay, ...rest);
  }) as typeof setTimeout);
  const clock = await mountDates({ timeZone: 'UTC', focused: '2026-10-27' });
  expect(todays(clock)).toEqual(['2026-10-27']);
  await clock.waitFor(() => expect(delays.length).toBeGreaterThan(0));
  // Midnight is a minute away, plus a moment.
  const waiting = delays.filter(([, delay]) => delay < 61_000);
  expect(waiting.length).toBeGreaterThan(0);
  for (const [, delay] of waiting) {
    expect(delay).toBeGreaterThanOrEqual(60_000);
  }
  vi.setSystemTime(new Date('2026-10-28T00:00:01Z'));
  delays.length = 0;
  for (const [rollover] of waiting) {
    rollover();
  }
  await clock.waitFor(() => expect(todays(clock)).toEqual(['2026-10-28']));
  // The timers wait for the next minute.
  expect(delays.length).toBeGreaterThan(0);
  for (const [, delay] of delays) {
    expect(delay).toBe(59_050);
  }

  // A tab that sleeps through the timer takes the date when it shows again.
  vi.setSystemTime(new Date('2026-10-29T10:00:00Z'));
  document.dispatchEvent(new Event('visibilitychange'));
  await clock.waitFor(() => expect(todays(clock)).toEqual(['2026-10-29']));
});

it('starts an empty segment at today in the time zone of the I18nProvider', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  // The 28th in Tokyo, still the 27th in Honolulu.
  vi.setSystemTime(new Date('2026-10-27T20:00:00Z'));
  setLocalTimeZone('Pacific/Honolulu');
  const tokyo = await mountDates({ timeZone: 'Asia/Tokyo' });
  const day = tokyo.get('.empty-input [data-type="day"]');
  press('ArrowUp', day);
  await tokyo.waitFor(() =>
    expect(tokyo.get('.empty-input [data-type="day"]').textContent).toBe('28'),
  );
});
