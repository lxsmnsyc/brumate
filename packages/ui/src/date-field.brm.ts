// The segments of one date, after useDateFieldState of React Aria, for a DateField and for each
// date of a DateRangePicker. A component passes its value and its limits, and gets the segments,
// the date that they hold, and the functions of the DateFieldContext.
import { $effect, $memo, $signal, $untrack } from 'brumate/signals';
import type { DateString } from './calendar.ts';
import {
  dateOf,
  erasePart,
  isDatePart,
  partsOf,
  segmentsOf,
  stepPart,
  typeDigit,
} from './segments.ts';
import type { DateParts, SegmentType } from './segments.ts';

/**
 * The segments of a date. `date` is the date of the segments once all of them are set, or null.
 * The component writes it into its own value. A new `value` from the component shows in the
 * segments.
 */
export function dateSegments(
  value: DateString | null,
  placeholder: DateString,
  locale: string,
  isDisabled: boolean,
  isReadOnly: boolean,
) {
  // The parts that are set, and the digits typed into the segment that has focus.
  let parts = $signal<DateParts>(partsOf(value));
  let typed = $signal('');
  const segments = $memo(segmentsOf(parts, placeholder, locale));
  const date = $memo(dateOf(parts));

  $effect(() => {
    const next = value;
    if ($untrack(dateOf(parts)) !== next) {
      $untrack((parts = partsOf(next)));
    }
  });

  return {
    segments,
    date,
    step: (type: SegmentType, delta: number) => {
      if (!isDisabled && !isReadOnly && isDatePart(type)) {
        typed = '';
        parts = stepPart(parts, type, delta, placeholder);
      }
    },
    type: (type: SegmentType, char: string) => {
      if (isDisabled || isReadOnly || !isDatePart(type) || char < '0' || char > '9') {
        return false;
      }
      const next = typeDigit(parts, type, typed, Number(char), placeholder);
      typed = next.typed;
      parts = next.parts;
      return next.full;
    },
    erase: (type: SegmentType) => {
      if (isDisabled || isReadOnly || !isDatePart(type)) {
        return false;
      }
      typed = '';
      const empty = parts[type] === undefined;
      parts = erasePart(parts, type);
      return empty;
    },
    settle: () => {
      typed = '';
    },
  };
}
