import { describe, expect, it } from 'vitest';
import { getCookies } from '../src/runtime/cookies.ts';
import { escape, escapeAttribute } from '../src/runtime/html.ts';
import { RequestEvent } from '../src/runtime/request.ts';
import { renderToStream } from '../src/runtime/server.ts';
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
