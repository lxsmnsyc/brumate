# Proposals

Features that would be good to add, with the reason for each, a sketch, and a rough cost. None of them is decided. [Decisions](./decisions.md) lists what is.

## Summary

| Proposal                                                              | Area    | Value  | Cost   |
| --------------------------------------------------------------------- | ------- | ------ | ------ |
| [Two-way binding](#two-way-binding)                                   | Syntax  | Medium | Small  |
| [Content mappers for TypeScript 7](#content-mappers-for-typescript-7) | Tooling | High   | Medium |
| [Deployment adapters](#deployment-adapters)                           | Build   | Medium | Medium |
| [Headless UI components](#headless-ui-components)                     | Library | High   | Large  |
| [Progressive forms](#progressive-forms)                               | Library | High   | Medium |
| [Markdown with components](#markdown-with-components)                 | Library | Medium | Medium |
| [Compiled messages for i18n](#compiled-messages-for-i18n)             | Library | Medium | Small  |

## Syntax

### Two-way binding

Fields repeat the same pair of attributes:

```html
<input value=draft onInput=((event) => (draft = event.currentTarget.value))>
```

A `bind:` attribute writes it once:

```html
<input bind:value=draft>
<input type="checkbox" bind:checked=done>
<select bind:value=choice>…</select>
```

- `bind:value` and `bind:checked` compile to the attribute and the handler above. The handler is a client root like any other, so it loads on the first input.
- The target must be a signal, so the compiler checks the write.

## Tooling

### Content mappers for TypeScript 7

TypeScript 7 does not load plugins, so `.brm` files get types only from TypeScript 6 and older, through `@brumate/tsc` and `@brumate/typescript-plugin`. TypeScript 7.1 adds an API for content mappers, which turn the files of other languages into TypeScript and map positions between them.

- A content mapper from `toTypeScript` would let `tsc` and the editor of TypeScript 7 check `.brm` files.
- It would replace `@brumate/tsc`, and the TypeScript plugin in the extension.
- This waits for the API to be stable, and for its documentation.

## Build

### Deployment adapters

The server runtime uses only web APIs, and Nitro builds for each host. See `examples/nitro`.

- Nitro covers Node, Deno, Bun, Cloudflare Workers and others. Only its Node preset is tested.

## Library

### Headless UI components

A package of accessible, unstyled components, `@brumate/ui`. It takes its behaviour and its way of composing parts from [React Aria Components](https://react-spectrum.adobe.com/react-aria/components.html), and its API features from [Terracotta](https://github.com/lxsmnsyc/terracotta). It is written in brumate. No React code runs.

#### What it takes from each

From React Aria Components:

- The behaviour: press handling, focus and keyboard rules, typeahead, selection in collections, overlay dismissal, and the WAI-ARIA patterns. React Aria's tests and docs are the specification. Its code is Apache-2.0, so ported parts keep its notice.
- Composition from generic parts. A `Select` is not one closed component. It is built from the same `Label`, `Button`, `Popover` and `ListBox` that work on their own:

  ```html
  <Select>
    <Label>Animal</Label>
    <Button><SelectValue /></Button>
    <Popover>
      <ListBox items=animals item=animal />
    </Popover>
  </Select>
  ```

  `Select` provides a context for each part type. Each generic part reads its context, if there is one, and merges it with its own props. Handlers are chained, and the part's own props win. A `slot` prop picks between several parts of one type, as in `<Button slot="increment">`.

From Terracotta:

- An `as` prop on every part, so it can render another element or component. It compiles to a dynamic tag, `<{as ?? 'button'} …>`.
- Render props, so the caller's markup can read the state of a part. A part calls a `#template` prop with its state, such as `{content({ open, close })}`.
- State as `data-*` attributes, such as `data-open` and `data-selected`, for styling with CSS or class objects.

#### How it maps to brumate

| React Aria Components or Terracotta | brumate                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Context provider in `Select`        | `$setContext(POPOVER, { … })` in `Select.brm`                                                                             |
| `useContextProps` in a part         | `$getContext(POPOVER)` merged with the part's props                                                                       |
| `slot` prop                         | A context value keyed by slot, read as `ctx[slot]`                                                                        |
| `triggerRef` for positioning        | CSS anchor positioning: `anchor-name` on the trigger and `position-anchor` on the popover. It needs no ref and no script. |
| Behaviour hooks                     | Functions in a `.brm.ts` module that the parts share                                                                      |
| Children as a render function       | A named `#template` prop, because `children` is markup that the server renders                                            |
| Collections from JSX children       | An `items` prop and an item `#template`, because brumate cannot read the structure of markup                              |
| Global listeners at startup         | CSS `:focus-visible` in place of focus-visible tracking. Listeners for a click outside are added when an overlay opens.   |
| `@internationalized/date`, `number` | Used as they are                                                                                                          |

Native features cover parts of the behaviour with no script: `<dialog>` with `showModal()`, the Popover API, `commandfor` and `command` on buttons, and CSS anchor positioning.

#### What the compiler needs first

1. Conditional `preventDefault`. Handlers run after their code loads, so `event.preventDefault()` in a handler is too late, and `:prevent` applies to every event of its type. Arrow keys in a list, and Enter in a combobox, need a modifier that the loader applies by key, such as `onKeyDown:prevent(ArrowDown ArrowUp Enter Escape)`, or handlers that run at once when their code is loaded.
2. Handlers in spreads. `spread()` and `attrs()` drop `on*` keys, so a part cannot put merged handlers on its element, and a wrapper cannot forward `onClick` through `...rest`. `attrs()` also keeps keys that are gone from the new object.
3. Components from packages. The Vite plugin finds `.brm` files only under the app root and skips `node_modules`, and component IDs come from the path under the root. A published package needs discovery from dependencies, and IDs that include the package name.

#### Questions to answer with a spike

Build `Select` from `Label`, `Button`, `SelectValue`, `Popover` and `ListBox` with context composition, slots, `as` and render props. It answers:

- Do parts that the caller passes as `children` read the contexts of `Select`? Children are rendered in the caller's scope and placed inside `Select`.
- What does `$getContext` return when no provider is above a part?
- Does markup that a `#template` prop rendered update when the state that the part passed to it changes?
- Can the `as` element get the part's handlers, ARIA attributes and focus, when `as` names a component?

#### Plan

1. The spike above, as a test fixture or a page in `examples/`.
2. The compiler work that the spike and the list above call for, each with tests.
3. `packages/ui` in this repository, while the page format, IDs and spread rules still change. It moves to its own repository after 1.0 if its release pace differs from the compiler's. The first parts are `Button`, `Label`, `Disclosure`, `Dialog`, `Popover`, `Tabs`, `Menu` and `Tooltip`, then `ListBox`, `Select` and `ComboBox`.
4. `examples/ui`, a page of every part, covered by `pnpm e2e` with an accessibility check such as axe-core.
5. Docs in `website/docs/ui`, with live samples.

Cost: about 2 weeks for the compiler work, and a few months for the parts with their keyboard and focus details and tests. `Select` and `ComboBox` take the most time.

Not planned: running React Aria, Radix or Headless UI, which need React; an adapter for Zag.js state machines, whose state does not resume and which costs 14 to 27 kB gzip per widget; and wrappers for TanStack Query or TanStack Form, which overlap with `$memo`, `refresh`, `$action` and `parseForm`.

### Progressive forms

A form library that takes its API and behaviour from [Conform](https://conform.guide), which is built for forms that work without scripts in Remix and Next.js. brumate forms already work that way, with `action=fn`, `parseForm` and `$action`. This adds the layer on top. It is written in brumate. No React code runs.

#### What it fixes

- Lists of objects. `parseForm` makes `items.0.name` an object keyed `"0"`, so a form cannot post a list of objects. Conform names nested objects and arrays, and its intent buttons add, remove and reorder list items. Without scripts, an intent is a post that the server answers.
- Values after a failed post. Without scripts, the page must send back what was typed, or the fields come back empty. Conform returns a submission with the last values and the errors of each field, and the fields read their defaults from it.
- Form-level errors. They are under `errors['']` today. Conform keeps them apart from the errors of fields.
- Accessibility. Each field gets its `id`, `name`, `aria-invalid`, `aria-describedby` and the id of its error from a helper, not by hand. The [headless UI components](#headless-ui-components) can use the same helpers.
- One schema for both sides. With scripts, fields validate on blur or input with the same Standard Schema as the server, and with the browser's constraint validation. Without scripts, the server validates as before.

All of this state is data: values, errors and the intent. It goes into the page state and resumes, and nothing needs to run when the page loads.

#### Sketch

```ts
// A server function
import { parseSubmission } from 'brumate/forms';

async function save(form: FormData) {
  'use server';
  const submission = await parseSubmission(form, Order);
  if (submission.status !== 'success') {
    return submission.reply();
  }
  await db.orders.save(submission.value);
}
```

```html
<script>
  import { $action } from 'brumate/signals';
  import { formFields } from 'brumate/forms';

  const result = $action(save);
  const { form, field, list } = formFields(result, Order);
</script>

<form action=save {...form.attrs}>
  <input {...field('email').attrs}>
  #if (field('email').errors) { <p {...field('email').errorAttrs}>{field('email').errors[0]}</p> }
  #for (item, index of list('items')) {
    <input {...field(`items.${index}.name`).attrs}>
    <button {...list('items').remove(index)}>Remove</button>
  }
  <button {...list('items').insert()}>Add an item</button>
</form>
```

#### What it needs

- `parseSubmission` on the server, which replaces `parseForm` for forms with lists and intents.
- `formFields` in a `.brm.ts` module, which returns the attributes, errors and intent buttons of each field.
- Handlers in spreads, from [Headless UI components](#headless-ui-components), so `field(...).attrs` can bring its own `onBlur` and `onInput` for validation in the browser. Without it, the first version validates only on the server.

Cost: about 1 to 2 weeks for nested and array fields, intents, the field helpers, validation in the browser, tests and docs.

### Markdown with components

Markdown pages that can use brumate components and expressions, as mdsvex does for Svelte and MDX does for React. Content sites are mostly static, which is where resuming pays off most: a docs page ships no code unless a component on it has handlers.

- A `.md` page compiles to a `.brm` component. Front matter becomes its props or page metadata. Fenced code is highlighted at build time.
- The website already has a markdown plugin and live samples. They would become a general plugin that apps can use.

Cost: about 1 to 2 weeks, most of it for the parser integration, source maps and editor support.

### Compiled messages for i18n

[Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) compiles each translated message to its own function, so a page ships only the messages it uses. That matches how brumate ships only the code an event needs.

- Paraglide works with any framework, so this is a guide and a small adapter, not a port: the locale of a request on the server, the same locale on the client, and links that keep it.
- Messages that the server renders cost no client code. Only messages in client code, such as a handler that shows a toast, ship.

Cost: a few days for the adapter, a guide and an example.

### Order

1. [Headless UI components](#headless-ui-components) and [progressive forms](#progressive-forms) share the compiler work: handlers in spreads, conditional `preventDefault`, and components from packages. Do that work first.
2. Progressive forms next, because they are smaller and every app has forms.
3. Then the UI components, starting with the `Select` spike.
4. Compiled messages and Markdown with components when an app or the website needs them.
