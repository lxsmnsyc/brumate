# Log: element-checks

## 2026-10-27

- Probe: a fixture file with `{n.nope}` and `<div tabindex="abc" foo="x">`, checked alone with `brumate-tsc -p`. Exit 2, with only the `nope` error: the checker runs, and the attributes were not checked.
- First kind end to end: static and value attributes into `$$element(tag, { ... })`, typed by `Elements[tag]` (a tag outside `Elements` takes any). `tabindex="abc"`, `loading="soon"`, `src=(123)` and `foo` each report at the attribute.
- TypeScript reports one error per object argument when a property has the wrong type, so `tabindex="abc" foo="x"` on one element shows only the first. Each acceptance case is on its own element.
- `ref=$bind(x)`: a local `$$bind` helper (`BoundSignal<T>`), so the file needs no import of `$bind`. A button signal on a div reports at `ref`.
- Spreads: an object spread inside a literal has no excess check, so `{...{ foo: 1 }}` passed. Spreads are checked apart, `$$spread(tag, value)`, each key mapped to the element's type or `never`.
  - A first version constrained `S extends ElementProps<tag>`. That rejected every interface (`FieldAttributes` in examples/tracker): an interface has no implicit index signature, and `ElementProps` has `data-*` and `aria-*` index signatures. The mapped form `{ [K in keyof S]: ... }` has no such constraint.
  - Copied without parentheses, so the error is at the spread and not dropped.
- Computed attributes: `[(name)]` in parentheses is not a known property for TypeScript, so `[name]` is copied bare. Its brackets are mapped, else the error starts at an unmapped `[` and Volar drops it.
- Names that are not identifiers (`aria-label`) were written as unmapped strings, so their errors were dropped. `Writer.key` maps the quotes to the first and last characters of the name. The same for `children`, which stands for the range of the children. Bug on the way: `<b>x</b>` is 8 characters, as `children`, so the first version copied the source. It now copies only when the text equals the name.
- First full run: packages/ui 55 errors, website 2, examples/ui 53 (the ui parts again), tracker 1. Main kinds:
  - 51 spreads of `[attribute: string]: unknown` rests onto a plain element (45 parts).
  - 2 attributes missing from `Elements`: `autocorrect`, `webkitdirectory`. Website: `focusable`.
- Rest typing: after typing the parts' props as element attributes, the rest still held the bindable props of the other `$props` call (`isSelected`, `value`, `isOpen`). The compiler leaves those out at runtime (`$$b.unbind` with the other names, codegen/patch.ts), so check.ts now does too: `$props<$$Omit<T, "isSelected">>()` for a call with a rest. `$$Omit` is a key-remapping mapped type, since `Omit` on a type with a string index signature drops the known props.
- Then 14 parts had own props that clash with element attributes (`onChange`, `onDrop`, `onResize`, `onSelectionChange`, `id`): `Omit<ElementProps<tag>, ...>`.
- Input and TextArea spread context attributes typed `Record<string, unknown>` (contexts.ts, slots.ts, outside this node). Cast at the spread to `ElementProps<'input'>` / `<'textarea'>`.
- Checked in a temporary ui test (deleted) that `webkitdirectory` and `autocorrect="off"` still render after the spread workaround.
- Templates: a probe with `#template row(item)` gave TS7006 for `item` (strict) and reported `foo` on a `<p>` and `.nope` inside the body. Template bodies are checked; untyped parameters are `any`.
- No element call is written for an element with no attributes, so the generated code stays as small as before for plain markup.
- Change request accepted (element-types v1.2). Merged origin/main (the docs nodes had added comments to the parts' props, 27 conflicts, each resolved by taking main's file and applying the same type change). Added `autocorrect` and `webkitdirectory` to elements.d.ts, reverted the two spread workarounds, dropped `focusable` from the website's Icon, and added both attributes to the fixture.
- Review fixes. Time: `brumate-tsc` in packages/ui took about 3x main (21.6M instantiations against 7.3M). Cause, found by micro files with `--extendedDiagnostics`: the helpers typed a parameter from a generic `T extends string` through `T extends keyof Elements ? Elements[T] : ...`. The declaration of `$$spread` alone cost about 80k instantiations, and it is in the helpers of every generated file (about 150). A call `f<T>(tag, { ... })` against `Elements[T]` cost about 250k too, even with `NoInfer`, but the curried `f(tag)({ ... })` cost 700. Fix: curried helpers constrained by `keyof Elements`, an overload for other tags, and names checked by `Exclude<keyof S, keyof Elements[T]>` with the values checked by `$$element(tag)({...value})`. Now 7.7M.
- NavigationTreeItemLink takes `ElementProps<'a'>` (link attributes kept), Cell `ElementProps<'th'>`, each with a cast at the other element. Namespaced attributes are not checked by name.
