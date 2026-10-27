# Outcome: dynamic-tag-types

## Built

- packages/brumate/src/check.ts: a dynamic tag writes `{ const $$tag = (tag); $$dynamic($$tag)({ ... }); }`. The tag is read once, so an error in it is reported once.
  - `$$dynamic` is curried, with three overloads. An element name (any string) checks `$$Attributes<T>`: `Elements[T]` for a name in `Elements`, `Record<string, unknown>` for a custom tag. A component checks its props. A tag that can be either, such as a generic `T extends AsTarget` in a part, checks `Omit<GlobalAttributes<HTMLElement | SVGElement>, 'ref'>` with an index signature and a `ref` of any `BindableMark`.
  - The object holds static and value attributes, `ref: $$bind(x)` (main dropped `ref`), computed names, children as `children: $$markup` mapped to the children, and each spread as `...$$present(value)`, so a falsy spread (`cond && { ... }`, `undefined`, `null`) spreads nothing and its object part is checked.
  - A handler is `onClick: $$handler($$tag)("click", handler)`. An element name types `event` as the event of the name with `currentTarget` the element, also for a union of names (`HTMLButtonElement | HTMLAnchorElement`). A generic tag gives `HTMLElement | SVGElement`. A name that is not an event keeps the handler's type, and the object checks it: a component types its handler props by inference.
  - A passed `#template` (template-context-types) is written in place on a dynamic tag too, through the shared `propValue`.
- packages/tsc/test/fixture/src/Dynamic.brm and 11 expected errors in packages/tsc/test/tsc.test.ts: a typed handler, a wrong value and a wrong `ref` on `<{'a'}>`; an unknown name on a union of names whose handler is typed; a typed component handler, a wrong prop, an unknown prop and children given to Toggle; a generic tag's handler typed with HTML and SVG elements; an unknown event; a wrong value in a `c && { ... }` spread. Falsy spreads, children of an element and a `ref` on a generic tag pass. On main these give 4 TS7006 errors and nothing else.
- packages/brumate/test/check.test.ts: a test of the generated code and its mappings.
- packages/ui: 58 of 59 `currentTarget as` casts removed, in 33 files. Each handler parameter now says its target, such as `event: FocusEvent & { currentTarget: Element }`, and every tag that takes it checks that. Handlers that a part puts on its generic tag take `Element` or `HTMLElement | SVGElement`. `isAnchor` is a type guard. Two errors found: `itemaction` was missing from `ElementEvents` (now merged in collection.ts), and Group spread `'aria-disabled'?: unknown` over its own value (now `string | number | boolean | null`, as `aria-invalid`).
- Changesets: .changeset/dynamic-tag-types.md (minor brumate), .changeset/dynamic-tag-types-ui.md (minor @brumate/ui: Group's aria props, `ElementEvents`, handler types of the hooks).

Casts left in packages/ui: 1.

- TabList `keyDown`: `moveFrom` takes an `HTMLElement` (it reads the height), and the tag of a part can name an SVG element. Kind: a generic tag gives `HTMLElement | SVGElement`, and the code needs an HTML element.
- Outside ui, examples/ui/src/routes/index.brm keeps `event.currentTarget as HTMLFormElement` inside `prevent(...)`, a plain element (not this node's scope).

## Deviations

- The audit's shape, `$$dynamic<T extends keyof Elements | Component<any>>(tag, props: T extends keyof Elements ? ... : PropsOf<T>)`, was not used: it is the slow pattern of element-checks. Curried overloads instead, and the element overload takes `T extends string`, not `keyof Elements`. See Gotchas.
- Spread names are not checked on a dynamic tag (an unknown name inside a spread passes; a wrong value is an error). The name check cost 89M instantiations.
- packages/brumate/test/check.test.ts was edited (not in the brief's list): the existing `spanOf` searched the first `children` in the code, which is now in the helpers, so it searches the last one; plus one new test.
- The brief said about 97 casts; the base had 59 `currentTarget as`.

## Stubs left

- None.

## Gotchas

- Speed. A dynamic tag whose type includes `Component` (every `as` of the parts) that fails an overload `<T extends keyof Elements>(tag: T)` cost TypeScript about 50 ms and 16k relations each time, also on the resolved union. `<T extends string>(tag: T)` fails at once. A declaration with a mapped type over `keyof $$Attributes<T>` costs about 80M instantiations over the ui files. Measure the assignability cache size, not only instantiations: the first version had +1.5% instantiations and twice the time.
- An error from a spread value spans the opening tag, not the spread.
- A union of element names checks each attribute and `ref` against the union: `href` on `'button' | 'a'` passes, and so does a `ref` that fits one of them.
- A generic tag constrained to elements only (`T extends keyof Elements`) gets a deferred `$$Attributes<T>`, which an object literal does not satisfy. The parts use `AsTarget`, which takes the global form.
- `onItemAction` (camel) works on a plain element through `$$on`, but on a dynamic tag the object reports it: `ElementProps` has only `onItemaction` for merged events.
- A rest that holds an `aria-*` prop typed `unknown` and is spread after the part's own value is now an error.

## Proposed learnings

- A helper overload that a tag of type `AsTarget` can fail takes `T extends string`, not `T extends keyof Elements` | the failed constraint costs about 50 ms for each call | packages/brumate/src/check.ts | yes (assignability cache size in `--extendedDiagnostics`)
- A handler function names its target in its parameter (`event: KeyboardEvent & { currentTarget: Element }`) instead of casting it | the tag checks it now | packages/ui/src | no

## Verification

- `npx tsdown` in packages/brumate, language-core, tsc and language-server.
- `npx tsc --noEmit` in brumate (and `-p tsconfig.elements.json`), language-core, language-server, tsc, typescript-plugin, vscode: exit 0.
- `npx brumate-tsc --noEmit` in packages/ui, website and the 7 examples: exit 0.
- `npx vitest run`: packages/brumate 1111 passed; packages/tsc 1 passed; packages/ui (`--maxWorkers=2`) 576 passed, 1 expected fail.
- `npx oxlint`: exit 0. Root `npx oxfmt --check`: exit 0.
- `brumate-tsc --noEmit --extendedDiagnostics` in packages/ui, origin/main 81fa174b against head: instantiations 7,716,577 / 7,780,015 (+0.8%); types 225,111 / 272,028; assignability cache 272k / 334k. Three paired runs, check time 7.76/8.96, 7.85/8.88, 7.79/9.26 s (+14% to +19%); real 9.59/10.51, 9.57/10.38, 9.47/10.78 s (+9% to +14%). The machine was shared.

## Size

- Estimated M, actual M to L: the helper was small, but finding a shape that kept the time took most of the work.
