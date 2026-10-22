import { execFileSync, spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, expect, it } from 'vitest';

// Builds the app with Nitro's Node preset, runs the output, and uses it as a browser
// without scripts would.
const root = new URL('..', import.meta.url).pathname;
const port = 5390;
let server: ChildProcess | undefined;

beforeAll(async () => {
  // Vitest sets NODE_ENV to `test`, which would build for development.
  const env = { ...process.env, NODE_ENV: 'production' };
  execFileSync('pnpm', ['exec', 'vite', 'build'], { cwd: root, env, stdio: 'ignore' });
  server = spawn('node', ['.output/server/index.mjs'], {
    cwd: root,
    env: { ...env, PORT: String(port) },
    stdio: 'ignore',
  });
  for (let tries = 0; tries < 100; tries++) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- It waits for the server to start.
      await fetch(`http://localhost:${port}/`);
      return;
    } catch {
      // oxlint-disable-next-line no-await-in-loop -- It waits between tries.
      await new Promise((done) => setTimeout(done, 100));
    }
  }
}, 120_000);

afterAll(() => {
  server?.kill();
});

it('renders a page with the built client entry', async () => {
  const html = await fetch(`http://localhost:${port}/`).then((response) => response.text());
  expect(html).toContain('<h1>Notes</h1>');
  expect(html).toMatch(/<script type="module" async src="\/assets\/client-[\w-]+\.js"><\/script>/);
  expect(html).not.toContain('/@vite/client');
});

it('serves the client entry, and answers a form post with the page', async () => {
  const html = await fetch(`http://localhost:${port}/`).then((response) => response.text());
  const entry = /src="(\/assets\/client-[\w-]+\.js)"/.exec(html)![1]!;
  expect((await fetch(`http://localhost:${port}${entry}`)).status).toBe(200);
  const action = /<form action="([^"]+)"/.exec(html)![1]!.replaceAll('&amp;', '&');
  const answer = await fetch(`http://localhost:${port}/${action}`, {
    method: 'POST',
    body: new URLSearchParams({ text: 'From the test' }),
    headers: { origin: `http://localhost:${port}` },
  });
  // The page renders again with the new note, in the element that marks its item.
  expect(await answer.text()).toMatch(/<li b-b="[\d.:]+">From the test<\/li>/);
});
