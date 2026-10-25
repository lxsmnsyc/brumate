// The segments of a DateField and a TimeField, after useDateFieldState and useTimeFieldState of
// React Aria: the month, the day and the year, or the hour, the minute, the second and AM or PM,
// in the order and with the separators of the locale. Each segment is set or empty. The field has
// a value once every segment is set. Dates and times are ISO strings, such as `2026-10-15` and
// `14:30`.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import { CalendarDate, DateFormatter, endOfMonth } from '@internationalized/date';
import type { DateString } from './calendar.ts';
import { toDate } from './calendar.ts';

/** A part of a date or a time that a segment edits. */
export type SegmentType = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'dayPeriod';

/** The parts that are set. A part that is not set shows its placeholder. The hour is 0 to 23. */
export type DateParts = Partial<Record<Exclude<SegmentType, 'dayPeriod'>, number>>;

/** A time of day, as `HH:MM`, or `HH:MM:SS` for a field with seconds. */
export type TimeString = string;

/** The smallest part that a TimeField shows. */
export type TimeGranularity = 'hour' | 'minute' | 'second';

export interface Segment {
  /** A part of the date, or `literal` for the text between two parts, such as `/`. */
  type: SegmentType | 'literal';
  /** The text that shows: the number, the placeholder, or the literal. */
  text: string;
  /** The number of a part that is set. */
  value?: number;
  min: number;
  max: number;
  /** True for a part that is not set, which shows its placeholder. */
  isPlaceholder: boolean;
  /** The position of the segment in the field, so the parts of the field tell them apart. */
  index: number;
}

/** What a DateField gives its DateInput and its DateSegments. */
export interface DateFieldState {
  segments: Segment[];
  /** The ID of the label of the field, which names each segment too. */
  labelId: string;
  /** The IDs that describe the field, for `aria-describedby` of each segment. */
  describedBy?: string;
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  direction: 'ltr' | 'rtl';
  /** Steps a part by `delta`, around its range. A part that is not set starts at the placeholder. */
  step: (type: SegmentType, delta: number) => void;
  /**
   * Types a character into a part: a digit, or `a` or `p` for AM or PM. True when the part is
   * full, so focus moves to the next one.
   */
  type: (type: SegmentType, char: string) => boolean;
  /** Takes the last digit of a part away, or empties it. True when it was empty already. */
  erase: (type: SegmentType) => boolean;
  /** Forgets the digits typed so far, such as when focus leaves a segment. */
  settle: () => void;
}

export const DateFieldContext: Context<DateFieldState | null> =
  createContext<DateFieldState | null>('brumate-ui:date-field', null);

/** The number of days in the month of a date. */
function getDaysInMonth(date: CalendarDate): number {
  return endOfMonth(date).day;
}

/** The text of a part that is not set, as React Aria shows it in English. */
const PLACEHOLDERS: Record<SegmentType, string> = {
  year: 'yyyy',
  month: 'mm',
  day: 'dd',
  hour: '––',
  minute: '––',
  second: '––',
  dayPeriod: 'AM',
};

/** The name of a part for screen readers. */
export const SEGMENT_NAMES: Record<SegmentType, string> = {
  year: 'year',
  month: 'month',
  day: 'day',
  hour: 'hour',
  minute: 'minute',
  second: 'second',
  dayPeriod: 'AM/PM',
};

/** The parts of a date, or none for no date. */
export function partsOf(value: DateString | null): DateParts {
  if (value === null) {
    return {};
  }
  const date = toDate(value);
  return { year: date.year, month: date.month, day: date.day };
}

/** The date of parts that are all set, with a day that fits its month, or null. */
export function dateOf(parts: DateParts): DateString | null {
  if (parts.year === undefined || parts.month === undefined || parts.day === undefined) {
    return null;
  }
  const month = new CalendarDate(parts.year, parts.month, 1);
  return month.set({ day: Math.min(parts.day, getDaysInMonth(month)) }).toString();
}

/** The range of a part: the months of a year, the days of the month that is set, or years. */
function rangeOf(
  type: 'year' | 'month' | 'day',
  parts: DateParts,
  placeholder: CalendarDate,
): [number, number] {
  if (type === 'month') {
    return [1, 12];
  }
  if (type === 'day') {
    const month = new CalendarDate(
      parts.year ?? placeholder.year,
      parts.month ?? placeholder.month,
      1,
    );
    return [1, getDaysInMonth(month)];
  }
  return [1, 9999];
}

/** The segments of a date in a locale, with the parts that are set. */
export function segmentsOf(parts: DateParts, placeholder: DateString, locale: string): Segment[] {
  const base = toDate(placeholder);
  const shown = new CalendarDate(
    parts.year ?? base.year,
    parts.month ?? base.month,
    Math.min(
      parts.day ?? base.day,
      getDaysInMonth(new CalendarDate(parts.year ?? base.year, parts.month ?? base.month, 1)),
    ),
  );
  const formatter = new DateFormatter(locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return formatter.formatToParts(shown.toDate('UTC')).map((part, index) => {
    if (part.type !== 'year' && part.type !== 'month' && part.type !== 'day') {
      return { type: 'literal', text: part.value, min: 0, max: 0, isPlaceholder: false, index };
    }
    const type = part.type;
    const [min, max] = rangeOf(type, parts, base);
    const value = parts[type];
    return {
      type,
      text: value === undefined ? PLACEHOLDERS[type] : part.value,
      value,
      min,
      max,
      isPlaceholder: value === undefined,
      index,
    };
  });
}

/** A part of a date. */
export type DateSegmentType = 'year' | 'month' | 'day';

/** A part of a time that holds a number. */
export type TimeSegmentType = 'hour' | 'minute' | 'second';

/** A part stepped by `delta`, around its range. A part that is not set takes the placeholder. */
export function stepPart(
  parts: DateParts,
  type: DateSegmentType,
  delta: number,
  placeholder: DateString,
): DateParts {
  const base = toDate(placeholder);
  const current = parts[type];
  if (current === undefined) {
    return { ...parts, [type]: base[type] };
  }
  const [min, max] = rangeOf(type, parts, base);
  // Years do not go around, as in React Aria.
  if (type === 'year') {
    return { ...parts, year: Math.min(max, Math.max(min, current + delta)) };
  }
  const size = max - min + 1;
  return { ...parts, [type]: ((((current - min + delta) % size) + size) % size) + min };
}

/**
 * A digit typed into a part, after the digits typed so far. A number past the range starts again
 * at the digit. The part is full when no other digit could follow.
 */
export function typeDigit(
  parts: DateParts,
  type: DateSegmentType,
  typed: string,
  digit: number,
  placeholder: DateString,
): { parts: DateParts; typed: string; full: boolean } {
  const [, max] = rangeOf(type, parts, toDate(placeholder));
  let text = `${typed}${digit}`;
  let number = Number(text);
  if (number > max) {
    text = String(digit);
    number = digit;
  }
  const full = number * 10 > max || text.length >= String(max).length;
  // A zero alone sets nothing yet, as `0` then `5` types the 5th.
  const next = number === 0 ? parts : { ...parts, [type]: number };
  return { parts: next, typed: full ? '' : text, full: full && number !== 0 };
}

/** A part with its last typed digit taken away, or empty. */
export function erasePart(parts: DateParts, type: DateSegmentType | TimeSegmentType): DateParts {
  const current = parts[type];
  if (current === undefined) {
    return parts;
  }
  const rest = Math.floor(current / 10);
  const next = { ...parts };
  if (rest === 0) {
    delete next[type];
  } else {
    next[type] = rest;
  }
  return next;
}

const pad = (number: number): string => String(number).padStart(2, '0');

/** The largest number of each part of a time. */
const TIME_MAX: Record<TimeSegmentType, number> = { hour: 23, minute: 59, second: 59 };

/** The parts of a time, or none for no time. */
export function timePartsOf(value: TimeString | null): DateParts {
  if (value === null) {
    return {};
  }
  const [hour = 0, minute = 0, second = 0] = value.split(':').map(Number);
  return { hour, minute, second };
}

/** The time of parts that are all set, to the granularity, or null. */
export function timeOf(parts: DateParts, granularity: TimeGranularity): TimeString | null {
  const { hour, minute, second } = parts;
  if (
    hour === undefined ||
    (granularity !== 'hour' && minute === undefined) ||
    (granularity === 'second' && second === undefined)
  ) {
    return null;
  }
  const time = `${pad(hour)}:${pad(minute ?? 0)}`;
  return granularity === 'second' ? `${time}:${pad(second ?? 0)}` : time;
}

/** True when a time shows AM and PM: with `hourCycle` 12, or in a locale that uses them. */
export function usesDayPeriod(locale: string, hourCycle?: 12 | 24): boolean {
  if (hourCycle !== undefined) {
    return hourCycle === 12;
  }
  const cycle = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hourCycle;
  return cycle === 'h11' || cycle === 'h12';
}

/** The segments of a time in a locale, with the parts that are set. */
export function timeSegmentsOf(
  parts: DateParts,
  placeholder: TimeString,
  locale: string,
  granularity: TimeGranularity,
  hourCycle?: 12 | 24,
): Segment[] {
  const twelve = usesDayPeriod(locale, hourCycle);
  const base = timePartsOf(placeholder);
  const hour = parts.hour ?? base.hour!;
  const formatter = new DateFormatter(locale, {
    hour: 'numeric',
    minute: granularity === 'hour' ? undefined : '2-digit',
    second: granularity === 'second' ? '2-digit' : undefined,
    // The clock of the locale, unless `hourCycle` asks for one.
    ...(hourCycle === undefined
      ? {}
      : { hourCycle: hourCycle === 12 ? ('h12' as const) : ('h23' as const) }),
    timeZone: 'UTC',
  });
  const shown = new Date(
    Date.UTC(2000, 0, 1, hour, parts.minute ?? base.minute!, parts.second ?? base.second!),
  );
  return formatter.formatToParts(shown).map((part, index) => {
    const literal = {
      type: 'literal' as const,
      text: part.value,
      min: 0,
      max: 0,
      isPlaceholder: false,
      index,
    };
    if (part.type === 'dayPeriod') {
      // A period shows from the placeholder until the hour is set.
      return {
        type: 'dayPeriod',
        text: part.value,
        value: hour >= 12 ? 1 : 0,
        min: 0,
        max: 1,
        isPlaceholder: parts.hour === undefined,
        index,
      };
    }
    if (part.type !== 'hour' && part.type !== 'minute' && part.type !== 'second') {
      return literal;
    }
    const type = part.type;
    const value = parts[type];
    const shownValue = type === 'hour' && twelve && value !== undefined ? value % 12 || 12 : value;
    return {
      type,
      text: value === undefined ? PLACEHOLDERS[type] : part.value,
      value: shownValue,
      min: type === 'hour' && twelve ? 1 : 0,
      max: type === 'hour' && twelve ? 12 : TIME_MAX[type],
      isPlaceholder: value === undefined,
      index,
    };
  });
}

/** A part of a time stepped by `delta`, around its range. AM and PM step the hour by 12. */
export function stepTime(
  parts: DateParts,
  type: TimeSegmentType | 'dayPeriod',
  delta: number,
  placeholder: TimeString,
): DateParts {
  const base = timePartsOf(placeholder);
  if (type === 'dayPeriod') {
    return { ...parts, hour: ((parts.hour ?? base.hour!) + 12) % 24 };
  }
  const current = parts[type];
  if (current === undefined) {
    return { ...parts, [type]: base[type] };
  }
  const size = TIME_MAX[type] + 1;
  return { ...parts, [type]: (((current + delta) % size) + size) % size };
}

/**
 * A character typed into a part of a time: a digit, or `a` or `p` for AM or PM. On a 12-hour
 * clock, the hour keeps its period. The part is full when no other digit could follow.
 */
export function typeTime(
  parts: DateParts,
  type: TimeSegmentType | 'dayPeriod',
  typed: string,
  char: string,
  placeholder: TimeString,
  twelve: boolean,
): { parts: DateParts; typed: string; full: boolean } {
  const base = timePartsOf(placeholder);
  const hour = parts.hour ?? base.hour!;
  if (type === 'dayPeriod') {
    const letter = char.toLowerCase();
    if (letter !== 'a' && letter !== 'p') {
      return { parts, typed, full: false };
    }
    const pm = letter === 'p';
    return { parts: { ...parts, hour: (hour % 12) + (pm ? 12 : 0) }, typed: '', full: true };
  }
  if (char < '0' || char > '9') {
    return { parts, typed, full: false };
  }
  const max = type === 'hour' && twelve ? 12 : TIME_MAX[type];
  let text = `${typed}${char}`;
  let number = Number(text);
  if (number > max) {
    text = char;
    number = Number(char);
  }
  const full = number * 10 > max || text.length >= 2;
  // On a 12-hour clock, 12 is the first hour of its period.
  const value = type === 'hour' && twelve ? (number % 12) + (hour >= 12 ? 12 : 0) : number;
  return { parts: { ...parts, [type]: value }, typed: full ? '' : text, full };
}

/**
 * Moves focus to a segment, with the selection in it. The browser sends what the user types to
 * the editable element that holds the selection, which focus alone does not move.
 */
export function focusSegment(element: HTMLElement | undefined): void {
  if (!element) {
    return;
  }
  element.focus();
  window.getSelection()?.collapse(element, element.childNodes.length);
}
