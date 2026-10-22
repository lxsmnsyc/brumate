// Run by test/testing.test.ts, in happy-dom, with the brumate plugin. A file of its own, so
// its mount is the first of the document: a mount after a click reads its state as if it
// streamed in later, and loads its memos again.
import { expect, it } from 'vitest';
import { answerCalls, mount } from 'virtual:brumate/testing';
import Lobby from './Lobby.brm?brumate-server';

/** Adds three rows in the browser, and returns the server function calls that they made. */
async function addRows(batch: boolean): Promise<string[]> {
  const page = await mount(Lobby, { batch });
  expect(page.text('li')).toBe('Player 1');
  const calls: string[] = [];
  const restore = answerCalls({ onCall: (id) => calls.push(id.split('#')[1]!) });
  page.click('.more');
  await page.waitFor(() =>
    expect([...page.container.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      'Player 1',
      'Player 2',
      'Player 3',
      'Player 4',
    ]),
  );
  page.unmount();
  restore();
  return calls;
}

it('calls a server function once for each row that the browser renders', async () => {
  await expect(addRows(false)).resolves.toEqual(['getProfiles', 'getProfiles', 'getProfiles']);
});
