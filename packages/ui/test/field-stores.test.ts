// The parts of the library give changing values through stores. Their handlers still go through
// the context, and the compiler keeps an update of the context for them until the live path is gone.
import { readFileSync, readdirSync } from 'node:fs';
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
// A handler that a part passes on, from a prop or from the context above, reads state to find it.
// The exemption is for these keys of these parts only, so another part that reads state is caught.
const FORWARDED = new Map<string, Set<string>>([
  ['Calendar', new Set(['isDateUnavailable'])],
  ['DatePicker', new Set(['isDateUnavailable'])],
  ['DateRangePicker', new Set(['isDateUnavailable'])],
  ['Autocomplete', new Set(['filter'])],
  ['ListBox', new Set(['setActive'])],
  ['Menu', new Set(['setActive'])],
]);

// The collection, menu, select and combobox parts.
const COLLECTION_PARTS = [
  'ListBox',
  'ListBoxItem',
  'GridList',
  'GridListItem',
  'Tree',
  'TreeItem',
  'Table',
  'TableHeader',
  'TableBody',
  'Column',
  'ColumnResizer',
  'Row',
  'Cell',
  'ResizableTableContainer',
  'NavigationTree',
  'NavigationTreeItem',
  'NavigationTreeItemLink',
  'Menu',
  'MenuItem',
  'MenuTrigger',
  'SubmenuTrigger',
  'Select',
  'SelectValue',
  'ComboBox',
  'Autocomplete',
  'Input',
  'TextArea',
  'ColorSwatchPicker',
];

// Stores alone: the whole value of the context is a store.
const COLLECTION_CONTEXTS = [
  'SelectValueContext',
  'FieldInputContext',
  'NavigationTreeContext',
  'NavigationLinkContext',
];

// A store beside handlers.
const COLLECTION_SHAPED = [
  'ListBoxContext',
  'ListBoxGivenContext',
  'CollectionFocusContext',
  'MenuContext',
  'MenuTriggerContext',
  'SubmenuContext',
  'TableContext',
  'TableResizeContext',
  'TreeContext',
];

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

function scan(parts: string[], contexts: string[], shapedContexts: string[]) {
  const problems: string[] = [];
  let scanned = 0;
  let shaped = 0;
  for (const name of parts) {
    const path = join(import.meta.dirname, `../src/${name}.brm`);
    const { parts, client } = compile(readFileSync(path, 'utf8'), {
      filename: `${name}.brm`,
      path,
    });
    const text = [client, ...Object.values(parts)].join('\n');
    for (const context of shapedContexts) {
      for (const update of liveUpdates(text, context)) {
        shaped++;
        for (const [key, value] of providedKeys(update)) {
          // A function reads state when it runs, which is the live path of a handler.
          const isFunction = value.includes('=>') || value.includes('.bind(');
          if (!isFunction && value.includes('$$b.get(') && !FORWARDED.get(name)?.has(key)) {
            problems.push(`${name} gives ${context} the changing value ${key} without a store`);
          }
        }
      }
    }
    for (const context of contexts) {
      for (const update of liveUpdates(text, context)) {
        scanned++;
        if (update.includes('$$b.get')) {
          problems.push(`${name} gives ${context} a changing value without a store`);
        }
      }
    }
  }
  return { problems, scanned, shaped };
}

it('passes the field, calendar, date and color contexts no changing value through the live context path', () => {
  const { problems, scanned, shaped } = scan(PARTS, CONTEXTS, SHAPED);
  // The handlers of TextField keep an update of InputContext, so a scan that finds none is broken.
  expect(scanned).toBeGreaterThan(0);
  // The calendar, date and color parts keep updates for their handlers, so none scanned is a broken scan.
  expect(shaped).toBeGreaterThan(0);
  expect(problems).toEqual([]);
});

it('passes the collection, menu, select and combobox contexts no changing value through the live context path', () => {
  const { problems, shaped } = scan(COLLECTION_PARTS, COLLECTION_CONTEXTS, COLLECTION_SHAPED);
  // The providers that hold handlers keep an update of the context for them, so a scan that
  // finds none is broken.
  expect(shaped).toBeGreaterThan(10);
  expect(problems).toEqual([]);
});

/** The `.brm` parts of the library. */
function partNames(): string[] {
  const names: string[] = [];
  for (const file of readdirSync(join(import.meta.dirname, '../src'))) {
    if (file.endsWith('.brm')) {
      names.push(file.slice(0, -'.brm'.length));
    }
  }
  return names;
}

/** The contexts that the compiled code of a part updates. */
function updatedContexts(text: string): Set<string> {
  const found = new Set<string>();
  for (const match of text.matchAll(/updateContext\(\$\$s, (\w+)/g)) {
    found.add(match[1]!);
  }
  return found;
}

it('passes no context of any part a changing value through the live context path', () => {
  const problems: string[] = [];
  let updates = 0;
  let buttons = 0;
  const contexts = new Set<string>();
  for (const name of partNames()) {
    const path = join(import.meta.dirname, `../src/${name}.brm`);
    const { parts, client } = compile(readFileSync(path, 'utf8'), {
      filename: `${name}.brm`,
      path,
    });
    const text = [client, ...Object.values(parts)].join('\n');
    for (const context of updatedContexts(text)) {
      contexts.add(context);
      for (const update of liveUpdates(text, context)) {
        updates++;
        if (context === 'ButtonContext') {
          buttons++;
        }
        if (
          !update
            .slice(update.indexOf(`${context},`) + context.length + 1)
            .trimStart()
            .startsWith('{')
        ) {
          // A store, or a value that is no object.
          if (update.includes('$$b.get(')) {
            problems.push(`${name} gives ${context} a changing value without a store`);
          }
          continue;
        }
        for (const [key, value] of providedKeys(update)) {
          // A function reads state when it runs, which is the live path of a handler.
          const isFunction = value.includes('=>') || value.includes('.bind(');
          if (!isFunction && value.includes('$$b.get(') && !FORWARDED.get(name)?.has(key)) {
            problems.push(`${name} gives ${context} the changing value ${key} without a store`);
          }
        }
      }
    }
  }
  // The providers of handlers keep an update of their context, so a scan that finds few is broken.
  expect(updates).toBeGreaterThan(40);
  expect(contexts.size).toBeGreaterThan(20);
  expect(buttons).toBeGreaterThan(5);
  expect(problems).toEqual([]);
});

it('compiles no part of the library with a warning that a context value reads a changing name', () => {
  const found: string[] = [];
  let compiled = 0;
  for (const name of partNames()) {
    const path = join(import.meta.dirname, `../src/${name}.brm`);
    const { warnings } = compile(readFileSync(path, 'utf8'), { filename: `${name}.brm`, path });
    compiled++;
    for (const warning of warnings) {
      if (warning.message.includes('context value reads')) {
        found.push(`${name}: ${warning.message}`);
      }
    }
  }
  expect(compiled).toBeGreaterThan(100);
  expect(found).toEqual([]);
});
