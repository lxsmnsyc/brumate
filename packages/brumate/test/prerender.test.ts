import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { prerender, scriptHashes } from '../src/prerender.ts';
import type { PrerenderManifest } from '../src/prerender.ts';

const app = fileURLToPath(new URL('./.output/prerender-hashes/', import.meta.url));

function sha256(text: string): string {
  return `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;
}

describe('prerender', () => {
  it('hashes the inline scripts of a page, and not the scripts that load a file', () => {
    expect(
      scriptHashes(
        '<script b-state>$bR(1)</script><script type="module" async src="/a.js"></script><script>$bS(1)</script>',
      ),
    ).toEqual([sha256('$bR(1)'), sha256('$bS(1)')]);
  });

  it('writes the hashes of the inline scripts of each page to its manifest', async () => {
    rmSync(app, { recursive: true, force: true });
    mkdirSync(`${app}dist/client/.vite`, { recursive: true });
    writeFileSync(
      `${app}dist/client/.vite/manifest.json`,
      JSON.stringify({ 'src/client.ts': { file: 'assets/client.js', isEntry: true } }),
    );
    // A route handler as the server build has it, with a page that links to another.
    writeFileSync(
      `${app}routes.mjs`,
      `const pages = {
  '/': '<a href="/about">About</a><script b-state>$bR("home")</script>',
  '/about': '<p>About</p><script b-state>$bR("about")</script><script>$bS(1)</script>',
};
export async function handle(request, document) {
  const page = pages[new URL(request.url).pathname];
  const html = page === undefined ? '<p>Missing</p><script>$bR(404)</script>' : page + document.scripts;
  return new Response(html, {
    status: page === undefined ? 404 : 200,
    headers: { 'content-type': 'text/html' },
  });
}
`,
    );
    expect(await prerender(`${app}routes.mjs`, app, '/', {})).toEqual(['/', '/about', '404']);
    const manifest = JSON.parse(
      readFileSync(`${app}dist/client/.brumate/prerender.json`, 'utf8'),
    ) as PrerenderManifest;
    expect(manifest.pages).toEqual({
      '/': { file: 'index.html', scripts: [sha256('$bR("home")')] },
      '/about': { file: 'about/index.html', scripts: [sha256('$bR("about")'), sha256('$bS(1)')] },
      '404': { file: '404.html', scripts: [sha256('$bR(404)')] },
    });
    // Every hash once, for one policy that covers every page.
    expect(manifest.scripts.toSorted()).toEqual(
      [
        sha256('$bR("home")'),
        sha256('$bR("about")'),
        sha256('$bS(1)'),
        sha256('$bR(404)'),
      ].toSorted(),
    );
  });
});
