import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { toJSON } from 'seroval';
import { pruneBuilds, readBuildId } from '../src/builds.ts';
import { handleRequest, handleRoute, render } from '../src/runtime/server.ts';
import type { Component, RouteNode } from '../src/runtime/server.ts';

const Page: Component = async (_props, ctx) => {
  ctx.slots(ctx.scope(1, undefined, 'Page'), [1]);
  return '<p>Hi</p>';
};

describe('the build of a page', () => {
  it('is on the first state record', async () => {
    const { state } = await render(Page, {}, { build: 'b1' });
    expect(state).toMatch(/^<script b-state b-scopes b-next="\d+" b-build="b1">/);
    const { state: without } = await render(Page, {});
    expect(without).not.toContain('b-build');
  });
});

/** The request for a `#defer` body, from a page of a build. */
function deferRequest(build: string): Request {
  return new Request('http://localhost/', {
    headers: { 'x-brumate-defer': '1 0:1', 'x-brumate-build': build },
  });
}

describe('calls from another build', () => {
  const functions = { greet: (name: string) => `Hello ${name}` };
  const call = (id: string, build?: string): Promise<Response | undefined> =>
    handleRequest(
      functions,
      new Request(`http://localhost/_brumate/${id}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(build === undefined ? {} : { 'x-brumate-build': build }),
        },
        body: JSON.stringify(toJSON(['Ada'])),
      }),
      '/_brumate',
      { build: 'b2' },
    );

  it('run when the function still exists', async () => {
    const response = await call('greet', 'b1');
    expect(response?.status).toBe(200);
  });

  it('answer 409 with the build of the server when the function is gone', async () => {
    const response = await call('gone', 'b1');
    expect(response?.status).toBe(409);
    expect(response?.headers.get('x-brumate-build')).toBe('b2');
    expect(await response!.json()).toEqual({ error: 'The site changed. Load the page again' });
  });

  it('answer 404 to an unknown function of the same build, or of no build', async () => {
    expect((await call('gone', 'b2'))?.status).toBe(404);
    expect((await call('gone'))?.status).toBe(404);
  });

  it('answer 409 to the request for a #defer body from another build', async () => {
    const tree: RouteNode = { page: () => Promise.resolve({ default: Page }) };
    const skewed = await handleRoute(tree, deferRequest('b1'), { build: 'b2' });
    expect(skewed?.status).toBe(409);
    expect(skewed?.headers.get('x-brumate-build')).toBe('b2');
    const same = await handleRoute(tree, deferRequest('b2'), { build: 'b2' });
    expect(same?.status).not.toBe(409);
  });
});

describe('the files of earlier builds', () => {
  const directory = fileURLToPath(new URL('./.output/builds/', import.meta.url));

  it('stay for as many builds as asked, and go after', () => {
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(`${directory}assets`, { recursive: true });
    const write = (id: string, files: string[], at: number): string[] => {
      for (const file of files) {
        writeFileSync(`${directory}${file}`, id);
      }
      return pruneBuilds(directory, id, files, 1, at);
    };
    expect(write('one', ['assets/one.js', 'assets/shared.js'], 1)).toEqual([]);
    expect(readBuildId(directory)).toBe('one');
    expect(write('two', ['assets/two.js', 'assets/shared.js'], 2)).toEqual([]);
    // The third build keeps one earlier build: the files of the first go, except the shared one.
    expect(write('three', ['assets/three.js', 'assets/shared.js'], 3)).toEqual(['one']);
    expect(readBuildId(directory)).toBe('three');
    expect(() => readFileSync(`${directory}assets/one.js`)).toThrow('ENOENT');
    expect(readFileSync(`${directory}assets/two.js`, 'utf8')).toBe('two');
    expect(readFileSync(`${directory}assets/shared.js`, 'utf8')).toBe('three');
    const builds = JSON.parse(readFileSync(`${directory}.brumate/builds.json`, 'utf8')) as {
      builds: { id: string }[];
    };
    expect(builds.builds.map((build) => build.id)).toEqual(['two', 'three']);
    // Without earlier builds to keep, only the files of this build stay.
    expect(write('four', ['assets/four.js'], 4).length).toBeGreaterThan(0);
    expect(pruneBuilds(directory, 'five', ['assets/five.js'], 0, 5)).toEqual(['three', 'four']);
  });

  it('reads no ID from a directory without a client build', () => {
    expect(readBuildId(`${directory}missing/`)).toBeUndefined();
  });
});
