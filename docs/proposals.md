# Proposals

Features that would be good to add, with the reason for each, a sketch, and a rough cost. None of them is decided. [Decisions](./decisions.md) lists what is.

## Summary

| Proposal                                                              | Area    | Value  | Cost   |
| --------------------------------------------------------------------- | ------- | ------ | ------ |
| [Two-way binding](#two-way-binding)                                   | Syntax  | Medium | Small  |
| [Blocking async memos](#blocking-async-memos)                         | Data    | Medium | Small  |
| [Errors in client code](#errors-in-client-code)                       | Runtime | High   | Medium |
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

## Data

### Blocking async memos

The server awaits an async memo where it is declared only when markup outside every `#loading` body reads it. A memo that only client code reads, such as a handler, goes into the page state as a promise. The page sends it pending, and a later state record settles it:

```html
<script>
  import { $memo } from 'brumate/signals';
  import { listTags } from './tags.server';

  // Only the handler reads it, so the page sends a promise.
  const tags = $memo(listTags());
</script>

<button onClick=(() => console.log(tags))>Log tags</button>
```

A blocking memo makes the server wait for the value before it sends the state:

```html
const tags = $memo(listTags(), { wait: true });
```

- The state record holds the value, so the page needs no later record for it, and the client never sees it pending.
- A page with no other promise and no `#loading` body then has one state record. It gets the smaller state that assigns only shared references.
- The first byte comes later by the time of the load. That is the trade-off, so it is opt-in.
- A blocking memo inside a `#loading` body waits for the body, not the page.
- The option is a literal object, so the compiler reads it. `$memo` takes one argument today, so this adds a second.

Other names to weigh: `$memo.wait(value)` or a separate `$await(value)`.

Cost: a few days. The server already awaits blocking memos where markup reads them. This adds the option to the analyzer and to `blockingMemos`, with tests and docs.

## Runtime

### Errors in client code

A `#try` catches an error while its body renders, on the server or on the client. An error in code that runs later in the browser does not reach it. A handler that throws leaves an unhandled rejection, and an async memo that fails logs the error and becomes `undefined`.

Errors in client code would go to the component that owns the code:

- Event handlers, `$effect` and `$client` callbacks, the functions that they call, and the loads of async memos.
- The error goes to the nearest `#try` around the scope that the code belongs to, through the parents and the owners of scopes, as contexts are found. That `#try` renders its `#catch` body in the browser, with the error and `reset`.
- Without a `#try` around it, the core dispatches a `brumate:error` event on `window` with the error and the scope, and logs it. An app can report it from there.
- A loader option, `onError(error, info)`, receives every error first, such as for a reporting service.

What it needs:

- The client render code of each `#catch` body that client code inside its `#try` can reach. Today a `#catch` body ships only when its `#try` can fail while it renders on the client. Every `#try` with a handler inside would ship its `#catch` body.
- A `#try` that catches from client code needs a marker in the page even when its body never renders on the client.
- Async handlers: the error of the promise that a handler returns counts too.
- `reset()` renders the `#try` body again, as it does now.

Cost: about 1 to 2 weeks. The scope tree and the `#try` swap exist. Most of the work is deciding which `#catch` bodies ship, and testing the order of errors and cleanups.

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
3. `packages/ui` in this repository, while the page format, IDs and spread rules still change. It moves to its own repository after 1.0 if its release pace differs from the compiler's. The parts follow the [roadmap](#roadmap).
4. `examples/ui`, a page of every part, covered by `pnpm e2e` with an accessibility check such as axe-core.
5. Docs in `website/docs/ui`, with live samples.

Cost: about 2 weeks for the compiler work, then the phases of the roadmap below.

#### Roadmap

The parts come from `react-aria-components` 1.22.1 (2026-10-09). Each phase ships when its parts have tests that follow React Aria's behaviour, an accessibility check, docs and live samples. A phase builds on the ones before it.

| Phase                      | Parts                                                                                                                                                                                                                                                                                                | Needs                                                                                              | Cost                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 0. Foundations             | Press, focus and hover handling (`Pressable`, `Focusable`), `VisuallyHidden`, `Keyboard`, `I18nProvider` (locale and direction), context composition with `slot`, `as`, render props and `data-*` state                                                                                              | The `Select` spike, conditional `preventDefault`, handlers in spreads                              | 3 to 4 weeks, with the compiler work |
| 1. Controls and fields     | `Button`, `ToggleButton`, `ToggleButtonGroup`, `Link`, `Label`, `Text`, `Input`, `TextArea`, `TextField`, `SearchField`, `Checkbox`, `CheckboxGroup`, `RadioGroup`, `Switch`, `FieldError`, `Form`, `Group`, `Separator`, `Heading`, `Toolbar`, `Breadcrumbs`, `Meter`, `ProgressBar`, `FileTrigger` | Phase 0. `Form` and `FieldError` use [progressive forms](#progressive-forms).                      | 3 to 4 weeks                         |
| 2. Disclosure and overlays | `Disclosure`, `DisclosureGroup`, `Popover`, `OverlayArrow`, `Dialog`, `Modal`, `Sheet`, `Tooltip`, `PreviewTrigger`, `Toast`, and `Transition` from Terracotta                                                                                                                                       | Phase 1. `<dialog>`, the Popover API, `commandfor` and CSS anchor positioning do most of the work. | 4 to 5 weeks                         |
| 3. Collections             | The collection model (keys, sections with `Header`, disabled keys, single and multiple selection, typeahead, focus within a list), `ListBox`, `Menu` with submenus, `Select`, `ComboBox`, `Autocomplete`, `Tabs`, `TagGroup`, `GridList`, `SelectionIndicator`                                       | Phase 2 for the popovers of menus and selects                                                      | 6 to 8 weeks                         |
| 4. Numbers                 | `NumberField`, `Slider` with several thumbs                                                                                                                                                                                                                                                          | Phase 1, and `@internationalized/number`                                                           | 2 weeks                              |
| 5. Dates and times         | `Calendar`, `RangeCalendar`, `DateField`, `TimeField`, `DatePicker`, `DateRangePicker`                                                                                                                                                                                                               | Phases 2 and 3, and `@internationalized/date`                                                      | 4 to 6 weeks                         |
| 6. Data                    | `Table` with sorting, selection and column resizing, `Tree`, `NavigationTree`, `TokenField`, `Virtualizer`, drag and drop with `DropZone`, and list and tree data helpers                                                                                                                            | Phase 3                                                                                            | 6 to 8 weeks                         |
| 7. Color                   | `ColorPicker`, `ColorArea`, `ColorSlider`, `ColorWheel`, `ColorThumb`, `ColorField`, `ColorSwatch`, `ColorSwatchPicker`                                                                                                                                                                              | Phases 1 and 4                                                                                     | 3 to 4 weeks                         |

Notes for each phase:

- Phase 0 is most of the risk. It settles how a part merges its context with its props, how state reaches the caller's markup, and how `as` passes handlers and focus to a component. Every later part depends on it.
- Phase 1 parts are mostly markup and attributes, and many need no client code until they are used. A `Checkbox` is a native `<input type="checkbox">` with labels and states.
- Phase 2 uses the platform where it can. `Modal` and `Sheet` are `<dialog>` with `showModal()`. `Popover` and `Tooltip` use the Popover API and anchor positioning, so they need no positioning code. A click outside closes them through `popover="auto"`, or a listener that is added when they open.
- Phase 2 animates in two ways:
  - Overlays animate as they open and close with CSS alone. `<dialog>` and popovers are hidden, not removed, so `@starting-style` and `transition-behavior: allow-discrete` on `display` and `overlay` cover both directions.
  - `Transition` animates content that is removed, such as an `#if` body or a toast, which CSS cannot do because the node is gone. It follows [Terracotta](https://github.com/lxsmnsyc/terracotta)'s `Transition`: it keeps the content until its leave transition ends, then removes it. It takes Terracotta's `enter`, `enterFrom`, `enterTo`, `leave`, `leaveFrom` and `leaveTo` class props, and sets `data-closed`, `data-enter` and `data-leave` for CSS without class lists, as Headless UI does. It needs no compiler or runtime change: a signal of its own keeps the content mounted, and an `#if` removes it after `transitionend` or `animationend`, with a timeout when neither fires. The server renders the content as `show` says, with no animation on load. `prefers-reduced-motion` skips the wait. Nested `TransitionChild` coordination, and leave animations for `#for` items, which need a hook in the list code of the runtime, come later.
- Phase 3 is the largest. Collections take `items` and an item `#template`, because brumate cannot read the structure of markup the way React Aria reads its children. Keyboard movement and typeahead go in a `.brm.ts` module that every collection shares. `Select` and `ComboBox` keep a native `<select>` or `<input>` where they can, so forms post without scripts.
- Phase 4 parses and formats numbers by locale on the server and in the browser with the same code.
- Phase 5 keeps dates in signals as ISO strings, because the page state cannot hold `CalendarDate` class instances.
- Phase 6 renders rows on the server. `Virtualizer` and drag and drop run only in the browser, from `$client` and handlers, so they load when used.
- Phase 7 is the least common need, so it comes last.

Not ported:

- `SharedElementTransition`, because view transitions cover it.
- `CollectionBuilder` and the other internals, because brumate builds collections from `items` and templates.
- `RouterProvider`, because brumate's links already navigate on the client.

Order of value: phases 0 to 3 cover most of what apps use, in about 4 to 5 months. Phases 4 to 7 can follow what users ask for.

Not planned: running React Aria, Radix or Headless UI, which need React; an adapter for Zag.js state machines, whose state does not resume and which costs 14 to 27 kB gzip per widget; and wrappers for TanStack Query or TanStack Form, which overlap with `$memo`, `refresh`, `$action` and `parseForm`.

### Progressive forms

A form library for brumate, `brumate/forms`. Its server side and wire format follow [Conform](https://conform.guide), which builds forms that work without scripts in Remix and Next.js. Its component API follows [Formisch](https://formisch.dev), which types field paths from the schema and keeps form state in signals. It is written in brumate. No React code runs.

brumate forms already post without scripts, with `action=fn`, `parseForm` and `$action`. This adds lists, echoed values, form-level errors, accessibility attributes and validation in the browser on top.

#### Libraries compared

| Library       | Model                                                        | Without scripts | Lists                                              | Fit                                                         |
| ------------- | ------------------------------------------------------------ | --------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| Conform       | Server first, built on `FormData`                            | Yes, by design  | Path names and intent buttons                      | The protocol to copy. Its API is made for React.            |
| Superforms    | Server first, on SvelteKit form actions                      | Yes             | Yes. Its JSON mode for complex data needs scripts. | Close in spirit, tied to SvelteKit.                         |
| Formisch      | Client first, one small core for many frameworks, on signals | No              | Typed paths from the schema                        | The API to copy. It has no story for forms without scripts. |
| TanStack Form | Client first, with a store, and server validation in Start   | Not built in    | Yes                                                | Heavy, and its store does not resume.                       |

So `brumate/forms` takes the wire format from Conform and the shape of the API from Formisch. Validation uses Standard Schema, as `parse` and `parseForm` do.

#### Wire format

- Field names are paths: `email`, `address.city`, `items[0].name`. `parseForm` learns bracket indexes too, so `items[0].name` makes an array. Its current rules for `a.b`, repeated names and `tags[]` stay.
- An intent is a submit button with a reserved name. A button posts its value only when it is clicked, so intents work without scripts:

  ```html
  <button name="__intent" value='{"type":"remove","name":"items","index":1}' formnovalidate>Remove</button>
  ```

  The types are `insert`, `remove`, `reorder`, `reset` and `validate`.

- The reply is data, so it goes through `$action` and the page state:

  ```ts
  type SubmissionResult = {
    status: 'success' | 'error' | 'intent';
    // The values as posted, after the intent. Files and passwords are left out.
    value: unknown;
    // The errors of each field, by path name.
    errors: Record<string, string[]>;
    // The errors of the whole form. They replace errors[''] of fieldErrors.
    formErrors: string[];
    // Stable keys of list items, for `#for … by`.
    keys: Record<string, string[]>;
  };
  ```

#### Server

```ts
import { parseSubmission } from 'brumate/forms';

async function save(data: FormData) {
  'use server';
  const submission = await parseSubmission(data, Order);
  if (submission.status !== 'success') {
    // An intent, or values that failed the schema: send the values back.
    return submission.reply();
  }
  if (await db.orders.exists(submission.value.id)) {
    return submission.reply({ formErrors: ['That order exists already'] });
  }
  await db.orders.save(submission.value);
  return submission.reply({ reset: true });
}
```

- An intent changes the posted values. It inserts, removes or moves a list item and keeps the keys of the others. It reports no errors on fields that were not touched.
- An intent is input from the browser, so it is checked: its path must exist in the posted values, indexes must be in range, lists have a maximum length, and path parts such as `__proto__` are rejected, as in `parseForm`.

#### Component

`form(schema, result, options)` is a function of a `.brm.ts` module that ships with brumate. Its state is signals, so it resumes like any reactive module.

```html
<script>
  import { $action } from 'brumate/signals';
  import { form as createForm } from 'brumate/forms';

  const result = $action(save);
  const form = createForm(Order, result, { defaultValue: { items: [{ name: '' }] } });
  const items = form.list(['items']);
</script>

<form action=save {...form.attrs} onFocusout=form.blur onInput=form.input onClick=form.intent>
  <button {...form.defaultSubmit}></button>

  <label for=(form.field(['email']).id)>Email</label>
  <input {...form.field(['email']).attrs} type="email" required>
  #if (form.field(['email']).errors) {
    <p {...form.field(['email']).errorAttrs}>{form.field(['email']).errors[0]}</p>
  }

  #for (item of items.items by item.key) {
    <input {...form.field(['items', item.index, 'name']).attrs}>
    <button {...items.remove(item.index)}>Remove</button>
  }
  <button {...items.insert()}>Add an item</button>

  #if (form.errors) {
    <p role="alert">{form.errors[0]}</p>
  }
  <button>Save</button>
</form>
```

- `form.field(path)` takes a path as an array, typed by the output of the schema. A string such as `'items[0].name'` also works. It returns:
  - `attrs`: `name`, `id`, `aria-invalid`, `aria-describedby`, and the echoed `value`, `checked` or `selected`.
  - `errors`, `errorAttrs` (the id of the error, and `role="alert"` after a submit), and the typed default value.
- `form.list(path)` returns the items with their keys and indexes, and `insert()`, `remove(index)` and `reorder(from, to)`, which give the attributes of intent buttons.
- `form.fieldset(path)` gives the same helpers below a path, for a part of the form in its own component.
- `form.errors` holds the errors of the whole form.
- `form.defaultSubmit` is a hidden submit button. Enter in a field submits the first submit button of the form, so without it, Enter could press "Remove".
- Every helper gives plain attributes. No field or button has a handler, so spreads work as they do today.

#### Without scripts

The same markup works in three states:

1. Without scripts, the form posts and the page renders again with the result. The fields show what was typed and their errors. An intent button posts the whole form, and the server applies the intent, so what was typed in other fields stays.
2. With scripts, before the code of the form loads, `$action` sends the form with `fetch`, and the page does not load again.
3. With the code of the form loaded, it validates as fields change and applies intents at once.

What a form without scripts has to handle:

- The constraint attributes of the browser, such as `required` and `type="email"`, still block a submit. Intent buttons have `formnovalidate`, so a list can grow while the form is incomplete.
- A checkbox that is not checked is not posted. The schema must read a missing value as `false`.
- A file input cannot be filled again. After an error, the user picks the file again, and only the error shows.
- Passwords are not echoed.
- Each post loads the page, so focus and scroll start over. A summary of errors should link to its fields, such as `<a href="#email">`.

#### In the browser

- `onFocusout=form.blur` and `onInput=form.input` on the `<form>` see every field, because brumate delegates events. They validate with the same schema and show the errors of fields that were touched, and of every field after a submit, as Conform does.
- `onClick=form.intent` handles clicks on intent buttons. It applies the intent to the values at once and stops the post.
- The schema and the validation code load with the first focus out or input, not with the page, so a form costs nothing until someone uses it.
- `form.intent` must stop the click before it submits the form. Handlers run after their code loads, so this needs `:prevent` on the button, or one of the conditional `preventDefault` options in [Headless UI components](#headless-ui-components). Until then, an intent goes to the server through `$action`, which works, but slower.

#### Plan

1. The wire format and the server: `parseSubmission`, bracket paths in `parseForm`, `reply`, and the field and list helpers with plain attributes. It works without scripts and through `$action`. About 1 week with tests and docs.
2. Validation in the browser through `onFocusout` and `onInput` on the form, loaded when first used. About 3 to 4 days.
3. Intents in the browser, once the click can be stopped. About 2 to 3 days.

It lives at `brumate/forms` while the page format still changes, and can move to its own package later.

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

1. Blocking async memos. They are small, and they make the state of more pages one record.
2. Progressive forms, steps 1 and 2. They need no compiler work, because their helpers give plain attributes and their handlers sit on the `<form>`. Every app has forms.
3. Errors in client code, so a handler that throws shows a `#catch` body instead of failing silently. Forms and the UI components run most of their code in handlers.
4. Conditional `preventDefault` and handlers in spreads. Intents in the browser need the first. The UI components need both. Components from packages are done.
5. Progressive forms, step 3, and the UI components, starting with the `Select` spike.
6. Compiled messages and Markdown with components when an app or the website needs them.
