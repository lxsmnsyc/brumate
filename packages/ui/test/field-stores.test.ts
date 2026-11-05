// The field, form, calendar, date and color parts give changing values through stores. Their handlers still go through
// the context, and the compiler keeps an update of the context for them until the live path is gone.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from 'brumate';
import { expect, it } from 'vitest';

const PARTS = [
  'Label',
  'Input',
  'TextArea',
  'FieldError',
  'Group',
  'Form',
  'TextField',
  'SearchField',
  'NumberField',
  'ColorField',
  'ComboBox',
  'Select',
  'DateField',
  'DateRangePicker',
  'DatePicker',
  'TimeField',
  'Checkbox',
  'CheckboxGroup',
  'RadioGroup',
  'Switch',
  'Slider',
  'ColorSlider',
  'Meter',
  'ProgressBar',
  'TagGroup',
  'TokenField',
  'Calendar',
  'RangeCalendar',
  'CalendarGrid',
  'CalendarCell',
  'CalendarHeading',
  'DateInput',
  'DateSegment',
  'ColorPicker',
  'ColorArea',
  'ColorWheel',
  'ColorWheelTrack',
  'ColorThumb',
  'ColorSwatch',
  'ColorSwatchPicker',
  'ColorSwatchPickerItem',
];

const CONTEXTS = [
  'LabelContext',
  'InputContext',
  'TextAreaContext',
  'FieldErrorContext',
  'GroupContext',
  'FormContext',
];

// These hold handlers that read state in their body, so the scan looks at the value of each key
// of the provided object, and flags one that reads state outside a function. A function prop that a part forwards
// is a handler too.
const SHAPED = [
  'CalendarContext',
  'CalendarGridContext',
  'DatePickerContext',
  'DateFieldContext',
  'DateRangeFieldContext',
  'ColorThumbContext',
  'ColorWheelContext',
  'ColorPickerContext',
  'ColorSwatchContext',
];
const FORWARDED = new Set(['isDateUnavailable']);

/**
 * The keys of the object that an update gives the context, with their values as text. It splits
 * at the commas of the first level of the braces.
 */
function providedKeys(update: string): [string, string][] {
  const open = update.indexOf('{');
  const entries: [string, string][] = [];
  let depth = 0;
  let from = open + 1;
  for (let at = open; at < update.length; at++) {
    const char = update[at];
    if (char === '{' || char === '(' || char === '[') {
      depth++;
    } else if (char === '}' || char === ')' || char === ']') {
      depth--;
    }
    if ((char === ',' && depth === 1) || depth === 0) {
      const entry = update.slice(from, at).trim();
      const colon = entry.indexOf(':');
      if (entry && colon !== -1) {
        entries.push([entry.slice(0, colon).trim(), entry.slice(colon + 1)]);
      }
      from = at + 1;
      if (depth === 0) {
        break;
      }
    }
  }
  return entries;
}

/**
 * The compiled code that updates a context from the provider, up to the end of its function. A
 * store gives `$$b.madeStore`, and a handler `.bind`, so a value that reads state shows `$$b.get`.
 */
function liveUpdates(text: string, context: string): string[] {
  const found: string[] = [];
  let at = text.indexOf(`updateContext($$s, ${context}`);
  while (at !== -1) {
    const end = text.indexOf('\n}', at);
    found.push(text.slice(at, end));
    at = text.indexOf(`updateContext($$s, ${context}`, end);
  }
  return found;
}

it('passes the field, calendar, date and color contexts no changing value through the live context path', () => {
  const problems: string[] = [];
  let scanned = 0;
  let shaped = 0;
  for (const name of PARTS) {
    const path = join(import.meta.dirname, `../src/${name}.brm`);
    const { parts, client } = compile(readFileSync(path, 'utf8'), {
      filename: `${name}.brm`,
      path,
    });
    const text = [client, ...Object.values(parts)].join('\n');
    for (const context of SHAPED) {
      for (const update of liveUpdates(text, context)) {
        shaped++;
        for (const [key, value] of providedKeys(update)) {
          // A function reads state when it runs, which is the live path of a handler.
          const isFunction = value.includes('=>') || value.includes('.bind(');
          if (!isFunction && value.includes('$$b.get(') && !FORWARDED.has(key)) {
            problems.push(`${name} gives ${context} the changing value ${key} without a store`);
          }
        }
      }
    }
    for (const context of CONTEXTS) {
      for (const update of liveUpdates(text, context)) {
        scanned++;
        if (update.includes('$$b.get')) {
          problems.push(`${name} gives ${context} a changing value without a store`);
        }
      }
    }
  }
  // The handlers of TextField keep an update of InputContext, so a scan that finds none is broken.
  expect(scanned).toBeGreaterThan(0);
  // The calendar, date and color parts keep updates for their handlers, so none scanned is a broken scan.
  expect(shaped).toBeGreaterThan(0);
  expect(problems).toEqual([]);
});
