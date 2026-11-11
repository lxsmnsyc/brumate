import { mkdirSync, writeFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { compile } from '../src/index.ts';
import { render } from '../src/runtime/server.ts';

const output = new URL('./.output/event-nonce/', import.meta.url);

const source = `<script>
  import { getEvent } from 'brumate/server';
  const nonce = getEvent().nonce ?? 'none';
</script>

<p>{nonce}</p>`;

beforeAll(() => {
  mkdirSync(output, { recursive: true });
  const { server } = compile(source, { filename: 'Nonce.brm' });
  writeFileSync(new URL('Nonce.brm.ts', output), server);
});

// oxlint-disable-next-line typescript/no-explicit-any -- The compiled module is loaded at runtime.
const load = (): Promise<any> => import(new URL('Nonce.brm.ts', output).href);

it('gives a component the nonce of the render, and undefined without one', async () => {
  const module = await load();
  const request = new Request('http://localhost/');
  const withNonce = await render(module.default, {}, { request, nonce: 'abc123' });
  expect(withNonce.html).toContain('<p>abc123</p>');
  const without = await render(module.default, {}, { request });
  expect(without.html).toContain('<p>none</p>');
});
