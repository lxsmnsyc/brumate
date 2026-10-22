// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { toJSON } from 'seroval';
import { getEvent } from '../src/runtime/request.ts';
import { handleRequest, handleRoute } from '../src/runtime/server.ts';
import type { Component } from '../src/runtime/server.ts';

// happy-dom drops `set-cookie` from the headers that a response is made with.
it('keeps the cookies of an answer in a DOM environment', async () => {
  const call = await handleRequest(
    {
      'Session#signIn': () => {
        getEvent().setCookie('session', 'ada');
      },
    },
    new Request(`http://localhost/_brumate/${encodeURIComponent('Session#signIn')}`, {
      method: 'POST',
      body: JSON.stringify(toJSON([])),
    }),
  );
  expect(call!.headers.getSetCookie()).toEqual([expect.stringMatching(/^session=ada;/)]);

  const Page: Component = async () => {
    getEvent().setCookie('seen', '1');
    return '<p>Hi</p>';
  };
  const page = await handleRoute(
    { page: async () => ({ default: Page }) },
    new Request('http://localhost/'),
  );
  expect(page!.headers.getSetCookie()).toEqual([expect.stringMatching(/^seen=1;/)]);
});
