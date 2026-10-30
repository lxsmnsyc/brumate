# `as` and `ref`

Most parts render one element, and take `as` to render another, and `ref` to give you that element.

Parts with `as` and their default element:

- `button`: `Button`, `ToggleButton`.
- `a`: `Link` (a `span` without `href`).
- `label`: `Label`. `span`: `Text`, `FieldError`, `SelectionIndicator`, `VisuallyHidden`. `kbd`: `Keyboard`. `header`: `Header`. `h3`: `Heading` (`h1` to `h6` by `level`). `h2`: `CalendarHeading`. `hr`: `Separator` (a `div` when vertical).
- `section`: `Dialog`.
- `div`: `Group`, `Transition`, `Toolbar`, `ToggleButtonGroup`, `Disclosure`, `DisclosureGroup`, `DisclosurePanel`, `RadioGroup`, `CheckboxGroup`, `Meter`, `ProgressBar`, `Toast`, `ToastRegion`, `Popover`, `Tooltip`, the fields (`TextField`, `SearchField`, `NumberField`, `DateField`, `TimeField`, `ColorField`, `Select`, `ComboBox`, `DateRangePicker`) and the collections (`ListBox`, `ListBoxItem`, `Menu`, `MenuItem`, `GridList`, `GridListItem`, `Tree`, `TreeItem`, `Tabs`, `TabList`, `Tab`, `TabPanel`, `TagGroup`, `TagList`, `Tag`).

A part that has no `as` renders what its meaning needs, such as the native input of a `Checkbox`, a `Radio` or a `Switch`, and `Input`, `Table`, `Slider` and `Modal`.

## An element

```brm
<script>
  import Button from '@brumate/ui/Button.brm';
  import Link from '@brumate/ui/Link.brm';
</script>

<Button as="a" href="/docs">Docs</Button>
<Link as="span" onPress=(() => {})>Not an anchor</Link>
```

- `as="a"` takes `href`: the other props are those of the target. A prop that the target does not take is a type error, and so is a wrong value type.
- The part keeps its role and its place in the order of Tab. `as="a"` on a `Button` renders `role="button"`.
- The default element is in the list above.

## A ref

`ref=$bind(element)` binds a signal to the element of the part. The signal holds the element in the browser, and nothing on the server.

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import Button from '@brumate/ui/Button.brm';

  let button = $signal<HTMLButtonElement>();
  let height = $signal(0);

  function measure() {
    height = button?.offsetHeight ?? 0;
  }
</script>

<Button ref=$bind(button) onPress=measure>Measure</Button>
<p>Height: {height}</p>
```

- The type of the element follows `as`: `HTMLAnchorElement` for `as="a"`, `HTMLElement` for the default `div`. A component target gives the element of its own `ref`, or `Element`.
- Use a handler or a `$client` callback to read the element.
- A bare `ref=name` is an error. Write `ref=$bind(name)`:

```brm wrong: ref takes $bind, as in ref=$bind(name)
<script>
  import { $signal } from 'brumate/signals';

  let button = $signal<HTMLButtonElement>();
</script>

<button ref=button>Measure</button>
```

- A part that reads its own root reads the `ref` prop, so a ref you pass is also the one the part uses.

## A component

`as` also takes a component. The component must forward `ref` and spread its rest props onto its root, so the part's attributes and element reach the DOM.

```brm
<script>
  import { $props, type Bindable } from 'brumate/signals';
  import type { ElementProps } from 'brumate/elements';

  let { ref } = $props<{ ref?: Bindable<HTMLElement> }>();
  const { children, ...rest } = $props<{ children?: unknown } & Omit<ElementProps<'div'>, 'ref'>>();
</script>

<div ref=$bind(ref) {...rest}>{children}</div>
```

Use it with `<Toolbar as=Card aria-label="Tools">`, importing `Card` from its `.brm` file and passing the component itself, not a string.

- A part passes its attributes to the component as props: the component spreads them.
- Gaps: the live attributes of a part (`aria-selected`, `aria-pressed`, `data-selected`) do not update on a component target, and a `#template` that names the component only in `as=` can miss its import in the browser. Prefer an element name when the part has state that changes.
- Type a signal that is bound to a component's `ref` as `$signal<any>()` if the checker rejects `$signal<HTMLElement>()`.

## Props types

Each part exports `<Name>Props` and `<Name>OwnProps` from its `.brm` file, for wrappers that pass props on:

- `ButtonProps<T>` is the own props, `as`, and the props of the target `T` (default `'button'`).
- A collection takes the type of its value first: `ListBoxProps<V, T>`. `V` has a default, so `ListBoxProps` alone works.
- Import it as a type: `import type { ButtonProps } from '@brumate/ui/Button.brm'`.
