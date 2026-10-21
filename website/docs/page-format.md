# Page format

The server writes markers into the HTML and the state into scripts. The core reads both to resume the page. This page describes that contract, for contributors and for tools that read brumate pages.

## Scope IDs

Every scope that client code needs gets an integer ID at render time. The server gives IDs in order, from the `base` of the render, which is 0 for a normal page. Scopes that the client creates get negative IDs, so they never match IDs that the server sends later.

- A component instance always gets an ID.
- A body scope gets an ID when it has slots or anchors, or when it is an item of a `#for` or `#repeat` whose list can change.
- A `#template` call gets an ID when its body has slots or anchors.

`#loading` bodies get boundary IDs from a second counter, which also starts at the base.

## Anchors

An anchor is a node that client code must find. Each anchor has an index within its scope, and is written as `<scope>:<index>`.

### Elements

```html
<button data-b="0:2" data-on="click=Counter_24o7ge#h4">+</button>
```

- `data-b` is the anchor.
- An element whose only client code is its handlers has no `data-b` when an element around it in the same scope has one. The core finds the scope of its handlers with `closest('[data-b]')`. The compiler does this only when that element is one the browser keeps whole, so not a `<p>`, a heading, a table section or a `<select>`.
- `data-on` lists the event handlers, separated by spaces. Each entry is `<event>[:<modifier>…]=<reference>`.
- `data-prefetch` is the `prefetch` strategy, when it is set.
- `data-v="<scope>"` marks a top-level element of a component whose style variables can change.

A reference is `<component ID>#<export name>`. The component ID is the component name and a hash of its path relative to the root. Handlers export as `h<n>`, and `$client` callbacks as `c<n>`.

### Text

```html
<!--t0:3-->1<!--/t-->
```

The value of a live insert is between the two comments.

When the insert is the whole content of an element, the element gets the anchor instead, and the value is its children:

```html
<span data-b="1:1">One</span>
```

Elements whose content is text, such as `<textarea>` and `<title>`, keep the comments.

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

When the body of the item is one element and nothing else, the element's `data-b` marks the item instead. The element always gets an anchor, and its scope is the item's scope:

```html
<!--b0:2--><li data-b="1:0">…</li><li data-b="2:0">…</li><!--/b-->
```

The core tells these elements from the elements of the fallback by their scopes. An item scope's parent is the scope of the list, and its kind is not one of the fallback's. A `<p>`, a heading, a table section, or a `<tr>` with content other than cells keeps the comments, because the browser can end it early and split the item.

### `#loading`

```html
<!--l0--><p>Loading…</p><!--/l-->
```

The server writes the fallback between `<!--l<id>-->` and `<!--/l-->`, where the number is the boundary ID, and renders the body after the rest of the page. When the body is ready, the stream sends:

```html
<template data-l="0"><blockquote>…</blockquote></template>
<script>$bS(0)</script>
<script data-state data-scopes data-next="5">$bR(($R,$b)=>(…))</script>
```

- The `<template>` holds the body.
- The script moves the body in, in place of the fallback and the markers. The first swap script of a page also defines `$bS`.
- The state record holds the scopes of the body. It comes after the swap, so the markup of its scopes is in the page when the core reads it.

If the body fails, the fallback stays.

The body renders with the values of the server. If a value changed in the browser before the body arrived, the core runs the updates of the body's scopes once, so the body shows the current values. Effects do not run.

A `#loading` body that sets the head after the first render also sends `<template data-h="<id>">` with its head markup. `$bH(id, title)` moves it into the head and sets the title.

### `#portal`

```html
<!--P4--><dialog open>Saved</dialog><!--/P-->
```

The content of a portal is between `<!--P<scope>-->` and `<!--/P-->`, where the number is the scope ID of the portal's body. The server writes it after the rest of the page. When the scope is removed, the client removes the content by its markers. A portal into a target has a `<template data-client="load=…">` in its place, and the client renders it into the target.

### Listeners and `$client` callbacks

```html
<template data-b="0:1" data-listen="window" data-on="keydown=Blocks_jlmev2#h6"></template>
<template data-b="0:0" data-client="idle=Blocks_jlmev2#c4"></template>
```

- `data-listen` is `window` or `document`. The loader adds these listeners when the page loads.
- `data-client` is `<trigger>=<reference>`. For `visible`, the loader observes the next element sibling.
- A `#client` block has the same `<template>` before its markers. Its reference is `k<n>`, which renders the block.

### Route slots

```html
<!--R0:children:3:%2Ftodos%2F%5Bid%5D%20%7B%22id%22%3A%223%22%7D--><article>…</article><!--/R-->
```

Each slot of a layout that a route renders into is marked with `<!--R<layout scope>:<name>:<route scope>:<route key>-->` and `<!--/R-->`.

- The layout scope is `-1` when the slot is not inside a scope.
- The route key is the file and the params of the route, encoded with `encodeURIComponent`, such as `/todos/[id] {"id":"3"}`. Two pages with the same key for a layout render the same layout.

### Styles

The stylesheet of a component is `<style data-brm="<component ID>">`, once per page, before the first instance of the component. See [Style compilation](./style-compilation.md).

## State

```html
<script data-state data-scopes data-next="5" data-route="…">function $bR(f){…}$bR(($R,$b)=>(($R[0]={0:$R[1]={k:1,m:"App_x1",s:$R[2]=[1]}})))</script>
<script data-state>$bR(($R,$b)=>(…))</script>
```

The state is a stream of [seroval](https://github.com/lxsmnsyc/seroval) cross-reference records, one inline script each. The server writes them with `crossSerializeStream`. Each record is a function of `$R`, the references of its render, and `$b`, the functions that make brumate's values.

- The first record of a render defines `$bR`. `$bR` pushes the script and the function to the array `self.$brm`.
- The core calls the functions in order when it starts, with one `$R` array per render, so later records can refer to values of earlier ones. Records that run after the core started are read at once.
- A page that never gets an event never builds its state. The records wait in `self.$brm`.
- A record whose script is no longer in the page when the core starts is skipped, such as a record of a page that navigation replaced.
- A record with `data-scopes` holds scopes: the page state, or the state of a `#loading` body.
- Any other record settles a promise of an earlier record.
- seroval writes every `<` in a string as `\x3C`, and U+2028 and U+2029 as escapes, so a value cannot end the script or open a comment. The server refuses a record that holds `</` or `<!`.
- A script added with `innerHTML` does not run, so its record is not read. Markup that streams in through the parser, or that the client router adds, runs its records.

The first record turns into an object keyed by scope ID:

```ts
type PageState = Record<number, {
  /** The scope's kind: its number in the compiled component, which selects its updates. */
  k?: number;
  /** The ID of the scope that contains this one. A component's root scope has none. */
  p?: number;
  /** The component ID, on a component's root scope. */
  m?: string;
  /** The item, on an item scope of a list that can change. */
  i?: unknown;
  /** On a component's root scope, the scope that rendered it, for finding contexts. */
  o?: number;
  /** The values that the scope provides, by context key. */
  v?: Record<string, unknown>;
  /** The slots that hold the contexts that the scope reads, by context key. */
  x?: Record<string, number>;
  /** Slot values, in the order of the scope's layout. */
  s?: unknown[];
  /** The scope IDs of child components, by anchor index. */
  c?: Record<number, number>;
}>;
```

The server writes records that share their shape in groups, under the key `g`, such as the items of a list. Each scope in a group costs its slots and one number:

```js
// Three todo items of kind 2 in scope 0, whose item is their first slot.
g: [[2, 0, 1, 1, 1, $R[4], 1, $R[5], 1, $R[6]]]
```

- A group is `[kind, base, flags, slotCount, module?, ...scopes]`.
- Each scope is the gap from the ID before it, then its slots, then its item and its child components when the flags say so. The first gap is from `base`.
- `base` is the parent, `p`, of every scope of the group. For the root scopes of components, flag 8, it is the distance from the scope that rendered each one, `o`, to its ID, and the first gap is from 0.
- The flags are 1 when the item is the first slot, 2 when the item comes after the slots, 4 when the child components `c` come after that, 8 for component root scopes, and 16 when `module` is in the header.
- A group holds the fields `k`, `p`, `o`, `m`, `s`, `i` and `c`. A record with other fields, a record without a parent or an owner, and the only record of its shape keep their own object.
- The core turns the groups back into one record per scope before it moves IDs or adds scopes.

- The slot order is the order of the scope's slots in the compiled plan. Client modules read slots by index.
- Errors keep their name and message only.
- Regular expressions are not written or read.
- Shared and cyclic references are kept. A `#for` item's slot points to the same object as the list in its parent's slot.
- A promise is written as pending, and a later record settles it.

Values with plugins of their own, and the call of `$b` that makes each one in a record:

| Tag                     | In a record                 | Value                                                                                                          |
| ----------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `brumate/element`       | `$b.e(scope, anchor)`       | `ElementReference`: a `ref` signal whose element the server rendered. It holds the element's scope and anchor. |
| `brumate/function`      | `$b.f(reference, scope)`    | `FunctionReference`: a client function passed as a prop. It holds its reference and the scope it reads.        |
| `brumate/raw`           | `$b.r(html)`                | HTML that the client may insert again, such as `children`.                                                     |
| `brumate/component`     | `$b.c(id)`                  | A component, as its component ID, for dynamic tags.                                                            |
| `brumate/url`           | `new URL(href)`             | A `URL`.                                                                                                       |
| `brumate/search-params` | `new URLSearchParams(text)` | `URLSearchParams`.                                                                                             |
| `brumate/upload`        | Not in the page             | A file in the arguments of a server function call. See [Server function protocol](./server-protocol.md).       |

### Attributes of records

| Attribute     | On                                             | Meaning                                                                                                |
| ------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `nonce`       | Every record, with the `nonce` option          | The Content Security Policy nonce of the render.                                                       |
| `data-state`  | Every record                                   | The script is a state record.                                                                          |
| `data-scopes` | Records with scopes                            | The record adds scopes.                                                                                |
| `data-next`   | Every record with scopes                       | A number above every scope and boundary ID of the render.                                              |
| `data-route`  | The first record of a page from routes         | The key of the root route.                                                                             |
| `data-root`   | Every record of a render with a `base` above 0 | The base. The core keeps a `refs` map for each root.                                                   |
| `data-offset` | Records that the client moved                  | The number the client added to the IDs in the markup. The core adds it to the scope IDs in the record. |
| `data-drop`   | Set by the client on navigation                | The route scopes that the new page replaces. The core drops them and the scopes inside them.           |
| `data-roots`  | Set by the client on navigation                | The route scopes of the new page. The core adds only them and the scopes inside them.                  |
| `data-alias`  | Set by the client on navigation                | Pairs `<new>:<kept>`: layout scopes of the new page that stand for layouts the client keeps.           |

## Props

A child component stores its props in its own slots. When a parent passes a value that can change, the parent records the child's scope ID in `c`, at the anchor index of the component. The parent's update code then writes the new value into the child's slot.

## Navigation

When the loader loads another page, it keeps the layouts that are the same on both pages.

1. The request sends `x-brumate-base`, a number above every ID in the current page: the largest `data-next`.
2. The server renders the page with that base, so its IDs never mix with the current page's. Its records carry `data-root` with the base.
3. The client compares the route slots of the two pages. A slot whose route key is the same keeps its content. A slot whose key changed is replaced with the new content.
4. The client marks the state record with `data-drop`, `data-roots` and `data-alias`, and the core adds only the new routes' scopes. New routes read contexts from the kept layouts through the aliases.
5. The client makes a copy of each state script with the nonce of the loaded page, so the browser runs it. A page parsed with `DOMParser` does not run its scripts. The core reads the records when it starts again.

The client keeps the layouts only when the root route of both pages is the same, and the new page started its IDs at the requested base.

### Pages that ignore the base

A prerendered file on a static host starts its IDs at 0, whatever the request asks. Before it reads such a page, the client moves its IDs up by the difference:

- In the markup: `data-b`, `data-v`, `data-result`, `data-l`, `data-h`, and the `t`, `b`, `i`, `l`, `P` and `R` comments.
- In the swap scripts: the numbers of `$bS(…)` and `$bH(…)`.
- In `data-next` and `data-root`.
- In the state: each record with scopes gets `data-offset`, and the core moves the scope IDs, the parent and child IDs, and the element and function references in its value. The code of the record does not change. Promises in it are moved when they settle.

Markup that streams in later is moved the same way. IDs that `$id()` made are text, and are not moved.
