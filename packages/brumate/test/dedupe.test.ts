import { mkdirSync, writeFileSync } from 'node:fs';
import { toJSON } from 'seroval';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';
import { handleRequest, render } from '../src/runtime/server.ts';
import { withEvent } from '../src/runtime/request.ts';
import { serverModule } from '../src/server-files.ts';

const output = new URL('./.output/dedupe/', import.meta.url);
mkdirSync(output, { recursive: true });

const component = `<script>
  import { $memo, $props } from 'brumate/signals';

  const { id, other } = $props<{ id: number; other: number }>();

  async function getUser(user: number) {
    'use server';
    (globalThis as { userCalls?: number[] }).userCalls!.push(user);
    return { name: 'user ' + user };
  }

  const first = $memo(getUser(id));
  const second = $memo(getUser(id));
  const third = $memo(getUser(other));
</script>

<p>{first.name} {second.name} {third.name}</p>
`;

describe('deduplicated server calls', () => {
  it('runs a server function once per render for the same arguments, and each time from the browser', async () => {
    const { server } = compile(component, { filename: 'Users.brm' });
    writeFileSync(new URL('Users.brm.ts', output), server);
    const module = await import(new URL('Users.brm.ts', output).href);
    const calls: number[] = [];
    (globalThis as { userCalls?: number[] }).userCalls = calls;

    const { html } = await render(module.default, { id: 1, other: 2 });
    expect(html).toContain('user 1');
    expect(calls.toSorted()).toEqual([1, 2]);

    // Each render starts with no results.
    await render(module.default, { id: 1, other: 2 });
    expect(calls).toHaveLength(4);

    // A call from the browser is a request of its own, so it runs.
    const id = Object.keys(module.rpc)[0]!;
    const call = (): Promise<Response | undefined> =>
      handleRequest(
        module.rpc,
        new Request(`http://localhost/_brumate/${encodeURIComponent(id)}`, {
          method: 'POST',
          body: JSON.stringify(toJSON([1])),
        }),
      );
    await call();
    await call();
    expect(calls).toHaveLength(6);
  });

  it('shares the results of the functions of a file of server functions', async () => {
    const source = `'use server';\n\nlet calls = 0;\n\nexport async function load(id: number) {\n  calls++;\n  return id * 2;\n}\n\nexport const count = async () => calls;\n\nconst other = async (id: number) => id;\nexport { other as renamed };\n`;
    const code = serverModule(source, 'data.ts', 'data_1');
    expect(code.split('\n').slice(0, 11).join('\n')).toContain(
      'export let   count = async () => calls;',
    );
    writeFileSync(new URL('data.ts', output), code);
    const data = await import(new URL('data.ts', output).href);
    // As a render does: calls share results while its call cache is set.
    const calls = new Map<string, unknown>();
    const results = await Promise.all(
      [2, 2, 3].map((id) => withEvent(undefined, () => data.load(id), calls)),
    );
    expect(results).toEqual([4, 4, 6]);
    expect(await data.count()).toBe(2);
    // Outside a render, each call runs.
    await data.load(2);
    expect(await data.count()).toBe(3);
    expect(await data.renamed(5)).toBe(5);
  });
});
