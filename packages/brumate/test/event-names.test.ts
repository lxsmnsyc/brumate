import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { CAMEL_EVENTS, camelEventName } from '../src/event-names.ts';

it('lists the camel names that ElementEventNames in elements.d.ts declares', () => {
  const types = readFileSync(new URL('../elements.d.ts', import.meta.url), 'utf8');
  const body = /export interface ElementEventNames \{([^}]*)\}/.exec(types)![1]!;
  const declared = [...body.matchAll(/(\w+): '(\w+)';/g)].map((match) => {
    expect(match[2]!.toLowerCase()).toBe(match[1]);
    return match[2]!;
  });
  expect(declared).toEqual([...CAMEL_EVENTS]);
});

it('names the camel form of a lower-case handler', () => {
  expect(camelEventName('onKeydown')).toBe('onKeyDown');
  expect(camelEventName('onKeyDown')).toBeUndefined();
  expect(camelEventName('onClick')).toBeUndefined();
});
