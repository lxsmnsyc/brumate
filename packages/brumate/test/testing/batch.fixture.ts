// Run by test/testing.test.ts, in happy-dom, with the brumate plugin.
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

it('reads the profiles of the rows that the browser renders with one call', async () => {
  const restore = answerCalls();
  // The server render of the page calls through fetch too: a plain module, such as
  // profile.ts, imports the stubs in a DOM test.
  await expect(addRows(true)).resolves.toEqual(['getProfiles']);
  restore();
});
