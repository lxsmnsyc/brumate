import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analyzeProjectDefers, compile } from '../src/index.ts';
import { findError } from '../src/error-catalog.ts';

// An overlay reads its children in a block that the browser creates when it opens.
const overlay = `<script>
  import { $props, $signal } from 'brumate/signals';
  const { children } = $props<{ children?: unknown }>();
  let open = $signal(false);
</script>

<button onClick=(() => (open = !open))>Toggle</button>
#if (open) {
  <div>{children}</div>
}
`;

// A part that passes its children on to the overlay, in a template.
const wrapper = `<script>
  import { $props } from 'brumate/signals';
  import Overlay from './Overlay.brm';
  const { children } = $props<{ children?: unknown }>();
</script>

#template box() {
  <section>{children}</section>
}

<Overlay>{box()}</Overlay>
`;

// A part that renders its children where the server renders them.
const plain = `<script>
  import { $props } from 'brumate/signals';
  const { children } = $props<{ children?: unknown }>();
</script>

<div>{children}</div>
`;

// A list that renders a template of its parent in a block that the browser creates.
const lister = `<script>
  import { $props, $signal } from 'brumate/signals';
  const { row } = $props<{ row: () => unknown }>();
  let open = $signal(false);
</script>

<button onClick=(() => (open = !open))>Toggle</button>
#if (open) {
  <div>{row()}</div>
}
`;

function page(tag: string): string {
  return `<script>
  import Overlay from './Overlay.brm';
  import Wrapper from './Wrapper.brm';
  import Plain from './Plain.brm';
</script>

<${tag}>
  #defer {
    <p>Late</p>
  } #else {
    <p>Soon</p>
  }
</${tag}>
`;
}

function project(tag: string): Map<string, string> {
  return new Map([
    ['Overlay.brm', overlay],
    ['Wrapper.brm', wrapper],
    ['Plain.brm', plain],
    ['Page.brm', page(tag)],
  ]);
}

describe('analyzeProjectDefers', () => {
  it('reports a #defer in the children of a component that renders them in the browser', () => {
    const sources = project('Overlay');
    const found = analyzeProjectDefers(sources).get('Page.brm')!;
    expect(found).toHaveLength(1);
    expect(found[0]!.component).toBe('Overlay');
    expect(sources.get('Page.brm')!.slice(found[0]!.start, found[0]!.end)).toBe('#defer');
  });

  it('follows the children through a template and a part that passes them on', () => {
    const found = analyzeProjectDefers(project('Wrapper')).get('Page.brm')!;
    expect(found.map((block) => block.component)).toEqual(['Wrapper']);
  });

  it('reports nothing for a component that the server renders', () => {
    expect(analyzeProjectDefers(project('Plain')).get('Page.brm')).toBeUndefined();
  });

  it('fails the compile of the page with BRM217', () => {
    const sources = project('Overlay');
    const browserDefers = analyzeProjectDefers(sources).get('Page.brm');
    expect(() =>
      compile(sources.get('Page.brm')!, { filename: 'Page.brm', browserDefers }),
    ).toThrow(/#defer cannot be in the content of <Overlay>, which can render it in the browser/);
    const message =
      '#defer cannot be in the content of <Overlay>, which can render it in the browser. Use #loading with a server function';
    expect(findError(message)?.code).toBe('BRM217');
  });

  it('reports a #template that the page passes as a prop that the component renders late', () => {
    const sources = new Map([
      ['Lister.brm', lister],
      [
        'Page.brm',
        `<script>
  import Lister from './Lister.brm';
</script>

<Lister row=box />

#template box() {
  #defer {
    <p>Late</p>
  } #else {
    <p>Soon</p>
  }
}
`,
      ],
    ]);
    const found = analyzeProjectDefers(sources).get('Page.brm')!;
    expect(found.map((block) => block.component)).toEqual(['Lister']);
    expect(sources.get('Page.brm')!.slice(found[0]!.start, found[0]!.end)).toBe('#defer');
  });

  it('reports a #defer in a #template of the page that is called in the children', () => {
    const sources = new Map([
      ['Overlay.brm', overlay],
      [
        'Page.brm',
        `<script>
  import Overlay from './Overlay.brm';
</script>

<Overlay>{box()}</Overlay>

#template box() {
  #defer {
    <p>Late</p>
  } #else {
    <p>Soon</p>
  }
}
`,
      ],
    ]);
    const found = analyzeProjectDefers(sources).get('Page.brm')!;
    expect(found.map((block) => block.component)).toEqual(['Overlay']);
  });

  it('reports nothing for a template that a component calls where the server renders it', () => {
    const sources = new Map([
      ['Plain.brm', plain],
      [
        'Page.brm',
        `<script>
  import Plain from './Plain.brm';
</script>

<Plain>{box()}</Plain>

#template box() {
  #defer {
    <p>Late</p>
  }
}
`,
      ],
    ]);
    expect(analyzeProjectDefers(sources).get('Page.brm')).toBeUndefined();
  });
});

describe('the project check of the ui overlays', () => {
  // The fixture is read, never compiled by a test, since BRM217 stops the compile.
  it('fails the compile of defer-overlays.brm with BRM217', () => {
    const directory = new URL('../../ui/', import.meta.url);
    const sources = new Map<string, string>();
    for (const name of readdirSync(new URL('src/', directory))) {
      if (name.endsWith('.brm')) {
        const url = new URL(`src/${name}`, directory);
        sources.set(fileURLToPath(url), readFileSync(url, 'utf8'));
      }
    }
    const fixture = new URL('test/fixtures/defer-overlays.brm', directory);
    const path = fileURLToPath(fixture);
    const text = readFileSync(fixture, 'utf8');
    sources.set(path, text);
    const browserDefers = analyzeProjectDefers(sources).get(path);
    expect(browserDefers).toHaveLength(2);
    let message = '';
    try {
      compile(text, { filename: 'defer-overlays.brm', path, browserDefers });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('[BRM217]');
    expect(message).toContain('<Popover>');
  });
});
