# Page format

The server writes markers into the HTML and the state into scripts. The core reads both to resume the page. This page describes that contract, for contributors and for tools that read brumate pages.

The attributes that brumate writes start with `b-`, like the `s-<hash>` attribute of scoped styles. The compiler rejects an element attribute that starts with `b-`. `data-prefetch` keeps its name, because you can also write it on a link.

## Scope IDs

Every scope that client code needs gets an ID at render time. The server gives IDs in order, from the `base` of the render, which is 0 for a normal page. Scopes that the client creates get negative IDs, so they never match IDs that the server sends later.

Some bodies have IDs of their own, numbered from 0 after an ID and a dot. The scopes inside them, and the blocks and boundaries inside them, take their IDs from there:

- A `#loading` or `#defer` body, after the ID of its boundary: the scopes of boundary `5` are `5.0`, `5.1` and so on. A body resumes when its data arrives, so its IDs, and the IDs of the rest of the page, do not depend on that order.
- The bodies of `#if`, `#switch`, `#for`, `#repeat`, `#try` and `#offscreen`, after an ID that the block takes from the counter of boundaries. The markup after the block keeps its IDs whichever branch rendered and however many items the list had, so a request for a `#defer` body numbers the page the same way for another user.
- These nest: a `#for` inside boundary `5` that takes ID 2 numbers its items `5.2.0` and on.

In the state, an ID with a dot is a string, and other IDs are numbers.

- A component instance always gets an ID.
- A body scope gets an ID when it has slots or anchors, or when it is an item of a `#for` or `#repeat` whose list can change.
- A `#template` call gets an ID when its body has slots or anchors.

`#loading` bodies get boundary IDs from a second counter, which also starts at the base. A boundary inside a `#loading` body gets an ID with a dot, from that body's counter.

## Anchors

An anchor is a node that client code must find. Each anchor has an index within its scope, and is written as `<scope>:<index>`.

### Elements

```html
<button b-b="0:2" b-on="click=Counter_24o7ge#h4">+</button>
```

- `b-b` is the anchor.
- An element whose only client code is its handlers has no `b-b` when an element around it in the same scope has one. The core finds the scope of its handlers with `closest('[b-b]')`. The compiler does this only when that element is one the browser keeps whole, so not a `<p>`, a heading, a table section or a `<select>`.
- `b-on` lists the event handlers, separated by spaces. Each entry is `<event>[:<modifier>…]=<reference>`.
- `data-prefetch` is the `prefetch` strategy, when it is set.
- `b-v="<scope>"` marks a top-level element of a component whose style variables can change.

A reference is `<component ID>#<export name>`. The component ID is the component name and a hash of its path relative to the root. Handlers export as `h<n>`, and `$client` callbacks as `c<n>`.

### Text

```html
<!--t0:3-->1<!--/t-->
```

The value of a live insert is between the two comments.

When the insert is the whole content of an element, the element gets the anchor instead, and the value is its children:

```html
<span b-b="1:1">One</span>
```

A `<textarea>` or a `<title>` has no comments, because their content is text, where a comment would be text too:

- A value that changes must be the whole content, such as ``<title>{`Count ${count}`}</title>``. The element gets the anchor, and the client sets its text. The compiler reports a value that changes next to other content.
- A value that does not change renders as text, next to other text.
- The client also sets the `value` of a `<textarea>`, as it does for `value` on an `<input>`. A change replaces what the user typed.

### Blocks

```html
<!--b0:4:1--><p>B</p><!--/b-->
```

- The third number is the index of the branch that rendered, for `#if` and `#switch`. It is `-1` when no branch rendered.
- For `#offscreen`, the third number is `1` when the body shows, `0` when it is hidden, and `-1` when it has not rendered yet. The server writes only `1` and `-1`, because it renders a hidden body the first time it shows.
- `#for`, `#repeat`, `#key`, `#try`, `#loading` and `#client` blocks have no third number.
- A `#client` block holds its `#else` body, or nothing. The client renders the body in its place when its trigger fires, and adds `:1` to the start marker.

### Items

```html
<!--b0:2--><!--i1--><li>…</li><!--/i--><!--i2--><li>…</li><!--/i--><!--/b-->
```

Each item of a live `#for` or `#repeat` is between `<!--i<scope>-->` and `<!--/i-->`. The number is the item's scope ID.

When the body of the item is one element and nothing else, the element's `b-b` marks the item instead. The element always gets an anchor, and its scope is the item's scope:

```html
<!--b0:2--><li b-b="1:0">…</li><li b-b="2:0">…</li><!--/b-->
```

The core tells these elements from the elements of the fallback by their scopes. An item scope's parent is the scope of the list, and its kind is not one of the fallback's. A `<p>`, a heading, a table section, or a `<tr>` with content other than cells keeps the comments, because the browser can end it early and split the item.

### `#loading`

```html
<!--l0--><p>Loading…</p><!--/l-->
```

The server writes the fallback between `<!--l<id>-->` and `<!--/l-->`, where the number is the boundary ID, and renders the body after the rest of the page. When the body is ready, the stream sends:

```html
<template b-l="0"><blockquote>…</blockquote></template>
<script>$bS(0)</script>
<script b-state b-scopes b-next="5">$bR(($R,$b)=>(…))</script>
```

- The `<template>` holds the body.
- The script moves the body in, in place of the fallback and the markers. The first swap script of a page also defines `$bS`. An ID with a dot is a string, as in `$bS("5.0")`.
- The state record holds the scopes of the body. It comes after the swap, so the markup of its scopes is in the page when the core reads it.

If the body fails, the fallback stays.

The body renders with the values of the server. If a value changed in the browser before the body arrived, the core runs the updates of the body's scopes once, so the body shows the current values. Effects do not run.

A `#loading` body that sets the head after the first render also sends `<template b-h="<id>">` with its head markup. `$bH(id, title)` moves it into the head and sets the title.

### `#defer`

```html
<template b-b="0:1" b-defer="visible:2:0"></template><!--l2--><p>Loading…</p><!--/l-->
```

- `b-defer` is `<trigger>:<boundary>:<base>`. The base is the base of the render, which the server needs to number the page the same way again.
- `b-b` is the anchor of the block, in the scope that holds it.
- The fallback is between the markers of a `#loading` boundary.

When the trigger fires, the browser asks for the URL of the page with two headers:

```
x-brumate-defer: 2 0:1
x-brumate-base: 0
```

The server renders the route again with that base, and the `#loading` and `#defer` bodies whose IDs the boundary's ID starts with, such as boundary `0` for `0.0`. It answers with the markup that it streams for a `#loading` body, with the header `x-brumate-defer: 2`. The browser adds it to the page and runs its scripts with the page's nonce. Its state records have `b-root="d<boundary>"`, so their references are apart from the page's. The answer is 409 when the render puts boundary 2 at another anchor, and 404 when it has no such boundary.

### `#portal`

```html
<!--P4--><dialog open>Saved</dialog><!--/P-->
```

The content of a portal is between `<!--P<scope>-->` and `<!--/P-->`, where the number is the scope ID of the portal's body. The server writes it after the rest of the page. When the scope is removed, the client removes the content by its markers. A portal into a target has a `<template b-client="load=…">` in its place, and the client renders it into the target.

### Listeners and `$client` callbacks

```html
<template b-b="0:1" b-listen="window" b-on="keydown=Blocks_jlmev2#h6"></template>
<template b-b="0:0" b-client="idle=Blocks_jlmev2#c4"></template>
```

- `b-listen` is `window` or `document`. The loader adds these listeners when the page loads.
- `b-client` is `<trigger>=<reference>`. For `visible`, the loader observes the next element sibling.
- A `#client` block has the same `<template>` before its markers. Its reference is `k<n>`, which renders the block.

### Route slots

```html
<!--R0:children:3:%2Ftodos%2F%5Bid%5D%20%7B%22id%22%3A%223%22%7D--><article>…</article><!--/R-->
```

Each slot of a layout that a route renders into is marked with `<!--R<layout scope>:<name>:<route scope>:<route key>-->` and `<!--/R-->`.

- The layout scope is `-1` when the slot is not inside a scope.
- The route key is the file and the params of the route, encoded with `encodeURIComponent`, such as `/todos/[id] {"id":"3"}`. Two pages with the same key for a layout render the same layout.

### Styles

The stylesheet of a component is `<style b-style="<component ID>">`, once per page, before the first instance of the component. See [Style compilation](./style-compilation.md).

## State

```html
<script b-state b-scopes b-next="5" b-route="…">function $bR(f){…}$bR(($R,$b)=>(($R[0]={0:$R[1]={k:1,m:"App_x1",s:$R[2]=[1]}})))</script>
<script b-state>$bR(($R,$b)=>(…))</script>
```

The state is a stream of [seroval](https://github.com/lxsmnsyc/seroval) cross-reference records, one inline script each. The server writes them with `crossSerializeStream`. Each record is a function of `$R`, the references of its render, and `$b`, the functions that make brumate's values.

- The first record of a render defines `$bR`. `$bR` pushes the script and the function to the array `self.$brm`.
- The core calls the functions in order when it starts, with one `$R` array per render, so later records can refer to values of earlier ones. Records that run after the core started are read at once.
- A page that never gets an event never builds its state. The records wait in `self.$brm`.
- A record whose script is no longer in the page when the core starts is skipped, such as a record of a page that navigation replaced.
- A record with `b-scopes` holds scopes: the page state, or the state of a `#loading` body.
- The first record of a page has `b-build`, the ID of the build that rendered it, when the server knows it. The browser sends it with calls, and client navigation loads a page of another build in full. See [Skew protection](./deploying.md#skew-protection).
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
// The same items when their list is slot 0 of scope 0. Each one is only its gap.
g: [[2, 0, 33, 1, 0, 0, 1, 1, 1]]
```

- A group is `[kind, base, flags, slotCount, module?, source?, sourceSlot?, prefix?, ...scopes]`.
- Each scope is the gap from the ID before it, then its slots, then its item and its child components when the flags say so. The first gap is from `base`.
- `base` is the parent, `p`, of every scope of the group. For the root scopes of components, flag 8, it is the distance from the scope that rendered each one, `o`, to its ID, and the first gap is from 0.
- The flags are 1 when the item is the first slot, 2 when the item comes after the slots, 4 when the child components `c` come after that, 8 for component root scopes, 16 when `module` is in the header, 32 when the items are not written, and 64 when the scopes are inside a `#loading` body.
- With flag 64, `prefix` is the part of their IDs up to the last dot, such as `5.`. The gaps count the number after it, and the first gap is from 0.
- With flag 32, `source` and `sourceSlot` name the scope and the slot that hold the list. The item of the scope at position `n` in the group is the value at `n` of that list, or of `Array.from` of a Set. With flag 1, each scope writes its slots after the first, and the core sets the first slot to the item. `slotCount` still counts the first slot.
- The server uses flag 32 for a `#for` whose list is a signal, memo or prop of a scope around it, when that scope's record is in the same state record and each item is the value at its position in the list. Otherwise it writes the items.
- A group holds the fields `k`, `p`, `o`, `m`, `s`, `i` and `c`. A record with other fields, a record without a parent or an owner, and the only record of its shape keep their own object.
- The core turns the groups back into one record per scope, and sets the items of flag 32 groups, before it moves IDs or adds scopes.

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

| Attribute  | On                                             | Meaning                                                                                                |
| ---------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `nonce`    | Every record, with the `nonce` option          | The Content Security Policy nonce of the render.                                                       |
| `b-state`  | Every record                                   | The script is a state record.                                                                          |
| `b-scopes` | Records with scopes                            | The record adds scopes.                                                                                |
| `b-next`   | Every record with scopes                       | A number above every scope and boundary ID of the render.                                              |
| `b-route`  | The first record of a page from routes         | The key of the root route.                                                                             |
| `b-root`   | Every record of a render with a `base` above 0 | The base, or `d<boundary>` for a `#defer` body. The core keeps a `refs` map for each root.             |
| `b-offset` | Records that the client moved                  | The number the client added to the IDs in the markup. The core adds it to the scope IDs in the record. |
| `b-drop`   | Set by the client on navigation                | The route scopes that the new page replaces. The core drops them and the scopes inside them.           |
| `b-roots`  | Set by the client on navigation                | The route scopes of the new page. The core adds only them and the scopes inside them.                  |
| `b-alias`  | Set by the client on navigation                | Pairs `<new>:<kept>`: layout scopes of the new page that stand for layouts the client keeps.           |

## Props

A child component stores its props in its own slots. When a parent passes a value that can change, the parent records the child's scope ID in `c`, at the anchor index of the component. The parent's update code then writes the new value into the child's slot.

## Navigation

When the loader loads another page, it keeps the layouts that are the same on both pages.

1. The request sends `x-brumate-base`, a number above every ID in the current page: the largest `b-next`.
2. The server renders the page with that base, so its IDs never mix with the current page's. Its records carry `b-root` with the base.
3. The client compares the route slots of the two pages. A slot whose route key is the same keeps its content. A slot whose key changed is replaced with the new content.
4. The client marks the state record with `b-drop`, `b-roots` and `b-alias`, and the core adds only the new routes' scopes. New routes read contexts from the kept layouts through the aliases.
5. The client makes a copy of each state script with the nonce of the loaded page, so the browser runs it. A page parsed with `DOMParser` does not run its scripts. The core reads the records when it starts again.

The client keeps the layouts only when the root route of both pages is the same, and the new page started its IDs at the requested base.

### Pages that ignore the base

A prerendered file on a static host starts its IDs at 0, whatever the request asks. Before it reads such a page, the client moves its IDs up by the difference:

- In the markup: `b-b`, `b-v`, `b-result`, `b-l`, `b-h`, and the `t`, `b`, `i`, `l`, `P` and `R` comments. An ID with a dot moves its first number, so `1.0` becomes `3.0`.
- In the swap scripts: the numbers of `$bS(…)` and `$bH(…)`.
- In `b-next` and `b-root`.
- In the state: each record with scopes gets `b-offset`, and the core moves the scope IDs, the parent and child IDs, and the element and function references in its value. The code of the record does not change. Promises in it are moved when they settle.

Markup that streams in later is moved the same way. IDs that `$id()` made are text, and are not moved.
