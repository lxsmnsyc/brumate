# Types of `.brm` markup: soundness and parity with Solid

Date: 2026-10-27. Brumate at `261cd1bb` (main). Solid reference: solid-js 1.9.17 `types/jsx.d.ts` (dom-expressions), and 1.9.5 for comparison.

How the probes ran: a scratch project (tsconfig copied from packages/tsc/test/fixture, `node_modules` symlinked to packages/ui/node_modules), checked with `node packages/tsc/bin/brumate-tsc.js -p tsconfig.json`. The checker uses TypeScript 6.0.3 (`typescript-api`) and its lib.dom. The repo was not touched; `git status` is clean.

The probe files were in a session scratchpad and are not kept. Each item below quotes its probe; write it again as a test when the node runs.

## What the `onClick` report most likely is

- An inline handler on a plain element is typed. `<button onClick=((event) => ...)>` gives `PointerEvent & { currentTarget: HTMLButtonElement }`, since lib.dom of TS 6 maps `click` to `PointerEvent`, which extends `MouseEvent` (Click.brm).
- A handler on a dynamic tag `<{as} onClick=((event) => ...)>` gets no type at all. Under `strict` it is error TS7006 (implicit any); without `noImplicitAny` it is silently `any` (Dynamic.brm:7). Every part in packages/ui renders through `<{as}>`, so the parts type their handlers by hand: 97 casts such as `event.currentTarget as HTMLElement` in 48 files, and 19 `(event: Event)` handlers.
- A handler declared as a function in the script, such as `function onClick(event) {}` passed as `{onClick}`, is not contextually typed (TS7006, Shorthand.brm:2). Solid has the same limit, but it exports `JSX.EventHandler<T, E>` to annotate it; brumate does not export its `Handler` type.

## 1. Unsound today

Each item: probe, actual, expected, cause.

1. Attributes of plain elements are not checked.
   - Probe Attrs.brm: `<input value=(obj) type="bogus" tabIndex=(1) foo=(1) checked=("yes")>`, `<div tabindex=("abc") hidden=(5) class=(obj) style=(42)>`, `<img loading="soon" src=(123)>`.
   - Actual: no error. Expected: errors on `type`, `tabIndex`, `foo`, `checked`, `tabindex`, `hidden`, `class`, `style`, `loading`, `src`.
   - Cause: packages/brumate/src/check.ts:366-371 writes `$$use(value)` for value and spread attributes. Static attributes are dropped (check.ts:391-392, `default: break`). `Elements` in packages/brumate/elements.d.ts:470 is never read by check.ts.

2. `ref=$bind(x)` on an element is not checked.
   - Probe Ref.brm: `let button = $signal<HTMLButtonElement>()`, `<div ref=$bind(button)>`, and `<span ref=$bind(n)>` with `n` a number signal.
   - Actual: no error. Expected: both are errors (the contract says a div does not bind a button signal).
   - Cause: check.ts:377-381 writes `$$use(name)`. The contract notes this (element-types.md, "check.ts does not check ref yet").

3. Handlers on a dynamic tag have no event type.
   - Probe Dynamic.brm:7: `<{tag} onClick=((event) => event.clientX)>` with `tag: 'button' | 'a'`.
   - Actual: `event` is implicit `any` (TS7006 under strict). Expected: `PointerEvent & { currentTarget: HTMLButtonElement | HTMLAnchorElement }`.
   - Cause: check.ts:55 declares `$$dynamic(tag, props: Record<string, unknown>)`, so a handler in the props has no contextual type.

4. Attributes and props of a dynamic tag are not checked.
   - Probe Dynamic.brm and More.brm: `<{tag} href=(1) foo="x">`, `<{comp} onPress=(5) bogus=(1)>` with `comp: typeof Button`, `<{'nothing'} foo=(1)>`.
   - Actual: no error. Expected: `href` is a string, `foo` and `bogus` are unknown, `onPress` is a function, `'nothing'` is not a tag.
   - Cause: check.ts:55 (`tag: string | (props: never) => unknown`, `props: Record<string, unknown>`) and check.ts:337-344. A `ref` on a dynamic tag is dropped by `props()` (check.ts:438).

5. An event name the DOM does not have is accepted, and the handler gets `Event`.
   - Probe Events.brm:4-5: `<div onDoubleClick=...>` and `<div onFooBar=...>`; More.brm:8 `<window onFooBar=...>`.
   - Actual: accepted, `event: Event & { currentTarget: HTMLDivElement }`. `onDoubleClick` listens to `doubleclick`, which never fires. Expected: an error that names `onDblClick`, as the component path already says (Comp.brm:8: "Did you mean to write 'onDblClick'?").
   - Cause: check.ts:56 `$$Event<K, M> = K extends keyof M ? M[K] : Event`, the fallback to `Event`. Same for `$$onWindow` and `$$onDocument` (check.ts:59-60).

6. Custom events merged into `ElementEvents` do not reach handlers in markup.
   - Probe Custom.brm: `declare module 'brumate/elements' { interface ElementEvents { itemaction: CustomEvent<string> } }`, then `<div onItemAction=((event) => event.detail)>`.
   - Actual: TS2339, `detail` does not exist on `Event & { currentTarget: HTMLDivElement }`. Expected: `CustomEvent<string>`, as the contract promises ("An event that the DOM does not have is added by merging into ElementEvents").
   - Cause: check.ts:58 reads `HTMLElementEventMap`, not `import('brumate/elements').ElementEvents`.
   - Also in `ElementProps`: the camel name `onItemAction` does not exist, only `onItemaction` (events-aug.ts:7), because `CamelEvent` is a fixed list (elements.d.ts:54-123). The compiler lower-cases the name, so `onItemAction` works at run time.

7. Children of a component are `any`, and a component that takes no children accepts them.
   - Probe Kids2.brm: `<Bare>hello</Bare>` where Bare has `$props<{ label?: string }>()`; Kids.brm: `<NoKids>hello</NoKids>` where `children?: number`.
   - Actual: no error. Expected: an excess-property error for Bare, and a type error for `number`.
   - Cause: check.ts:443 writes `children: undefined as any`. The text is not mapped to the file, so the excess-property error that TypeScript reports for it is dropped by the language plugin (the same call in a `.ts` file does report TS2353). element-checks plans `Markup` children.

8. Spreads and computed attributes on elements are not checked.
   - Probe Spread.brm: `const rest = { onClick: 5, tabindex: 'x', foo: 1 }`, `<div {...rest} [name]=({})>`.
   - Actual: no error. Expected: `onClick` must be a handler, `tabindex` a number, `foo` unknown.
   - Cause: check.ts:367-371 (spread) and check.ts:382-390 (computed) write `$$use`.

9. `currentTarget` of a MathML element is `HTMLElement`.
   - Probe More.brm:9: `<math onClick=((event) => { const h: HTMLElement = event.currentTarget; })>`.
   - Actual: `HTMLElement`, so `event.currentTarget.innerText` or `.click()` compiles. At run time it is a `MathMLElement`, which has neither. Expected: `MathMLElement`.
   - Cause: check.ts:57 `$$Element<T>` checks only `HTMLElementTagNameMap` and `SVGElementTagNameMap`; elements.d.ts:817-821 `ElementOf` does the same.

10. `currentTarget` of `a`, `script`, `style` and `title` inside `<svg>` is the HTML element.
    - Probe More.brm:10: `<svg><a href="#x" onClick=((event) => { const h: string = event.currentTarget.href; })>`.
    - Actual: compiles, `HTMLAnchorElement`. At run time it is `SVGAElement`, whose `href` is an `SVGAnimatedString`, not a string. Expected: `SVGAElement`, or `HTMLAnchorElement | SVGAElement`.
    - Cause: check.ts:57 picks the HTML map first; the contract chose this on purpose ("the SVG a has the type of the HTML a"), see section 3.

11. `target` of every event is `EventTarget | null`.
    - Probe Events.brm:6: `<input onInput=((event) => { const v: string = event.target.value; })>`.
    - Actual: TS18047 and TS2339. This is safe but unhelpful: it forces casts. Solid types `target` as `Element`, and as the element itself for `input`, `change`, `focus` and `blur` on `input`, `select` and `textarea`.
    - Cause: check.ts:58 intersects only `currentTarget`.

12. Typings that the runtime rejects or that the stricter check would reject (these become errors once item 1 is fixed, so element-checks must handle them first).
    - `class` takes only a string (elements.d.ts:144). The runtime takes arrays and objects (packages/brumate/src/runtime/html.ts:79-102, `classValue`), and the examples write `class=(['task', on && 'on'])`. Probe events-aug.ts:11: TS2322.
    - `style` takes only a string (elements.d.ts:145). The runtime takes an object with camel-case names (html.ts:113-121, `styleValue`). Probe events-aug.ts:11: TS2322.
    - `select` has no `value` (elements.d.ts:684-692), though analyze.ts:1688-1690 allows `value=$bind(x)` on a select. Probe events-aug.ts:13: TS2353.
    - `value` and `checked` of `input`, `select` and `textarea` do not take `BoundSignal<T>` (elements.d.ts:261-262, 303), though `value=$bind(v)` and `checked=$bind(c)` are the binding syntax (Kids2.brm:11, packages/tsc/test/fixture/src/Bind.brm:11).
    - `form action` takes only a string (elements.d.ts:521). The examples write `<form action=signUp>` with a server function. Probe events-aug.ts:15: TS2322. `formaction` of `button` and `input` is the same (elements.d.ts:225, 283).
    - Number attributes take only numbers: `tabindex` (elements.d.ts:166), `rows`, `cols`, `colspan`, `maxlength`. A static value is always a string, and the repo has 37 `tabindex="0"` or `tabindex="-1"` and 2 `rows="3"`. Probe events-aug.ts:22: TS2322 for `tabindex: '0'`.
    - `autocomplete` of `input` takes a string, but the runtime writes `on` and `off` for a boolean (html.ts:143); `autocomplete=(true)` would be an error.

13. Smaller defects in `Handlers` (elements.d.ts).
    - `CamelEvent` has `ToggleEnd` (elements.d.ts:114), which lib.dom does not have, so `onToggleEnd` is `never`.
    - `CamelEvent` lacks `KeyPress`, so `onKeyPress` is missing and only `onKeypress` exists (events-aug.ts:9). lib.dom has `keypress`.

Checked and sound: an inline handler on a plain element (Click.brm), a wrong-typed function handler (Shorthand.brm:7, TS2345), handlers wrapped in `prevent(...)` (More.brm:7, the arrow is still typed), `onSubmit` is `SubmitEvent`, `onToggle` is `ToggleEvent`, `<window>` events read `WindowEventMap`, and props of a component tag, including `as="a"` (Comp.brm: `currentTarget: HTMLAnchorElement`, `href=(1)` is TS2322).

## 2. Missing compared with Solid

### Event handlers

- Per-event types: Solid lists each handler with its event (`onClick: MouseEvent`, `onInput: InputEvent`). Brumate reads lib.dom, so `onClick` is `PointerEvent` (lib.dom of TS 6), which is a subtype of `MouseEvent`. Not a gap, but it differs from Solid.
- `target`: Solid types `target` as `Element`, and as the element for `onInput`, `onChange`, `onBeforeInput`, `onFocus`, `onBlur`, `onFocusIn` and `onFocusOut` on form controls (`InputEventHandler`, `ChangeEventHandler`, `FocusEventHandler`). Brumate leaves `EventTarget | null`.
- Exported handler types: Solid exports `JSX.EventHandler<T, E>`, `EventHandlerUnion`, `InputEventHandler` and more, to annotate a handler declared apart. Brumate keeps `Handler<Ev, E>` private (elements.d.ts:50).
- Lower-case and camel names: Solid has both (`onkeydown` and `onKeyDown`). Brumate has both, as `onKeydown` and `onKeyDown`.
- Events outside lib.dom: Solid adds `onBeforeCopy`, `onBeforeCut`, `onBeforePaste`, `onScrollSnapChange`, `onScrollSnapChanging`, `onContentVisibilityAutoStateChange`, `onBeforeXRSelect`, `onDragExit`, and the media events `onEncrypted` and `onWaitingForKey`. Brumate has only what lib.dom has, plus what an app merges into `ElementEvents`.
- Window events on `<body>` and `<svg>`: Solid has `onBeforeUnload`, `onHashchange`, `onPopstate` and the others on `body`. Brumate puts them on `<window>` and `<document>` listener tags (check.ts:348-355), typed from `WindowEventMap` and `DocumentEventMap`.
- Bound handlers `[fn, data]`, `on:` and `oncapture:`, handler objects with options: see section 3.

### Per-element attributes

- `select`: Solid has `value`. Brumate lacks it.
- `meter`: Solid has `form`; brumate lacks it.
- `dialog`: Solid has `closedby`, and sets `tabindex?: never`. Brumate has neither.
- `template`: Solid has `shadowrootclonable`, `shadowrootdelegatesfocus`, `shadowrootserializable`, `shadowrootcustomelementregistry`. Brumate has only `shadowrootmode`.
- `style`: Solid has `type` and `blocking?: 'render'`. Brumate has `media` and `blocking` as a string.
- `script`: Solid types `type` as `'importmap' | 'module' | 'speculationrules' | string`, `blocking` as `'render'`. Brumate has strings.
- `link`: Solid types `as` with the destinations (`audio`, `font`, `image`, `script`, `style` and more). Brumate has a string.
- `input`: Solid has `autocomplete` as the list of autofill tokens plus any string, `alpha`, `colorspace` (color inputs), `incremental`. Brumate has a string, and lacks the others. Solid's `type` also takes any string; brumate's is closed (stricter, fine).
- `textarea`, `select`, `input`: Solid's `autocomplete` is `HTMLAutocomplete`; brumate's is a string.
- `iframe`: Solid types `sandbox` with its tokens and has `credentialless`, `csp`, `browsingtopics`. Brumate has `sandbox` as a string and lacks the others.
- `img`, `a`, `area`: Solid has `attributionsrc`; `area` has `download`, `ping`, `rel`, `target`, `referrerpolicy` (brumate's `area` takes these through `AnchorOwn`, so this is covered).
- `meta`: Solid types `http-equiv` with its values. Brumate has a string.
- `media` (`audio`, `video`): Solid types `controlslist` with its tokens. Brumate has a string.
- `button`: Solid types `command` with `show-modal`, `close`, `show-popover`, `hide-popover`, `toggle-popover` or any string. Brumate has a string.
- Number attributes: Solid takes `number | string` for `tabindex`, `colspan`, `rowspan`, `cols`, `rows`, `maxlength`, `size`, `start`, `span`, `low`, `high`. Brumate takes only `number` (see item 12).
- Deprecated attributes and tags (`align`, `bgcolor`, `frameborder`, `big`, `keygen`, `menuitem`, `param`): Solid has them. Brumate leaves them out. Not needed.

### Global attributes

- Microdata: Solid has `itemid`, `itemprop`, `itemref`, `itemscope`, `itemtype`. Brumate lacks them.
- RDFa: Solid has `about`, `datatype`, `prefix`, `property`, `resource`, `typeof`, `vocab`. Brumate lacks them (it has `property` only on `meta`).
- Solid also has `autocorrect`, `exportparts` and `elementtiming`. Brumate lacks them; the runtime already treats `autocorrect` as an on/off switch (html.ts:144).
- `popover`: brumate has `'hint'` too; Solid lacks it. Brumate is ahead.
- Namespaced names: brumate parses one `:` namespace (parser.ts:506), such as `xlink:href` and `xml:lang`, but no element type lists them.

### Attribute value types

- `style`: Solid takes `CSSProperties | string`, where `CSSProperties` is csstype's hyphenated properties plus `-${string}` custom properties. Brumate takes a string, while its runtime takes an object.
- `class` and `classList`: Solid has `class: string` and `classList: { [name]: boolean }`. Brumate's runtime takes a string, an array or an object in `class`, but the type takes a string.
- Booleans: both take `boolean` for boolean attributes and `boolean | 'true' | 'false'` for the switch attributes (`draggable`, `spellcheck`, `contenteditable`).

### ARIA and roles

- Solid types each `aria-*` attribute of WAI-ARIA 1.2: booleans (`aria-expanded: boolean | 'true' | 'false'`), tristates (`aria-checked` and `aria-pressed` with `'mixed'`), enumerations (`aria-live`, `aria-sort`, `aria-autocomplete`, `aria-haspopup`, `aria-current`, `aria-orientation`, `aria-relevant`, `aria-invalid`, `aria-dropeffect`), numbers (`aria-level`, `aria-valuenow`) and ID references.
- Solid types `role` as the union of ARIA roles.
- Brumate has `[attribute: aria-${string}]: string | number | boolean` and `role: string` (elements.d.ts:150, 170). Probe events-aug.ts:17: `aria-expanded: 'maybe'`, `aria-live: 7` and `role: 'buton'` are accepted.
- A packages/brumate/src/a11y.ts exists for compile-time accessibility checks; typed ARIA values would catch value typos in the type check as well.

### `ref`

- Solid: `ref?: T | ((el: T) => void)`. Brumate: `ref=$bind(name)` only, with a contravariant `WritableMark<E>` (elements.d.ts:143). The type is sound; check.ts does not use it (item 2).

### Children

- Solid: `children?: JSX.Element`, where `Element` is a node, string, number, boolean, null, undefined or an array of them. Brumate: `Markup` exists (elements.d.ts:13), but check.ts passes `children: undefined as any` (item 7).

### Custom elements and `data-*`

- Solid: an app adds tags to `JSX.IntrinsicElements` and events to `JSX.CustomEvents` (for `on:`). Brumate: an app merges into `Elements` and `ElementEvents`. Neither reaches the markup check today (items 1 and 6). `data-*` is typed in brumate (`unknown`); in Solid, TSX lets hyphenated names through unchecked.

### MathML

- Solid 1.9.17 has `MathMLElementTags` with the attributes of each element (`math`, `mi`, `mo`, `mfrac`, `mrow`, `msup`, `mtable` and the rest, 30 tags). Brumate has no MathML tag in `Elements`; lib.dom has `MathMLElementTagNameMap` with the same 30 (the contract scoped `Elements` to HTML and SVG).

### SVG

- Solid has an interface for each SVG element, built from groups (presentation, filter primitives, gradients, animation timing). Brumate shares one list of about 145 names, each `string | number`. See section 3.

## 3. Deliberate differences, not gaps

- Attribute names, not DOM fields: `tabindex` not `tabIndex`, `class` not `className`, no `innerHTML`, `textContent` or `innerText` (element-types.md, Behavior; packages/ui/test/props-types.ts:128-140). Solid accepts both names and some properties.
- No `prop:`, `attr:` or `bool:` prefixes. Brumate writes attributes only, and the runtime decides booleans by name (html.ts:123-148).
- No `use:` directives (docs/decisions.md:120).
- `ref` takes `$bind` only, never a callback or a bare name (docs/decisions.md:9).
- Modifiers are wrapper functions (`prevent`, `stop`, `once`, `capture` of `brumate/events`) and `onX:capture`, not `on:` or `oncapture:` (docs/decisions.md:106, 112). There is no handler object with `AddEventListenerOptions`: the loader listens once per type on the document.
- No bound handler tuples `[fn, data]`. A handler is a function that the compiler marks and writes into `b-on` (docs/decisions.md:112, 123).
- Window and document events go on `<window>` and `<document>` tags, not on `<body>`.
- SVG elements share one attribute list, and `a`, `script`, `style` and `title` take the HTML types (element-types.md, Behavior). This is a choice for size, but item 10 shows its cost for `currentTarget`.
- `input type` is closed, without Solid's `string & {}` fallback. Stricter on purpose.
- `Markup` is opaque and a string is not `Markup` (element-types.md). Solid's `JSX.Element` takes strings and numbers.
- No `$ServerOnly`, `ElementClass` or `FunctionMaybe`. Components run on the server only (docs/decisions.md:5).
- Deprecated tags and attributes are left out.

## 4. Proposed work

Sizes are S or M. element-checks (status todo, size L) owns packages/brumate/src/check.ts and plans to check element attributes, `ref`, `Markup` children and templates, and to fix the callers. ui-generics (status todo) owns the generic `V` of the collection parts. Items below say where they overlap.

### A. `$$on` reads `ElementEvents`, and an unknown event is an error (S)

- Goal: handlers in markup see custom events merged into `ElementEvents`, and `onDoubleClick` or `onFooBar` is an error.
- Fixes items 5 and 6.
- Files: packages/brumate/src/check.ts (HELPERS, lines 56-60), packages/tsc/test/fixture/src/*.brm, packages/tsc/test/tsc.test.ts, packages/brumate/test/check.test.ts.
- Depends on: none. Overlap: element-checks owns check.ts. Land it first, or fold it into element-checks; A is small enough to go before it.
- Risk: an unknown event in the repo becomes an error. Run `brumate-tsc --noEmit` on ui, website and examples.

### B. Element type fixes in `elements.d.ts` that the stricter check needs (M)

- Goal: `Elements` accepts every value that the runtime and the syntax accept, so element-checks does not report false errors.
- Fixes item 12 and item 13.
- Changes: `class` takes `ClassValue` (string, array, object of booleans, nested); `style` takes a string or a style object with camel-case and `--custom` names; `select` gets `value`; `value` and `checked` of `input`, `select` and `textarea` take `BoundSignal<T>`; `form action` and `formaction` take a server function; number attributes take `number | \`${number}\``; `autocomplete`takes a boolean; drop`ToggleEnd`, add `KeyPress`; export `Handler<Ev, E>`as`EventHandler<E, Ev>`.
- Files: packages/brumate/elements.d.ts, packages/brumate/test/elements-types.ts, docs/roadmaps/brumate/contracts/element-types.md (a v1.1 change entry; the contract is frozen, so it needs a change request).
- Depends on: none. Must merge before element-checks. Overlap: element-checks reads the contract; this is a contract change, not its work.

### C. Typed dynamic tags (M)

- Goal: `<{tag}>` checks its attributes and types its handlers from the tag: the element types for an element name, the props for a component.
- Fixes items 3 and 4, and lets the ui parts drop most of their 97 casts.
- Shape: `$$dynamic<T extends keyof Elements | Component<any>>(tag: T, props: T extends keyof Elements ? ElementProps<T> : PropsOf<T>)`, with the same mapped prop names as `component()`. A generic `T extends AsTarget` inside a part resolves to the union, so handlers get `HTMLElement | SVGElement` as `currentTarget`, still better than `any`. `ref` on a dynamic tag is checked too.
- Files: packages/brumate/src/check.ts (lines 55, 337-344, 415-445), packages/tsc fixture and test.
- Depends on: B. Overlap: element-checks says "plain elements"; dynamic tags are not named in its brief, so C is either a second step of element-checks or its own node after it. Fixing callers in packages/ui overlaps ui-generics' files (ListBox, GridList, Tree, Select and others): run it after ui-generics, as element-checks already must.

### D. Element attributes, spreads and `ref` against `ElementProps` (M, but the caller fixes are L)

- Goal: items 1, 2 and 8: `<div ...>` writes one object literal checked against `ElementProps<'div'>`, with static values as string literals, spreads as `...rest`, and `ref: $bind(name)`.
- This is element-checks itself. Do not split it out; list items 1, 2 and 8 as its acceptance. Depends on B, so that it does not report the false errors of item 12.

### E. Children as `Markup`, mapped (S)

- Goal: item 7: write `children: $$markup` (typed `Markup`) and map it to the children range, so a component that takes no children reports an error at its tag.
- Files: packages/brumate/src/check.ts:443.
- Overlap: element-checks plans "Children are `Markup`". Add the mapping detail (the error is dropped today because the text is unmapped) to its brief rather than doing it twice.

### F. MathML elements and `currentTarget` (S)

- Goal: items 9 and 10: `Elements` gets the 30 MathML tags (global MathML attributes plus `display`, `mathvariant`, `scriptlevel` and the per-element ones), and `$$Element` and `ElementOf` read `MathMLElementTagNameMap`.
- Optional: `a`, `script`, `style` and `title` give `HTMLX | SVGX` as `currentTarget`, which needs a change of the contract decision.
- Files: packages/brumate/elements.d.ts, packages/brumate/src/check.ts:57, packages/brumate/test/elements-types.ts, element-types.md.
- Depends on: none. Overlap: none with element-checks or ui-generics; check.ts:57 is a one-line touch of element-checks' file.

### G. Typed ARIA attributes and roles (M)

- Goal: each `aria-*` of WAI-ARIA 1.2 with its value type (boolean, tristate, enumeration, number, ID list), and `role` as the union of roles, keeping `aria-${string}` for the rest.
- Files: packages/brumate/elements.d.ts, packages/brumate/test/elements-types.ts, element-types.md.
- Depends on: B (same file and contract change). Fixes in packages/ui callers may follow once D lands. Overlap: none.

### H. `target` for form controls (S)

- Goal: item 11, as Solid: `target` is `Element` in general, and the element itself for `input`, `change`, `beforeinput`, `focus`, `blur`, `focusin` and `focusout` on `input`, `select` and `textarea`.
- Files: packages/brumate/elements.d.ts (`Handler`), packages/brumate/src/check.ts:58, tests.
- Depends on: A (same helper). Note: `target` as `Element` is not strictly sound (a text node is never a target, but `window` and `document` are for some events); keep `EventTarget` for `<window>` and `<document>`.

### I. Missing attributes from section 2 (S)

- Goal: the per-element and global attributes Solid has that are current HTML: `meter form`, `dialog closedby`, `template shadowroot*`, `style type`, typed `link as`, `script type`, `meta http-equiv`, `iframe sandbox` tokens, `input autocomplete` tokens, `button command`, microdata, `autocorrect`, `exportparts`, `xlink:href` and `xml:lang` on SVG.
- Files: packages/brumate/elements.d.ts, packages/brumate/test/elements-types.ts.
- Depends on: B (same file). Overlap: none.

### Order

A, B and F can start now and in parallel (A and F touch check.ts by one or two lines each). G, H and I follow B. D (element-checks) follows B, as-sound, as-collections and as-controls (done) and ui-generics (todo). E goes into D. C follows D and ui-generics.
