# Core gaps for a component in `as`, round 2

Found by as-collections (#272) and as-controls (#273), and reproduced by their reviews on 2026-10-27. The fixtures go in packages/brumate/test/render/, and the tests in packages/brumate/test/resume.test.ts, with its `resume`, `click` and `waitFor` helpers. Each test must fail on main before the fix.

The `it.fails` tests in packages/ui/test/as-collections.test.ts and as-controls.test.ts show the same gaps in the parts. When a fix lands, they fail with "Expect test to fail"; change them to `it` in the same PR.

## 1. Props that a part sends to a component in `as` stay static (as-live-props)

From the review of #272, section (a):


GapPart.brm
```brm
<script>
  import { $props, $signal } from 'brumate/signals';
  const { as, children, ...rest } = $props();
  let on = $signal(false);
</script>
<{as ?? 'div'} role="tab" aria-selected=(on) onClick=(() => (on = !on)) {...rest}>{children}</>
```
GapTarget.brm: `<div data-target {...rest}>{children}</div>` (with `const { children, ...rest } = $props();`)
gapPropsComponent.brm: `<GapPart as=GapTarget class="item">Item</GapPart>`
gapPropsElement.brm: the same with `as="div"`.

```ts
for (const name of ['gapPropsElement', 'gapPropsComponent']) {
  it(`updates a prop that a part sends to its target: ${name}`, async () => {
    await resume(name, {});
    const item = () => document.querySelector('.item')!;
    expect(item().getAttribute('aria-selected')).toBe('false');
    click(item());
    await waitFor(() => expect(item().getAttribute('aria-selected')).toBe('true'));
  });
}
```
Result: the element passes; the component stays `aria-selected="false"` (the part's handler runs, the attribute never changes). The part is written as the contract says. The project analysis (`analyzeProject` liveProps) does not mark the props of a component that reaches a part through the value of `as=`.


## 2. A template's client part misses a component named only in an attribute value (template-value-imports)

From the review of #272, section (b):

```brm
<script>
  import GapPart from './GapPart.brm';
  import GapTarget from './GapTarget.brm';
  import TplList from './TplList.brm';
</script>
<TplList item=row />
#template row(label: string) {
  <GapPart as=GapTarget class="gap-row">{label}</GapPart>
}
```
```ts
await resume('gapTemplate', {});
click(document.querySelector('.tpl-add')!);
await waitFor(() => expect(document.querySelector('.gap-row')).not.toBeNull());
```
Fails with `ReferenceError: GapTarget is not defined` at test/.output/resume/gapTemplate.brm.client.t2.ts:15 (`$$b.component(GapPart, { "as": (GapTarget), ...`). The client part of the template imports `GapPart`, but not the component that an attribute value names. The worker's "smaller fixture did not reproduce it" is explained: it needs a component named only in an attribute value (`as=X`) inside a template that the browser renders.


## 3. A bound element signal on a component prop fails the type check (bound-element-signal)

From the review of #273. In any `.brm` file under packages/ui:

```brm
<script>
  import { $signal } from 'brumate/signals';
  import Toolbar from '../../src/Toolbar.brm';

  let onDiv = $signal<HTMLElement>();
  let onPart = $signal<HTMLElement>();
</script>

<div ref=$bind(onDiv)></div>
<Toolbar ref=$bind(onPart)></Toolbar>
```

`onDiv` passes. `onPart` fails with TS2345, "A function cannot be sent to the client", at its declaration, and `brumate-tsc --noEmit` exits 2. The cause is `$$sendable` in packages/brumate/src/check.ts (the `$$Sendable` type): a signal bound to a component prop is checked as page state, and an element is not sendable. The element of a `ref` binding is never sent; the browser fills it.

## 4. A spread onto a component makes its children live, and they render again (spread-children-live)

From #172 (NavigationTree) and #272:

- A `{...rest}` spread onto a component makes every prop of that component live in the whole project (`*` in `analyzeProjectProps`, packages/brumate/src/project.ts), including `children`.
- After resume, the update of a template body sends the props again on the first change. With `children` live, the child renders its children fresh, so its DOM nodes and the focus are replaced.
- Because the analysis is project-wide, one file that spreads onto a component changes every use of it. #272's fixture `AsTreeItem.brm` spread `{...rest}` onto TreeItem, and `tree.test.ts` "opens and closes with the chevron" failed on main, in its file but not alone (fixed on main in 0f02513e by passing the props by name).
- The as-controls `it.fails` test of a ToastRegion with `as=AsTarget`, where a closed toast stays, is probably the same cause. Check it.
- Reproduction: put the old `AsTreeItem.brm` back (`<TreeItem as=AsTarget {...rest}>{children}</TreeItem>` with `const { children, ...rest } = $props()`), and run `npx vitest run test/tree.test.ts` in packages/ui. Reduce it to a packages/brumate test.
