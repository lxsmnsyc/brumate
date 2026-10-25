// The segments of a DateField, after useDateFieldState of React Aria: the month, the day and the
// year, in the order and with the separators of the locale. Each segment is set or empty. The
// field has a value once every segment is set. Dates are ISO strings, as in `calendar.ts`.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import { CalendarDate, DateFormatter, endOfMonth } from '@internationalized/date';
import type { DateString } from './calendar.ts';
import { toDate } from './calendar.ts';

/** A part of a date that a segment edits. */
export type SegmentType = 'year' | 'month' | 'day';

/** The parts of a date that are set. A part that is not set shows its placeholder. */
export type DateParts = Partial<Record<SegmentType, number>>;

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
  /** Types a digit into a part. True when the part is full, so focus moves to the next one. */
  type: (type: SegmentType, digit: number) => boolean;
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
const PLACEHOLDERS: Record<SegmentType, string> = { year: 'yyyy', month: 'mm', day: 'dd' };

/** The name of a part for screen readers. */
export const SEGMENT_NAMES: Record<SegmentType, string> = {
  year: 'year',
  month: 'month',
  day: 'day',
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
function rangeOf(type: SegmentType, parts: DateParts, placeholder: CalendarDate): [number, number] {
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

/** A part stepped by `delta`, around its range. A part that is not set takes the placeholder. */
export function stepPart(
  parts: DateParts,
  type: SegmentType,
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
  type: SegmentType,
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
export function erasePart(parts: DateParts, type: SegmentType): DateParts {
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
