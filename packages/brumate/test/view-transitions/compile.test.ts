import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile } from '../../src/index.ts';
import { getFeatures } from '../../src/features.ts';
import { render } from '../../src/runtime/server.ts';

const LIST = `<script>
  import { $signal } from 'brumate/signals';
  let items = $signal([1, 2]);
</script>

<ul>
  #for (item of items by item) {
    <li viewTransition="card" viewTransitionName=(\`card-\${item}\`)>{item}</li>
  }
</ul>
`;

const PLAIN = '<p class="a">Hello</p>';

const output = new URL('../.output/view-transitions/', import.meta.url);

describe('the attributes', () => {
  it('turn on the feature only for a file that uses them', () => {
    expect(getFeatures(compile(LIST, { filename: 'List.brm' })).viewTransitions).toBe(true);
    expect(getFeatures(compile(PLAIN, { filename: 'Plain.brm' })).viewTransitions).toBe(false);
  });

  it('are written as b-vt and b-vtn, with no view-transition property', async () => {
    const result = compile(LIST, { filename: 'List.brm' });
    expect(result.server).toContain('b-vt=');
    expect(result.server).toContain('b-vtn');
    expect(result.server).not.toMatch(/view-transition-name/);
    mkdirSync(output, { recursive: true });
    writeFileSync(new URL('List.brm.ts', output), result.server);
    const module = await import(new URL('List.brm.ts', output).href);
    const html = (await render(module.default, {}, { request: new Request('http://localhost/') }))
      .html;
    expect(html).toContain('b-vt="card"');
    expect(html).toContain('b-vtn="card-1"');
    expect(html).not.toContain('viewTransition');
    expect(html).not.toContain('style=');
  });

  it('mark an element through {...rest} of a wrapper, and turn the feature on', async () => {
    const wrapper = compile(
      `<script>
  import { $props } from 'brumate/signals';
  const { children, ...rest } = $props();
</script>

<section {...rest}>{children}</section>
`,
      { filename: 'Wrapper.brm' },
    );
    // The wrapper holds no attribute of the feature, so it adds none.
    expect(getFeatures(wrapper).viewTransitions).toBe(false);
    const page = compile(
      `<script>
  import Wrapper from './Wrapper.brm';
</script>

<Wrapper viewTransition="panel" viewTransitionName=("p-" + 1)>Hi</Wrapper>
`,
      { filename: 'Page.brm' },
    );
    // The file that writes the attribute on a component turns the feature on.
    expect(getFeatures(page).viewTransitions).toBe(true);
    mkdirSync(output, { recursive: true });
    writeFileSync(new URL('Wrapper.brm.ts', output), wrapper.server);
    const module = await import(new URL('Wrapper.brm.ts', output).href);
    const html = (
      await render(
        module.default,
        { viewTransition: 'panel', viewTransitionName: 'p-1' },
        { request: new Request('http://localhost/') },
      )
    ).html;
    expect(html).toContain('b-vt="panel"');
    expect(html).toContain('b-vtn="p-1"');
    expect(html).not.toContain('viewtransition');
  });
});
