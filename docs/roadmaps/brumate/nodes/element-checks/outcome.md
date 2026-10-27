# Outcome: element-checks

## Built

- packages/brumate/src/check.ts:
  - A plain element writes `$$element(tag, { ... })`, typed by `Elements[tag]` (`Record<string, unknown>` for a tag outside `Elements`). Static attributes are string literals or `true`, value attributes their expression, `ref=$bind(x)` is `ref: $$bind(x)` (a local helper typed `BoundSignal<T>`), and computed attributes `[name]: value`. Handlers stay in `$$on`, which checks the event name. An element with no such attribute writes nothing.
  - Each spread is checked apart: `$$spread(tag)(value)` checks its names (an object spread in a literal has no excess check, so this is the only way to report `{...{ foo: 1 }}`; the error names the attribute, `"foo is not an attribute of <div>"`), and `$$element(tag)({...value})` checks its values, with the braces mapped to the spread. A spread value may be `null` or `undefined`, which spreads nothing: the helpers take both, and `$$present(value)` (`T & {}`) keeps the object part checked. packages/tsc/test/fixture/src/Spreads.brm (a new fixture file) has each nullable form as valid, and one bad object inside an optional one.
  - The helpers are curried and constrained by `keyof Elements`, with a second overload for other tags. See Verification for the time.
  - A namespaced attribute (`xlink:href`, `xmlns:xlink`) is not in the element types, so only its value is checked, as on main.
  - `Writer.key` maps a property name to its attribute: identifiers are copied, other names (`aria-label`) are quoted with the quotes mapped to the ends of the name. Before, errors at such names were dropped. Computed brackets are mapped too.
  - Children of a component are `children: $$markup` (`Markup`), with the name mapped to the range of the children, so a component that takes none, or takes another type, reports at the children.
  - `#template` already answered `Promise<Markup>` (element-types); no change.
  - A `$props<T>()` call with a rest writes `$props<$$Omit<T, "other">>()`, where the names are those the other `$props` calls destructure. This matches the runtime (`$$b.unbind`, codegen/patch.ts). Without it a rest held the bindable props of the other call (`isSelected`, `value`, `isOpen`) and every spread of it failed.
- packages/tsc/test/fixture/src/Elements.brm and 7 new expected errors in packages/tsc/test/tsc.test.ts: unknown attribute, wrong value, a button signal bound to a div ref, a wrong value in a spread, a computed attribute, children given to Badge, and the existing `<input value=$bind(size)>` of Bind.brm. `value=$bind(numberSignal)` on an input is an error by the contract: the binding writes the string of the field, so the signal must take a string. The fixture also shows `autocorrect`, `webkitdirectory`, `xmlns:xlink` and `xlink:href` type-check.
- packages/brumate/test/check.test.ts: 3 tests for the generated element call, the mappings of quoted names, brackets and children, and the rest omit.
- Changeset .changeset/element-checks.md (minor brumate, minor @brumate/ui: the stricter props types are a type break, said in the changeset).

Callers fixed: 51 errors in 48 files.

- 45 parts in packages/ui/src took `[attribute: string]: unknown` and spread the rest onto a plain element. Their props interface now `extends ElementProps<'tag'>` (the element it spreads onto). 14 of them omit own props that clash: `onChange` (Calendar, Checkbox, ColorArea, ColorSlider, ColorSwatchPicker, ColorWheel, Slider, Switch, TokenField), `id` (Column, Row), `onDrop` (DropZone), `onResize` (ResizableTableContainer), `onSelectionChange` (Table). NavigationTreeItemLink extends `ElementProps<'a'>`, so `href`, `rel`, `target` and `download` still pass, and casts the rest to `ElementProps<'span'>` at the span of a disabled item. Cell extends `ElementProps<'th'>` (a superset of `td`) and casts the rest to `ElementProps<'td'>` at the `td`.
- Input and TextArea spread attributes from contexts typed `Record<string, unknown>`: a cast at the spread to `ElementProps<'input'>` / `<'textarea'>`.
- packages/ui/test/fixtures/AsTarget.brm: rest typed `Omit<ElementProps<'div'>, 'ref'>`.
- website/src/components/Icon.brm: rest typed `Omit<ElementProps<'svg'>, 'name' | 'size'>`.
- 3 attributes missing from `Elements`: the change request was accepted (element-types v1.2). packages/brumate/elements.d.ts has `autocorrect` in `GlobalAttributes` and `webkitdirectory` on `input`; DateSegment and FileTrigger write them as plain attributes. website Icon.brm drops `focusable` (only IE11 and old Edge read it).
- examples/tracker (`{...fields.title.attrs}`, an interface) needed no change once the spread check took interfaces.

## Deviations

- `autocorrect`, `webkitdirectory` and `focusable` were not in `Elements`. Change request contracts/element-types-attributes.change-request.md, accepted as element-types v1.2: this node edited packages/brumate/elements.d.ts (outside its owned paths) to add the first two, and dropped `focusable` from the website's Icon, which changes its HTML.
- The parts' props types changed (any attribute to the element's attributes). That is a type change of public props, not of behavior; callers in the repo needed no change.

## Stubs left

- The casts in Input.brm and TextArea.brm, until `FieldInputContext` and `contextAttributes` (contexts.ts, slots.ts) are typed as input attributes.

## Gotchas

- TypeScript reports one error per object argument when a property has the wrong type. Two bad attributes on one element show one error; fix it and the next shows.
- A computed attribute with a name of type `string` makes an index signature, which fails against `aria-*`; the error spans the opening tag.
- An interface spread onto an element passes only through `$$spread`'s mapped form; a constraint `S extends ElementProps<tag>` would reject every interface (no implicit index signature).
- A spread of `Record<string, unknown>` or of `[attribute: string]: unknown` is now an error on a plain element. 6 parts still take `[attribute: string]: unknown` and spread it onto a dynamic tag or a component, which this node does not check (dynamic-tag-types).
- template-context-types: template bodies are checked (an unknown attribute and a wrong property inside a `#template` report). Untyped parameters are `any`: TS7006 under `strict`, silent otherwise. A template passed to a prop (`item=row`) is a function declaration, so the prop type does not reach its parameter.
- An unknown tag (custom element) takes any attribute.

## Proposed learnings

- A part that spreads its other props onto an element types them as that element's attributes, `extends Omit<ElementProps<'tag'>, own clashes>` | the check rejects an untyped rest | packages/ui/src | yes (brumate-tsc)

## Verification

- Probe before the change: fixture with `<div tabindex="abc" foo="x">` and `{n.nope}` exited 2 with only the `nope` error.
- `npx tsdown` in packages/brumate, language-core, tsc (and language-server, for vscode).
- `npx tsc --noEmit` in brumate (and `-p tsconfig.elements.json`), language-core, language-server, typescript-plugin, vscode, tsc: exit 0.
- `npx brumate-tsc --noEmit` in packages/ui, website and the 7 examples: exit 0. Before the caller fixes: ui 55 errors, website 2, examples/ui 53, tracker 1.
- `npx vitest run` in packages/brumate: 1098 passed (after merging main). packages/tsc: 1 passed. packages/ui (`--maxWorkers=2`): 544 passed, 1 expected fail.
- `npx oxlint`: exit 0 (warnings only). Root `npx oxfmt --check`: exit 0.

- Time of `brumate-tsc --noEmit --extendedDiagnostics` in packages/ui (see the log for the cause): main 7.3M instantiations; the first version of this node 21.6M, about 3x the time; now 7.7M. Three paired runs, main against head: real 9.7/10.4, 12.3/14.2, 12.2/12.5 s; user 13.4/14.1, 14.8/16.0, 14.4/15.2 s (1.05x to 1.15x, the machine was shared).

## Size

- Estimated L, actual M to L: 51 caller errors, one main kind, so the sweep stayed mechanical. No runtime change, so no gzip numbers.
