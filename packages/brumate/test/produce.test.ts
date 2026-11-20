import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseSync } from 'oxc-parser';
import { compile } from '../src/index.ts';
import { produce } from '../src/runtime/produce.ts';

describe('produce', () => {
  const todos = [
    { id: '1', title: 'Docs', done: true, tags: ['a'] },
    { id: '2', title: 'Compiler', done: false, tags: ['b'] },
  ];

  it('returns the value itself when nothing changes', () => {
    expect(produce(todos, () => {})).toBe(todos);
    expect(
      produce(todos, (draft) => {
        draft[0]!.done = true;
      }),
    ).toBe(todos);
  });

  it('copies only what changes', () => {
    const next = produce(todos, (draft) => {
      draft[1]!.done = true;
    });
    expect(next).not.toBe(todos);
    expect(next[0]).toBe(todos[0]);
    expect(next[1]).toEqual({ ...todos[1], done: true });
    expect(next[1]!.tags).toBe(todos[1]!.tags);
    expect(todos[1]!.done).toBe(false);
  });

  it('supports array methods', () => {
    const next = produce(todos, (draft) => {
      draft.push({ id: '3', title: 'Ship', done: false, tags: [] });
      draft.splice(0, 1);
    });
    expect(next.map((todo) => todo.id)).toEqual(['2', '3']);
    expect(next[0]).toBe(todos[1]);
    expect(todos).toHaveLength(2);
  });

  it('keeps unchanged items when an array is reordered', () => {
    const next = produce(todos, (draft) => {
      draft.reverse();
    });
    expect(next[0]).toBe(todos[1]);
    expect(next[1]).toBe(todos[0]);
  });

  it('changes nested values', () => {
    const next = produce(todos, (draft) => {
      draft[0]!.tags.push('z');
    });
    expect(next[0]!.tags).toEqual(['a', 'z']);
    expect(next[1]).toBe(todos[1]);
    expect(todos[0]!.tags).toEqual(['a']);
  });

  it('deletes keys', () => {
    const user = { name: 'Ada', nickname: 'A' };
    const next = produce(user, (draft: { name: string; nickname?: string }) => {
      delete draft.nickname;
    });
    expect(next).toEqual({ name: 'Ada' });
    expect(user.nickname).toBe('A');
  });

  it('uses a returned value', () => {
    const open = produce(todos, (draft) => draft.filter((todo) => !todo.done));
    expect(open).toEqual([todos[1]]);
    expect(open[0]).toBe(todos[1]);
    expect(produce(1, (value) => value + 1)).toBe(2);
  });
});

describe('produce warning', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  class Counter {
    count = 0;
  }

  it('warns once for each name when a recipe changes a value that is not drafted and returns nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tags = new Counter();
    expect(produce(tags, (draft) => void draft.count++, 'warnOnce')).toBe(tags);
    expect(produce(tags, (draft) => void draft.count++, 'warnOnce')).toBe(tags);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toBe(
      '$produce(warnOnce) changed a Counter and returned nothing. Nothing updates. Return a new value, such as new Counter(warnOnce).',
    );
    produce(tags, () => {}, 'warnOther');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[1]![0]).toContain('$produce(warnOther)');
  });

  it('does not warn when the recipe returns a value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const next = new Counter();
    expect(produce(new Counter(), () => next, 'returned')).toBe(next);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn for objects, arrays and primitives', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    produce({ a: 1 }, (draft) => void draft.a++, 'object');
    produce([1], (draft) => void draft.push(2), 'array');
    produce(1, () => {}, 'primitive');
    produce(null, () => {}, 'nothing');
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn outside dev', () => {
    vi.stubEnv('DEV', false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    produce(new Counter(), () => {}, 'build');
    expect(warn).not.toHaveBeenCalled();
  });
});

const source = (call: string) => `<script>
import { $produce, $signal } from 'brumate/signals';
let tags = $signal(new Map<string, string>());
function add() {
  ${call}
}
</script>
<button onClick=add>Add</button>
<p>{tags.size}</p>
`;

function code(result: ReturnType<typeof compile>): string {
  return [result.server, result.client, ...Object.values(result.parts), result.render].join('\n');
}

describe('produce name', () => {
  it('passes the name of the signal in dev', () => {
    const result = compile(source('$produce(tags, (d) => { d.set("a", "b"); });'), {
      filename: 'T.brm',
    });
    expect(code(result)).toContain('"tags")');
    expect(result.server).toContain('$$b.produce(tags, (d) => { d.set("a", "b"); }, "tags")');
    expect(parseSync('t.ts', result.server).errors).toEqual([]);
  });

  it('leaves the name out of builds', () => {
    const result = compile(source('$produce(tags, (d) => { d.set("a", "b"); });'), {
      filename: 'T.brm',
      hideNames: true,
    });
    expect(code(result)).not.toContain(', "tags")');
  });

  it('keeps a trailing comma valid after a string with slashes', () => {
    const result = compile(source('$produce(tags, (d) => { d.set("u", "http://a"); }, );'), {
      filename: 'T.brm',
    });
    expect(result.server).toContain('"tags")');
    expect(parseSync('t.ts', result.server).errors).toEqual([]);
    for (const part of Object.values(result.parts)) {
      expect(parseSync('p.ts', part).errors).toEqual([]);
    }
  });

  it('keeps a trailing comma valid', () => {
    const result = compile(source('$produce(tags, (d) => { d.set("a", "b"); },);'), {
      filename: 'T.brm',
    });
    expect(parseSync('t.ts', result.server).errors).toEqual([]);
    for (const part of Object.values(result.parts)) {
      expect(parseSync('p.ts', part).errors).toEqual([]);
    }
  });
});

interface SetMethods {
  union(other: Set<string>): Set<string>;
  intersection(other: Set<string>): Set<string>;
  difference(other: Set<string>): Set<string>;
  symmetricDifference(other: Set<string>): Set<string>;
  isSubsetOf(other: Set<string>): boolean;
  isSupersetOf(other: Set<string>): boolean;
  isDisjointFrom(other: Set<string>): boolean;
}

describe('produce maps and sets', () => {
  interface Tag {
    id: string;
    done: boolean;
  }

  function makeTags(): Map<string, Tag> {
    return new Map([
      ['a', { id: 'a', done: false }],
      ['b', { id: 'b', done: false }],
      ['c', { id: 'c', done: false }],
    ]);
  }

  it('returns a new map and leaves the old one', () => {
    const tags = makeTags();
    const next = produce(tags, (draft) => {
      draft.set('d', { id: 'd', done: true });
    });
    expect(next).not.toBe(tags);
    expect(next).toBeInstanceOf(Map);
    expect(next.size).toBe(4);
    expect(tags.size).toBe(3);
  });

  it('returns the same map and set when nothing changes', () => {
    const tags = makeTags();
    const ids = new Set(['a', 'b']);
    expect(produce(tags, () => {})).toBe(tags);
    expect(
      produce(tags, (draft) => {
        draft.set('a', tags.get('a')!);
        draft.delete('missing');
        draft.get('a')!.done = false;
      }),
    ).toBe(tags);
    expect(produce(ids, () => {})).toBe(ids);
    expect(
      produce(ids, (draft) => {
        draft.add('a');
        draft.delete('z');
      }),
    ).toBe(ids);
    expect(produce(new Map(), (draft) => void draft.clear())).toBeInstanceOf(Map);
  });

  it('keeps the order of a copied map', () => {
    const tags = makeTags();
    const kept = produce(tags, (draft) => {
      draft.set('b', { id: 'b', done: true });
    });
    expect([...kept.keys()]).toEqual(['a', 'b', 'c']);
    const moved = produce(tags, (draft) => {
      const value = draft.get('a')!;
      draft.delete('a');
      draft.set('a', value);
    });
    expect([...moved.keys()]).toEqual(['b', 'c', 'a']);
    expect([...tags.keys()]).toEqual(['a', 'b', 'c']);
  });

  it('copies a changed value and the map, and shares the rest', () => {
    const tags = makeTags();
    const next = produce(tags, (draft) => {
      draft.get('b')!.done = true;
    });
    expect(next).not.toBe(tags);
    expect(next.get('b')).toEqual({ id: 'b', done: true });
    expect(next.get('b')).not.toBe(tags.get('b'));
    expect(next.get('a')).toBe(tags.get('a'));
    expect(next.get('c')).toBe(tags.get('c'));
    expect(tags.get('b')!.done).toBe(false);
  });

  it('finalizes a value that moved to another key once', () => {
    const tags = makeTags();
    const next = produce(tags, (draft) => {
      draft.get('a')!.done = true;
      draft.set('z', draft.get('a')!);
    });
    expect(next.get('z')).toBe(next.get('a'));
    expect(next.get('a')).toEqual({ id: 'a', done: true });
    expect(tags.get('a')!.done).toBe(false);
  });

  it('copies a map inside an object and leaves the old one', () => {
    const state = { byId: makeTags(), name: 'x' };
    const next = produce(state, (draft) => {
      draft.byId.set('d', { id: 'd', done: false });
    });
    expect(next.byId.size).toBe(4);
    expect(state.byId.size).toBe(3);
    expect(next).not.toBe(state);
    const same = produce(state, (draft) => {
      draft.byId.get('a');
    });
    expect(same).toBe(state);
  });

  it('drafts a set inside a map value', () => {
    const base = new Map([['a', { tags: new Set(['x']) }]]);
    const next = produce(base, (draft) => {
      draft.get('a')!.tags.add('y');
    });
    expect([...next.get('a')!.tags]).toEqual(['x', 'y']);
    expect([...base.get('a')!.tags]).toEqual(['x']);
  });

  it('drafts a map inside an array and in a set', () => {
    const list = [new Map([['a', 1]])];
    const next = produce(list, (draft) => {
      draft[0]!.set('b', 2);
    });
    expect([...next[0]!]).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
    expect(list[0]!.size).toBe(1);
    const item = { n: 1 };
    const set = new Set([item, { n: 2 }]);
    const changed = produce(set, (draft) => {
      for (const value of draft) {
        value.n++;
      }
    });
    expect([...changed].map((value) => value.n)).toEqual([2, 3]);
    expect(item.n).toBe(1);
  });

  it('reads the latest state through the iterators', () => {
    const tags = makeTags();
    produce(tags, (draft) => {
      draft.set('d', { id: 'd', done: false });
      draft.delete('a');
      expect(draft.size).toBe(3);
      expect(draft.has('a')).toBe(false);
      expect(draft.has('d')).toBe(true);
      expect([...draft.keys()]).toEqual(['b', 'c', 'd']);
      const seen: string[] = [];
      for (const [key, value] of draft) {
        seen.push(key + value.id);
      }
      draft.forEach((value, key) => {
        seen.push(key + value.id);
      });
      expect(seen).toEqual(['bb', 'cc', 'dd', 'bb', 'cc', 'dd']);
      expect([...draft.values()].map((value) => value.id)).toEqual(['b', 'c', 'd']);
      expect([...draft.entries()].map(([key]) => key)).toEqual(['b', 'c', 'd']);
      // The values are drafts, so a change through the loop is a change of the value.
      for (const value of draft.values()) {
        value.done = true;
      }
    });
    expect(tags.get('b')!.done).toBe(false);
  });

  it('reads the latest state of a set', () => {
    const ids = new Set(['a', 'b']);
    const next = produce(ids, (draft) => {
      draft.add('c');
      draft.delete('a');
      expect(draft.size).toBe(2);
      expect(draft.has('a')).toBe(false);
      expect([...draft]).toEqual(['b', 'c']);
      expect([...draft.entries()]).toEqual([
        ['b', 'b'],
        ['c', 'c'],
      ]);
      const seen: string[] = [];
      draft.forEach((value, same) => {
        seen.push(value + same);
      });
      expect(seen).toEqual(['bb', 'cc']);
    });
    expect([...next]).toEqual(['b', 'c']);
    expect([...ids]).toEqual(['a', 'b']);
    expect(produce(ids, (draft) => void draft.clear()).size).toBe(0);
  });

  it('is an instance of Map and Set', () => {
    produce(new Map(), (draft) => {
      expect(draft instanceof Map).toBe(true);
    });
    produce(new Set(), (draft) => {
      expect(draft instanceof Set).toBe(true);
    });
  });

  it('never drafts keys', () => {
    const key = { id: 1 };
    const map = new Map([[key, { done: false }]]);
    const next = produce(map, (draft) => {
      draft.get(key)!.done = true;
    });
    expect([...next.keys()][0]).toBe(key);
    expect(() =>
      produce({ keys: map, other: new Map() }, (draft) => {
        for (const value of draft.keys.values()) {
          void value;
        }
        draft.other.set(draft, 1);
      }),
    ).toThrow(TypeError);
  });

  it('replaces a drafted value that is set again to its base value', () => {
    const tags = makeTags();
    const baseA = tags.get('a')!;
    const next = produce(tags, (draft) => {
      draft.get('a')!.done = true;
      draft.set('a', baseA);
      draft.set('b', { id: 'b', done: false });
    });
    expect(next.get('a')).toBe(baseA);
    expect(baseA.done).toBe(false);
    const state = { a: { x: 1 }, n: 0 };
    const changed = produce(state, (draft) => {
      draft.a.x = 9;
      draft.a = state.a;
      draft.n = 1;
    });
    expect(changed.a).toBe(state.a);
    expect(changed.a.x).toBe(1);
    // Setting a value to itself changes nothing.
    expect(
      produce(state, (draft) => {
        draft.a = state.a;
      }),
    ).toBe(state);
  });

  it('runs the methods of Set that take another set', () => {
    const ids = new Set(['a', 'b']);
    produce(ids, (set) => {
      set.add('c');
      // The library of the package does not have the methods yet.
      const draft = set as unknown as SetMethods;
      expect([...draft.union(new Set(['z']))]).toEqual(['a', 'b', 'c', 'z']);
      expect([...draft.intersection(new Set(['c', 'a']))].toSorted()).toEqual(['a', 'c']);
      expect([...draft.difference(new Set(['a']))]).toEqual(['b', 'c']);
      expect([...draft.symmetricDifference(new Set(['a', 'q']))].toSorted()).toEqual([
        'b',
        'c',
        'q',
      ]);
      expect(draft.isSubsetOf(new Set(['a', 'b', 'c', 'd']))).toBe(true);
      expect(draft.isSupersetOf(new Set(['c']))).toBe(true);
      expect(draft.isDisjointFrom(new Set(['x']))).toBe(true);
    });
  });

  it('uses a returned map that holds drafts', () => {
    const state = [{ n: 1 }, { n: 2 }];
    const next = produce(state, (draft) => {
      draft[0]!.n = 5;
      return new Map(draft.map((item) => [item.n, item])) as never;
    }) as unknown as Map<number, { n: number }>;
    expect(next.get(5)).toEqual({ n: 5 });
    expect(state[0]!.n).toBe(1);
  });

  it('leaves instances of other classes as they are, and warns', () => {
    class Box {
      items = new Map<string, number>();
    }
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const box = new Box();
    const next = produce(box, (draft) => void draft.items.set('a', 1), 'boxes');
    expect(next).toBe(box);
    expect(console.warn).toHaveBeenCalledOnce();
    class Sub extends Map<string, number> {}
    const sub = new Sub();
    expect(produce(sub, (draft) => void draft.set('a', 1), 'subs')).toBe(sub);
    expect(console.warn).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });
});
