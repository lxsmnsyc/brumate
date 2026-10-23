import { describe, expect, it } from 'vitest';
import { getCookies } from '../src/runtime/cookies.ts';
import {
  attribute,
  classAttribute,
  classValue,
  escape,
  escapeAttribute,
} from '../src/runtime/html.ts';
import { RequestEvent } from '../src/runtime/request.ts';
import { Context, render, renderToStream } from '../src/runtime/server.ts';
import type { Component } from '../src/runtime/server.ts';

async function text(stream: ReadableStream<string>): Promise<string> {
  let result = '';
  for await (const chunk of stream) {
    result += chunk;
  }
  return result;
}

const Upper: Component<object> = async () => '<HTML><HEAD></HEAD><BODY>x</BODY></HTML>';
const NoHead: Component<object> = async () => '<html><body>x</body></html>';

describe('escape', () => {
  it('returns text without special characters as it is', () => {
    expect(escape('plain text')).toBe('plain text');
    expect(escapeAttribute('plain "text"')).toBe('plain &quot;text&quot;');
    expect(escape('a < b & c > d "e"')).toBe('a &lt; b &amp; c &gt; d "e"');
    expect(escapeAttribute('a < b & c > d')).toBe('a &lt; b &amp; c > d');
  });
});

// The joins that classValue made before it was a loop.
function joined(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(joined).filter(Boolean).join(' ');
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name)
      .join(' ');
  }
  return value ? String(value) : '';
}

describe('classValue', () => {
  it.each([
    [{ a: true, b: 0, c: 'x' }],
    [{ '': true, b: true }],
    [{ b: true, '': true }],
    [{ 2: true, a: true, 1: true }],
    [Object.create({ inherited: true }, { own: { value: true, enumerable: true } })],
    // oxlint-disable-next-line no-sparse-arrays -- A hole renders nothing.
    [['a', , '', { b: true, c: false }, [['d'], {}], 0, 'e  f']],
    [[]],
    ['a b'],
    [0],
    [new Map([['a', true]])],
  ])('joins %j as before', (value) => {
    expect(classValue(value)).toBe(joined(value));
  });

  it('renders the attribute that the compiler builds, with a space before each class', () => {
    expect(classAttribute('')).toBe('');
    expect(classAttribute(' a b')).toBe(attribute('class', ['a', 'b']));
  });
});

describe('attributes with true and false', () => {
  it('renders the words of an attribute that says its state in its value', () => {
    expect(attribute('aria-hidden', true)).toBe(' aria-hidden="true"');
    expect(attribute('aria-expanded', false)).toBe(' aria-expanded="false"');
    expect(attribute('data-active', false)).toBe(' data-active="false"');
    expect(attribute('draggable', true)).toBe(' draggable="true"');
    expect(attribute('contentEditable', false)).toBe(' contentEditable="false"');
    expect(attribute('spellcheck', false)).toBe(' spellcheck="false"');
    expect(attribute('translate', false)).toBe(' translate="no"');
    expect(attribute('autocomplete', false)).toBe(' autocomplete="off"');
    expect(attribute('autocorrect', true)).toBe(' autocorrect="on"');
  });

  it('keeps the presence of other attributes, and leaves any attribute out for null', () => {
    expect(attribute('disabled', true)).toBe(' disabled');
    expect(attribute('disabled', false)).toBe('');
    expect(attribute('pill', false)).toBe('');
    expect(attribute('aria-expanded', null)).toBe('');
    expect(attribute('aria-expanded', undefined)).toBe('');
    expect(attribute('aria-label', 'Close')).toBe(' aria-label="Close"');
    expect(attribute('hidden', 'until-found')).toBe(' hidden="until-found"');
  });
});

describe('the first render', () => {
  it('finds the head and body end in any case', async () => {
    const html = await text(renderToStream(Upper, {}, { head: '<meta a>', scripts: '<s>' }));
    expect(html).toMatch(
      /^<!doctype html><HTML><HEAD><meta a><\/HEAD><BODY>x.*<s><\/BODY><\/HTML>$/,
    );
  });

  it('adds a head before the body, and the scripts before its end', async () => {
    const html = await text(renderToStream(NoHead, {}, { head: '<meta a>', scripts: '<s>' }));
    expect(html).toMatch(
      /^<!doctype html><html><head><meta a><\/head><body>x.*<s><\/body><\/html>$/,
    );
  });
});

/** Renders two `#loading` bodies whose data arrives in `order`, and returns the scope IDs. */
async function bodyIds(order: number[]): Promise<unknown[]> {
  const ctx = new Context();
  const opens: (() => void)[] = [];
  const ids: unknown[][] = [[], []];
  const renders: Promise<unknown>[] = [];
  ctx.watch((boundary) => renders.push(boundary.render));
  for (const n of [0, 1]) {
    const data = new Promise<void>((open) => opens.push(open));
    ctx.defer(ctx.boundary(), async (body) => {
      await data;
      ids[n]!.push(body.scope(1), body.scope(1));
      return '';
    });
  }
  ids.push([ctx.scope(1)]);
  for (const n of order) {
    opens[n]!();
    // oxlint-disable-next-line no-await-in-loop -- Each body resumes before the next opens.
    await renders[n];
  }
  return ids;
}

describe('scope IDs', () => {
  it('numbers the scopes of #loading bodies the same whatever order their data arrives in', async () => {
    const first = await bodyIds([0, 1]);
    expect(first).toEqual([['0.0', '0.1'], ['1.0', '1.1'], [0]]);
    expect(await bodyIds([1, 0])).toEqual(first);
  });

  it('makes $id IDs inside a #loading body that work as selectors', () => {
    const ctx = new Context();
    expect(ctx.id('5.1', 0)).toBe('b5_1-0');
    expect(ctx.id(3, 2)).toBe('b3-2');
  });
});

const shared = { name: 'shared' };

/** A component with one scope, whose slots hold `values`. */
function withSlots(values: unknown[]): Component<object> {
  return async (_props, ctx) => {
    ctx.slots(ctx.scope(1, undefined, 'T_1'), values);
    return '<p>x</p>';
  };
}

describe('the page state', () => {
  it('assigns only shared references when no later record reads them', async () => {
    const { state, pending } = await render(withSlots([[1, 2], { a: 1 }, shared, shared]), {});
    expect(state).toContain('$bR(($R,$b)=>(({0:{k:1,m:"T_1",s:[[1,2],{a:1},$R[');
    expect(state.match(/\$R\[\d+\]=/g)).toHaveLength(1);
    const later: string[] = [];
    for await (const chunk of pending) {
      later.push(chunk);
    }
    expect(later).toEqual([]);
  });

  it('streams a state with a promise, and settles it in a later record', async () => {
    const { state, pending } = await render(withSlots([shared, Promise.resolve(shared)]), {});
    const later: string[] = [];
    for await (const chunk of pending) {
      later.push(chunk);
    }
    // The later record refers to the shared object of the first one.
    const id = /\$R\[(\d+)\]=\{name:"shared"\}/.exec(state)![1];
    expect(later.join('')).toContain(`$R[${id}]`);
  });
});

describe('getCookies', () => {
  it('returns a copy, with the cookies that the event set', () => {
    const event = new RequestEvent(
      new Request('http://localhost/', { headers: { cookie: 'a=1; b=2' } }),
    );
    const first = getCookies(event);
    first.a = 'changed';
    expect(getCookies(event)).toEqual({ a: '1', b: '2' });
    event.setCookie('c', '3');
    event.deleteCookie('b');
    expect(getCookies(event)).toEqual({ a: '1', c: '3' });
    expect(event.headers.getSetCookie()[1]).toBe(
      'b=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
    );
  });
});
