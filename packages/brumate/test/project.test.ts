import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeProject, analyzeProjectProps, compile } from '../src/index.ts';

const directory = new URL('./render/', import.meta.url);
const sources = new Map(
  readdirSync(directory)
    .filter((name) => name.endsWith('.brm'))
    .map((name) => [name, readFileSync(new URL(name, directory), 'utf8')]),
);

describe('analyzeProject', () => {
  it('finds the props that parents can change', () => {
    const live = analyzeProject(sources);
    // `value` changes in parent.brm and list.brm. `onChange` is a function that does not change.
    expect([...live.get('Child.brm')!]).toEqual(['value']);
    // toolbar.brm changes `label`, but `tone` is a constant.
    expect([...live.get('Badge.brm')!]).toEqual(['label']);
    // Nothing renders these, so their props come from the server and do not change.
    expect(live.get('todos.brm')!.size).toBe(0);
    expect(live.get('blocks.brm')!.size).toBe(0);
  });

  it('gives the live props of a part to the component that a page passes in as', () => {
    const live = analyzeProject(sources);
    // GapPart sends `aria-selected` to the tag that `as` names, and gapPropsComponent gives it GapTarget.
    expect([...live.get('GapTarget.brm')!]).toEqual(['aria-selected']);
    // Nothing gives Tag to a part, so its props stay as they are.
    expect(live.get('Tag.brm')!.has('aria-selected')).toBe(false);
  });

  it('follows a component that a part passes on to another part in as', () => {
    const live = analyzeProjectProps(
      new Map([
        ['Pass.brm', sources.get('gapPassOnPart.brm')!],
        ['GapPart.brm', sources.get('GapPart.brm')!],
        ['Target.brm', sources.get('GapTarget.brm')!],
        [
          'Page.brm',
          "<script>import Pass from './Pass.brm'; import Target from './Target.brm';</script><Pass as=Target />",
        ],
      ]),
    );
    expect([...live.get('Target.brm')!.keys()]).toEqual(['aria-selected']);
  });

  it('gives nothing when a part passes on another prop than the one its tag reads', () => {
    const live = analyzeProjectProps(
      new Map([
        ['Pass.brm', sources.get('gapPassOnPart.brm')!.replace('{as}', 'foo={as}')],
        ['GapPart.brm', sources.get('GapPart.brm')!],
        ['Target.brm', sources.get('GapTarget.brm')!],
        [
          'Page.brm',
          "<script>import Pass from './Pass.brm'; import Target from './Target.brm';</script><Pass as=Target />",
        ],
      ]),
    );
    expect(live.get('Target.brm')!.size).toBe(0);
  });

  it('follows a component in a branch of as=(cond ? A : B)', () => {
    const live = analyzeProject(sources);
    // Only gapPassOnChoice and gapPassOnChoiceOther name them, in the two branches of a condition.
    expect([...live.get('gapPassOnTargetA.brm')!]).toEqual(['aria-selected']);
    expect([...live.get('gapPassOnTargetB.brm')!]).toEqual(['aria-selected']);
  });

  it('removes update code for props that do not change', () => {
    const live = analyzeProject(sources);
    const source = sources.get('Badge.brm')!;
    const alone = compile(source, { filename: 'Badge.brm' });
    const inProject = compile(source, { filename: 'Badge.brm', liveProps: live.get('Badge.brm') });
    // Alone, both props can change: `class` and the text both update.
    expect(alone.parts.update).toContain('$$b.attr($$s, 0, "class"');
    expect(alone.parts.update).toContain('$$b.content(');
    // In the project, only `label` changes, so `tone` has no update and no slot.
    expect(inProject.parts.update).not.toContain('"class"');
    expect(inProject.parts.update).toContain('$$b.content(');
    expect(inProject.server).toContain('$$ctx.slots($$s1, [label], ["label"]);');
  });

  it('removes all client code from a component whose props never change', () => {
    const source = sources.get('Badge.brm')!;
    const result = compile(source, { filename: 'Badge.brm', liveProps: new Set() });
    expect(result.server).not.toContain('$$ctx.slots');
    expect(result.server).not.toContain('<!--t');
    // Nothing runs in the browser, so the build leaves the component out of the client.
    expect(result.parts).toEqual({});
    expect(result.clientCode).toBe(false);
    expect(result.client).not.toContain('export function');
  });
});
