// The state that a Calendar shares with its heading, its grids and its cells, and the date math
// of React Stately's calendar. Dates are ISO strings, such as `2026-10-25`, since the page state
// cannot hold the classes of `@internationalized/date`.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import {
  DateFormatter,
  endOfMonth,
  endOfWeek,
  getLocalTimeZone,
  getWeeksInMonth,
  parseDate,
  startOfMonth,
  startOfWeek,
  startOfYear,
  today,
} from '@internationalized/date';
import type { CalendarDate, DateDuration } from '@internationalized/date';

/** A date as `YYYY-MM-DD`. */
export type DateString = string;

/** A range of dates, as RangeCalendar selects it. Both dates are in it. */
export interface DateRange {
  start: DateString;
  end: DateString;
}

export interface CalendarState {
  /** The ID that the IDs of the cells start with. */
  id: string;
  locale: string;
  direction: 'ltr' | 'rtl';
  /** The selected date, or null. A RangeCalendar has none, and shows its range in `selection`. */
  value: DateString | null;
  /**
   * The first and the last date that show as selected: the selected date twice, the selected
   * range, or the range from the first date of a range to the date under the pointer or focus.
   */
  selection: [DateString, DateString] | null;
  /** In a RangeCalendar, after the first press of a range: the dates show the range to `date`. */
  highlight: (date: DateString) => void;
  /** In a RangeCalendar, drops the first date of a range that is not done. */
  cancel: () => void;
  /** The date that has focus, or that gets it when the grid gets focus. */
  focusedDate: DateString;
  /** The first date that shows. */
  start: DateString;
  /** The last date that shows. */
  end: DateString;
  visibleDuration: DateDuration;
  minValue?: DateString;
  maxValue?: DateString;
  isDisabled: boolean;
  isReadOnly: boolean;
  isInvalid: boolean;
  /** The `aria-label` of the Calendar. */
  ariaLabel?: string;
  /** The name of the Calendar and its visible months, such as `Due date, October 2026`. */
  label: string;
  /** Today, in the time zone of the page. */
  today: DateString;
  isDateUnavailable?: (date: DateString) => boolean;
  /** Moves focus to a date, and moves the visible months to show it. */
  focusDate: (date: DateString) => void;
  /** Moves the focused date to a cell that got focus, unless focus has moved on since. */
  cellFocused: (date: DateString) => void;
  /** Moves focus from the focused date, such as a day on with a key. */
  moveFocus: (change: (focused: CalendarDate) => CalendarDate) => void;
  /** Selects a date, as a press or Enter does. */
  selectDate: (date: DateString) => void;
  /** Selects the focused date, unless it cannot be picked. */
  selectFocused: () => void;
}

export const CalendarContext: Context<CalendarState | null> = createContext<CalendarState | null>(
  'brumate-ui:calendar',
  null,
);

/** The month that a CalendarGrid shows, so its cells know the dates outside it. */
export const CalendarGridContext: Context<{ start: DateString } | null> = createContext<{
  start: DateString;
} | null>('brumate-ui:calendar-grid', null);

export function toDate(value: DateString): CalendarDate {
  return parseDate(value);
}

export function todayString(): DateString {
  return today(getLocalTimeZone()).toString();
}

/** Whether a date is before the minimum or after the maximum. */
export function outOfRange(date: CalendarDate, min?: DateString, max?: DateString): boolean {
  return (
    (min !== undefined && date.compare(toDate(min)) < 0) ||
    (max !== undefined && date.compare(toDate(max)) > 0)
  );
}

/** Keeps a date between the minimum and the maximum. */
export function constrain(date: CalendarDate, min?: DateString, max?: DateString): CalendarDate {
  if (min !== undefined && date.compare(toDate(min)) < 0) {
    return toDate(min);
  }
  if (max !== undefined && date.compare(toDate(max)) > 0) {
    return toDate(max);
  }
  return date;
}

/** The step of PageUp and PageDown: one of the largest unit of the visible duration. */
export function unitDuration(duration: DateDuration): DateDuration {
  const unit = { ...duration };
  for (const key of ['years', 'months', 'weeks', 'days'] as const) {
    if (unit[key]) {
      unit[key] = 1;
    }
  }
  return unit;
}

function laterOf(a: CalendarDate, b: CalendarDate): CalendarDate {
  return a.compare(b) >= 0 ? a : b;
}

function earlierOf(a: CalendarDate, b: CalendarDate): CalendarDate {
  return a.compare(b) <= 0 ? a : b;
}

/** Moves the start of a visible range so that it shows no month past the minimum or maximum. */
export function constrainStart(
  date: CalendarDate,
  aligned: CalendarDate,
  duration: DateDuration,
  locale: string,
  min?: DateString,
  max?: DateString,
): CalendarDate {
  if (min !== undefined && date.compare(toDate(min)) >= 0) {
    aligned = laterOf(aligned, alignStart(toDate(min), duration, locale));
  }
  if (max !== undefined && date.compare(toDate(max)) <= 0) {
    aligned = earlierOf(aligned, alignEnd(toDate(max), duration, locale));
  }
  return aligned;
}

/** The start of the visible range that starts at the month, week or year of a date. */
export function alignStart(
  date: CalendarDate,
  duration: DateDuration,
  locale: string,
  min?: DateString,
  max?: DateString,
): CalendarDate {
  let aligned = date;
  if (duration.years) {
    aligned = startOfYear(date);
  } else if (duration.months) {
    aligned = startOfMonth(date);
  } else if (duration.weeks || (duration.days && duration.days > 7)) {
    aligned = startOfWeek(date, locale);
  }
  return constrainStart(date, aligned, duration, locale, min, max);
}

/** The start of the visible range that ends at the month, week or year of a date. */
export function alignEnd(
  date: CalendarDate,
  duration: DateDuration,
  locale: string,
  min?: DateString,
  max?: DateString,
): CalendarDate {
  const back = { ...duration };
  if (back.days) {
    back.days--;
  } else if (back.weeks) {
    back.weeks--;
  } else if (back.months) {
    back.months--;
  } else if (back.years) {
    back.years--;
  }
  const aligned = alignStart(date, duration, locale).subtract(back);
  return constrainStart(date, aligned, duration, locale, min, max);
}

/** The start of the visible range with a date in its middle, as a Calendar starts. */
export function alignCenter(
  date: CalendarDate,
  duration: DateDuration,
  locale: string,
  min?: DateString,
  max?: DateString,
): CalendarDate {
  const half: DateDuration = {};
  for (const key of ['years', 'months', 'weeks', 'days'] as const) {
    const size = duration[key];
    if (size) {
      half[key] = Math.floor(size / 2);
      if (half[key]! > 0 && size % 2 === 0) {
        half[key]!--;
      }
    }
  }
  const aligned = alignStart(date, duration, locale).subtract(half);
  return constrainStart(date, aligned, duration, locale, min, max);
}

/** The last date of a visible range. */
export function endOf(start: CalendarDate, duration: DateDuration): CalendarDate {
  const span = { ...duration };
  if (span.days) {
    span.days--;
  } else {
    span.days = -1;
  }
  return start.add(span);
}

/**
 * The weeks of the month that starts at `start`, each a list of seven dates, in the order of the
 * days of the week of the locale.
 */
export function weeksOf(start: CalendarDate, locale: string): DateString[][] {
  const first = startOfWeek(start, locale);
  const count = getWeeksInMonth(start, locale);
  return Array.from({ length: count }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => first.add({ weeks: week, days: day }).toString()),
  );
}

/** The days of the week of the locale, as a full name and as one or two letters. */
export function weekDays(locale: string): { name: string; short: string }[] {
  const first = startOfWeek(today(getLocalTimeZone()), locale);
  const long = new DateFormatter(locale, { weekday: 'long', timeZone: 'UTC' });
  const narrow = new DateFormatter(locale, { weekday: 'narrow', timeZone: 'UTC' });
  return Array.from({ length: 7 }, (_, index) => {
    const date = first.add({ days: index }).toDate('UTC');
    return { name: long.format(date), short: narrow.format(date) };
  });
}

/**
 * A month or a range of months, such as `October 2026`, or `October to November 2026` for screen
 * readers and `October – November 2026` to show.
 */
export function rangeLabel(
  start: CalendarDate,
  end: CalendarDate,
  locale: string,
  spoken = true,
): string {
  const months = new DateFormatter(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const from = start.toDate('UTC');
  if (start.compare(startOfMonth(start)) === 0 && end.compare(endOfMonth(start)) === 0) {
    return months.format(from);
  }
  if (start.compare(startOfMonth(start)) === 0 && end.compare(endOfMonth(end)) === 0) {
    return spoken
      ? joinRange(months, from, end.toDate('UTC'))
      : months.formatRange(from, end.toDate('UTC'));
  }
  const days = new DateFormatter(locale, {
    month: 'long',
    year: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return spoken
    ? joinRange(days, from, end.toDate('UTC'))
    : days.formatRange(from, end.toDate('UTC'));
}

/** Two dates as `{start} to {end}`, as React Aria reads a range, with the parts that they share. */
function joinRange(formatter: DateFormatter, start: Date, end: Date): string {
  const parts = formatter.formatRangeToParts(start, end);
  let separator = -1;
  for (const [index, part] of parts.entries()) {
    if (part.source === 'shared' && part.type === 'literal') {
      separator = index;
    } else if (part.source === 'endRange') {
      break;
    }
  }
  let from = '';
  let to = '';
  for (const [index, part] of parts.entries()) {
    if (index < separator) {
      from += part.value;
    } else if (index > separator) {
      to += part.value;
    }
  }
  return `${from} to ${to}`;
}

/** The name of a cell for screen readers, such as `Today, Sunday, October 25, 2026 selected`. */
export function cellLabel(calendar: CalendarState, date: DateString, selected: boolean): string {
  const formatter = new DateFormatter(calendar.locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  let label = formatter.format(toDate(date).toDate('UTC'));
  if (date === calendar.today) {
    label = selected ? `Today, ${label} selected` : `Today, ${label}`;
  } else if (selected) {
    label = `${label} selected`;
  }
  if (date === calendar.minValue) {
    label += ', First available date';
  } else if (date === calendar.maxValue) {
    label += ', Last available date';
  }
  return label;
}

/** The number of the day of a date in the locale, such as `25`. */
export function dayNumber(date: DateString, locale: string): string {
  const formatter = new DateFormatter(locale, { day: 'numeric', timeZone: 'UTC' });
  return (
    formatter.formatToParts(toDate(date).toDate('UTC')).find((part) => part.type === 'day')
      ?.value ?? String(toDate(date).day)
  );
}

export { endOfMonth, endOfWeek, startOfMonth, startOfWeek };
