// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { shiftState } from '../src/runtime/client-routes.ts';
import {
  Binding,
  ChildrenReference,
  ElementReference,
  FunctionReference,
  SCOPE_IDS,
  SlotReference,
  shiftId,
} from '../src/runtime/shared.ts';
import type { PageState, ScopeId, ScopeState } from '../src/runtime/shared.ts';

const by = 100;

/** A record with every field of `ScopeState`, and an ID or a reference in each that can hold one. */
function fullRecord(): Required<ScopeState> {
  return {
    k: 1,
    p: 1,
    m: 'Card_x1',
    i: { a: new ElementReference(2, 0), list: [new FunctionReference('Card_x1#h0', 2, [3])] },
    o: 2,
    t: 3,
    f: 4,
    v: { key: new ChildrenReference('Card_x1#n0', 5) },
    x: { key: 0 },
    s: [new SlotReference(6, 1), [new ElementReference('7.0', 1)], Promise.resolve(1)],
    c: { 0: 8, 1: '9.1' },
    b: { 0: new SlotReference(10, 2), 1: new FunctionReference('Card_x1#h1', '11.0') },
  };
}

/** A binding of a rest prop, whose slot and setter hold IDs. */
function binding(): Binding {
  return new Binding(1, new SlotReference(2, 3), new FunctionReference('X#h', 2));
}

/** Every scope ID that a reference holds in a value, found by walking it. */
async function idsOf(value: unknown, found: ScopeId[] = []): Promise<ScopeId[]> {
  if (value instanceof Promise) {
    return idsOf(await value, found);
  }
  if (
    value instanceof ElementReference ||
    value instanceof FunctionReference ||
    value instanceof ChildrenReference ||
    value instanceof SlotReference
  ) {
    found.push(value.scope);
  } else if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) {
      await idsOf(item, found);
    }
  }
  return found;
}

describe('the table of scope IDs', () => {
  it('names every field of a state record', () => {
    expect(Object.keys(SCOPE_IDS.fields).sort()).toEqual(Object.keys(fullRecord()).sort());
  });

  it('names every reference class that holds a scope ID', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/runtime/shared.ts'), 'utf8');
    const holders = [...source.matchAll(/export class (\w+)\b[^{]*\{([^}]*?)constructor/gs)]
      .filter((match) => /readonly scope: ScopeId/.test(match[2]!))
      .map((match) => match[1]);
    const named = SCOPE_IDS.references.map((type) => type.name);
    expect(holders.length).toBeGreaterThan(0);
    expect(named.sort()).toEqual(holders.sort());
  });

  it('names every class that holds a reference with an ID', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/runtime/shared.ts'), 'utf8');
    const named = SCOPE_IDS.references.map((type) => type.name);
    const typed = new RegExp(`\\b(${named.join('|')})\\b`);
    const holders = [...source.matchAll(/export class (\w+)\b[^{]*\{([^}]*?)constructor/gs)]
      .filter((match) => !named.includes(match[1]!) && typed.test(match[2]!))
      .map((match) => match[1]);
    expect(holders).toContain('Binding');
    expect(SCOPE_IDS.holders.map((type) => type.name).sort()).toEqual(holders.sort());
  });

  it('moves the IDs of a binding', () => {
    const state: PageState = { 1: { s: [binding()], b: { 0: binding() } } };
    const record = shiftState(SCOPE_IDS, state, by)[101]!;
    for (const item of [record.s![0], record.b![0]] as Binding[]) {
      expect(item).toBeInstanceOf(Binding);
      expect((item.ref as SlotReference).scope).toBe(102);
      expect((item.set as FunctionReference).scope).toBe(102);
      expect(item.ref.slot).toBe(3);
      expect(item.value).toBe(1);
    }
  });

  it('moves every ID of a record', async () => {
    const state: PageState = { 1: fullRecord() };
    const before = await idsOf(state);
    const moved = shiftState(SCOPE_IDS, state, by);
    expect(Object.keys(moved)).toEqual(['101']);
    const record = moved[101]!;
    expect([record.p, record.o, record.t, record.f]).toEqual([101, 102, 103, 104]);
    expect(record.c).toEqual({ 0: 108, 1: '109.1' });
    // Every reference moved. None keeps its old ID.
    const after = await idsOf(moved);
    expect(before).toHaveLength(7);
    expect(after).toEqual(before.map((id) => shiftId(id, by)));
    // The fields without IDs stay.
    expect([record.k, record.m, record.x]).toEqual([1, 'Card_x1', { key: 0 }]);
  });
});
