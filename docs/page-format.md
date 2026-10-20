# Page format

The server writes markers into the HTML and the state into a script. The client runtime reads both to resume. This document is the contract between the two.

## Scope IDs

Every scope that client code needs gets an integer ID at render time. IDs are given in render order, starting at `0`, so they are unique in the page.

- A component instance always gets an ID.
- A body scope gets an ID when it has slots or anchors, or when it is an item of a `#for` or `#repeat` whose list can change.
- A template call gets an ID when its body has slots or anchors.

## Anchors

An anchor is a node that client code must find. Each anchor has an index within its scope. An anchor is written as `<scope>:<index>`.

### Elements

```html
<button data-b="0:2" data-on="click=Counter_m86gta#h4">+</button>
```

- `data-b` is the anchor.
- `data-on` lists the event handlers, separated by spaces. Each entry is `<event>[:<modifier>…]=<reference>`.
- `data-prefetch` is the `prefetch` strategy, when it is set.

A reference is `<component ID>#<export name>`. The component ID is the component name and a hash of its file name. Handlers export as `h<n>`, and `$client` callbacks as `c<n>`.

### Text

```html
<!--t0:3-->1<!--/t-->
```

The value of a live insert is between the two comments.

### Blocks

```html
<!--b0:4:1--><p>B</p><!--/b-->
```

- The third number is the index of the branch that rendered, for `#if` and `#switch`. It is `-1` when no branch rendered.
- `#for`, `#repeat`, `#key`, `#try`, `#loading` and `#client` blocks have no third number.
- A `#client` block is empty. The client renders it when its trigger fires.

### Items

```html
<!--b0:2--><!--i1--><li>…</li><!--/i--><!--i2--><li>…</li><!--/i--><!--/b-->
```

Each item of a live `#for` or `#repeat` is between `<!--i<scope>-->` and `<!--/i-->`. The number is the item's scope ID.

### Listeners and `$client` callbacks

```html
<template data-b="0:1" data-listen="window" data-on="keydown=Blocks_jlmev2#h6"></template>
<template data-b="0:0" data-client="idle=Blocks_jlmev2#c4"></template>
```

- `data-listen` is `window` or `document`. The loader adds these listeners when the page loads.
- `data-client` is `<trigger>=<reference>`. For `visible`, the loader observes the next element sibling.
- A `#client` block has the same `<template>` before its markers. Its reference is `k<n>`, which renders the block.

## State

```html
<script type="brumate/state">{"t":10,"i":0,"p":{…}}</script>
<script type="brumate/state">{"t":…}</script>
```

The state is a stream of [seroval](https://github.com/lxsmnsyc/seroval) cross-reference JSON records, one script each. The server writes them with `toCrossJSONStream`, and the client reads them with `fromCrossJSON` and one `refs` map, so later records can refer to values of earlier ones.

- The first record holds the page state.
- Each later record settles a promise in the state. It can come after the client has started. The client reads it when the script is added to the page.

The first record turns into an object keyed by scope ID:

```ts
type PageState = Record<number, {
  /** The scope's ID in the compiled component, which selects its updates. */
  k?: number;
  /** The ID of the scope that contains this one. A component's root scope has none. */
  p?: number;
  /** The component ID, on a component's root scope. */
  m?: string;
  /** The item, on an item scope of a list that can change. */
  i?: unknown;
  /** Slot values, in the order of the scope's layout. */
  s?: unknown[];
  /** The scope IDs of child components, by anchor index. */
  c?: Record<number, number>;
}>;
```

- The slot order is the declaration order of the scope's slots in the compiled plan. Client modules read slots by index.
- Shared and cyclic references are kept. A `#for` item's slot points to the same object as the list in its parent's slot.
- A promise is written as pending, and a later record settles it. `renderToString` and `renderToStream` return as soon as the markup is rendered, and send later records as their promises settle.

Two values have their own plugins:

- `ElementReference` (`brumate/element`) is a `ref` signal whose element the server rendered. It holds the element's scope and anchor.
- `FunctionReference` (`brumate/function`) is a client function passed as a prop. It holds its reference and the scope it reads.

## Props

A child component stores its props in its own slots. When a parent passes a value that can change, the parent records the child's scope ID in `c`, at the anchor index of the component. The parent's update code then writes the new value into the child's slot.
