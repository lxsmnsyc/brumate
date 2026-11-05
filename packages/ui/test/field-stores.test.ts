// The field and form parts give changing values through stores. Their handlers still go through
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
];

const CONTEXTS = [
  'LabelContext',
  'InputContext',
  'TextAreaContext',
  'FieldErrorContext',
  'GroupContext',
  'FormContext',
];

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

it('passes the field contexts no changing value through the live context path', () => {
  const problems: string[] = [];
  let scanned = 0;
  for (const name of PARTS) {
    const path = join(import.meta.dirname, `../src/${name}.brm`);
    const { parts, client } = compile(readFileSync(path, 'utf8'), {
      filename: `${name}.brm`,
      path,
    });
    const text = [client, ...Object.values(parts)].join('\n');
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
  expect(problems).toEqual([]);
});
