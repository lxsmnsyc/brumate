import { Feature, fromJSON, toJSON } from 'seroval';
import { describe, expect, it, vi } from 'vitest';
import { parseSync } from 'oxc-parser';
import { entryClasses } from '../src/captures.ts';
import { serialOptions, syncPlugins } from '../src/runtime/serial.ts';
import { stateValues, useSerialEntry } from '../src/runtime/shared.ts';
import { definePlugin } from '../src/runtime/values.ts';
import { Money, plugins } from './render/money.ts';

useSerialEntry({ plugins });

describe('the serial entry', () => {
  it('sends a value of the app in calls, and makes it again', () => {
    const sent = toJSON(
      { total: new Money(250, 'EUR') },
      { plugins: syncPlugins, ...serialOptions() },
    );
    const read = fromJSON<{ total: Money }>(sent, { plugins: syncPlugins });
    expect(read.total).toBeInstanceOf(Money);
    expect(read.total.format()).toBe('2.50 EUR');
  });

  it('makes a value of the page state from its tag', () => {
    expect(stateValues.u('test/money', [100, 'USD'])).toEqual(new Money(100, 'USD'));
    expect(() => stateValues.u('test/missing', [])).toThrow(
      'No plugin reads the value "test/missing"',
    );
  });

  it('needs a tag of the app', () => {
    const plugin = { test: () => false, toData: () => 0, fromData: () => 0 };
    expect(() => definePlugin({ ...plugin, tag: 'brumate/money' })).toThrow('a tag of its own');
    expect(() => definePlugin({ ...plugin, tag: '' })).toThrow('a tag of its own');
  });

  it('changes the options of the serializer, and warns when it turns on what brumate turns off', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useSerialEntry({ depthLimit: 3 });
    expect(serialOptions()).toEqual({
      disabledFeatures: Feature.ErrorPrototypeStack | Feature.RegExp,
      depthLimit: 3,
    });
    expect(() =>
      toJSON({ a: { b: { c: { d: 1 } } } }, { plugins: syncPlugins, ...serialOptions() }),
    ).toThrow(/depth/i);
    expect(warn).not.toHaveBeenCalled();
    useSerialEntry({ disabledFeatures: Feature.ErrorPrototypeStack });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('turns on RegExp'));
    useSerialEntry({ disabledFeatures: Feature.ErrorPrototypeStack | Feature.RegExp });
    expect(serialOptions()).toEqual({
      disabledFeatures: Feature.ErrorPrototypeStack | Feature.RegExp,
    });
    warn.mockRestore();
  });

  it('reads the classes of an entry from its instanceof checks', () => {
    const source = `
      import { Decimal } from 'decimal.js';
      import * as money from './money';
      export const plugins = [
        definePlugin({ tag: 'a', test: (value) => value instanceof Decimal }),
        definePlugin({ tag: 'b', test: (value) => value instanceof money.Money }),
      ];`;
    expect(entryClasses(parseSync('serial.ts', source).program as never)).toEqual([
      'Decimal',
      'Money',
    ]);
  });
});
