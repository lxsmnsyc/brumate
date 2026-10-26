# Core gaps for a component in `as`

Found by as-collections (#252), and confirmed on main (70b1ea0b) on 2026-10-26 with the tests below. Each was run as a plain `it`, and failed. The fixtures go in packages/brumate/test/render/, and the tests in packages/brumate/test/resume.test.ts, with its `resume`, `click`, `waitFor` and `text` helpers.

## 1. A forwarded ref is lost through a spread (dynamic-spread-anchor)

The server HTML has two `b-b` attributes, `<button class="inner" b-b="1:0" b-b="2:0">`. The dynamic tag's anchor arrives in the props as an internal `b-b`, `{...rest}` spreads it onto the element (`spread` in src/runtime/server.ts, through `ownValue` in src/runtime/html.ts), and the component's own anchor comes after it. The browser keeps the first, so the ref at `2:0` never resolves. The element's own `b-b` must win. Check the client path too (`dynamicNodes`, `mergeAttributes`).

```brm
<!-- RefSpread.brm -->
<script>
  import { $props, type Bindable } from 'brumate/signals';

  // Forwards its button, and spreads the other props onto it.
  let { ref, label = 'Spread', ...rest } = $props<{ ref?: Bindable<HTMLElement>; label?: string; [name: string]: unknown }>();
</script>

<button class="inner" ref=$bind(ref) {...rest}>{label}</button>
```

```brm
<!-- refForwardSpread.brm -->
<script>
  import { $bind, $signal } from 'brumate/signals';
  import RefSpread from './RefSpread.brm';

  let as = $signal<any>(RefSpread);
  let root = $signal<HTMLElement>();
  let seen = $signal('');
</script>

<{as} ref=$bind(root) />
<button class="read" onClick=(() => (seen = root?.tagName ?? 'none'))>Read</button>
<p class="seen">{seen}</p>
```

```ts
it('a forwarded ref reaches a component that spreads its props', async () => {
  await resume('refForwardSpread', {});
  click(document.querySelector('.read')!);
  await waitFor(() => expect(text('.seen')).toBe('BUTTON'));
});
```

## 2. A component in a prop renders nothing in markup the browser renders later (component-prop-render)

src/runtime/shared.ts turns a component value into a stub, `c: (id) => Object.assign(() => '', { brumateId: id })`. A block that the browser renders calls `dynamicNodes(as, …)`, which calls the stub and renders `''`. The client code never imports the component's render module. When the tag is a stub with `brumateId`, `dynamic` and `dynamicNodes` must get that component's render function. Either the compiler imports and registers the render modules of components that reach a prop as values, or the client core loads them by ID.

```brm
<!-- LateAs.brm -->
<script>
  import { $props, $signal } from 'brumate/signals';

  // Renders its `as` in a block that opens after resume.
  const { as } = $props<{ as: any }>();
  let open = $signal(false);
  let clicks = $signal(0);
</script>

<button class="open" onClick=(() => (open = true))>Open</button>
#if (open) {
  <{as} class="late" onClick=(() => clicks += 1)>Late</>
}
<p class="clicks">{clicks}</p>
```

```brm
<!-- lateAsPage.brm, with AsLink.brm a component that renders <a {...rest}>{children}</a> -->
<script>
  import AsLink from './AsLink.brm';
  import LateAs from './LateAs.brm';
</script>

<LateAs as=AsLink />
```

```ts
it('a component in a prop renders in a block that the browser renders later', async () => {
  await resume('lateAsPage', {});
  expect(document.querySelector('.late')).toBeNull();
  click(document.querySelector('.open')!);
  await waitFor(() => expect(document.querySelector('a.late')).not.toBeNull());
  click(document.querySelector('a.late')!);
  await waitFor(() => expect(text('.clicks')).toBe('1'));
});
```

A new item of a `#for` with a component in `as` renders empty for the same cause.

## 3. A component in a template inside a block is not imported (nested-template-imports)

A component used as a value in a top-level `#template` is imported. A component used as a tag in a `#template` declared inside a block is not: `ReferenceError: TplDynamic is not defined`. In `inside()` of src/codegen/client.ts, `if (template && !result.some((item) => isWithin(template, item)))` never adds a template that sits within its block, so `componentNames` never visits its body. Fix direction: `!result.includes(template)`.

```brm
<!-- templateNested.brm -->
<script>
  import { $signal } from 'brumate/signals';
  import AsLink from './AsLink.brm';
  import TplDynamic from './TplDynamic.brm';

  let open = $signal(false);
</script>

<TplDynamic class="plain">Plain</TplDynamic>
<button class="open" onClick=(() => (open = true))>Open</button>
#if (open) {
  #template item() {
    <TplDynamic as=AsLink class="tpl">Tpl</TplDynamic>
  }
  {item()}
}
```

```ts
it('a component used in a template that sits inside a block is imported', async () => {
  await resume('templateNested', {});
  click(document.querySelector('.open')!);
  await waitFor(() => expect(document.querySelector('a.tpl')).not.toBeNull());
});
```

## 4. A dynamic tag loses the handlers of a spread when the browser renders it (dynamic-spread-handlers)

The client `dynamic` and `dynamicNodes` (src/runtime/client.ts) write attributes with `spreadText`, which skips `on*` entries, so no `b-on` is written. The plain element path uses `spread(attributes, on)` with `spreadEntries` and `handlerReferences`. Fix direction: write the `b-on` of `spreadEntries(attributes)` in both.

```brm
<!-- dynamicKeys.brm -->
<script>
  import { $handler, $signal } from 'brumate/signals';

  let open = $signal(false);
  let as = $signal<any>('div');
  let presses = $signal(0);

  function keys() {
    return { onKeyDown: $handler(() => presses += 1) };
  }
</script>

<button class="open" onClick=(() => (open = true))>Open</button>
#if (open) {
  <{as} class="list" tabindex="0" {...keys()}>List</>
}
<p class="presses">{presses}</p>
```

```ts
it('a dynamic tag keeps the handlers of a spread when the browser renders it', async () => {
  await resume('dynamicKeys', {});
  click(document.querySelector('.open')!);
  await waitFor(() => expect(document.querySelector('.list')).not.toBeNull());
  document.querySelector('.list')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
  await waitFor(() => expect(text('.presses')).toBe('1'));
});
```
