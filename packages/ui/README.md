# @brumate/ui

Accessible, unstyled components for brumate. They follow the behaviour and the composition of [React Aria Components](https://react-spectrum.adobe.com/react-aria/components.html), and the API of [Terracotta](https://github.com/lxsmnsyc/terracotta). The plan is in [Headless UI components](../../docs/proposals.md#headless-ui-components).

The package is private while its first phase is built.

- The parts render markup, ARIA attributes and `data-*` state, and no CSS of their own, except what a part needs to work, such as the styles that hide the content of `VisuallyHidden`.
- A part uses a feature of the platform only when at least 95% of global usage supports it.
- Each part has a `.stories.ts` file for the workbench of the dev server, at `/__brumate/workbench`.

## Parts

- `Button`: presses with a pointer, Enter, Space or a screen reader. Its state is in `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled` and `data-pending`.
- `FieldError`: the errors of a field, while it is invalid.
- `Form`: a form that tells its fields how to validate, and gives them the errors of the server by name.
- `Group`: parts that belong together, with `data-focus-within`, `data-hovered`, `data-disabled` and `data-invalid`.
- `Heading`: a heading of a level, which a context can set.
- `I18nProvider`: gives the parts inside it a locale and its direction. The default is `en-US`.
- `Input` and `TextArea`: the input of a field, with `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled` and `data-invalid`.
- `Keyboard`: a keyboard shortcut, left to right in every language.
- `Label`: the label of a field, with the `id` and `for` that the field gives.
- `Link`: a link that presses as a button does, with `data-current`. A disabled link has no address.
- `SearchField`: a search input with a button that clears it. Escape clears it, and Enter calls `onSubmit`.
- `Separator`: an `<hr>`, or a vertical separator.
- `Text`: the text of a field, such as its description, with the `id` that the field gives.
- `TextField`: a field of a Label, an Input or a TextArea, a description and a FieldError. The browser checks it on a submit, and `field` takes a field of `createForm`.
- `ToggleButton`: a button that stays pressed, with `aria-pressed` and `data-selected`.
- `VisuallyHidden`: hides its content from sight and keeps it for screen readers.

## Writing a part

A part is a `.brm` component in `src`, with a `.stories.ts` file, a test in `test`, and a section in `examples/ui`. It follows the part of React Aria Components of the same name, and React Aria's tests are its specification. `Button.brm` shows each step.

### Props

- Name the props as React Aria does: `isDisabled`, `onPress`, `onHoverChange`.
- Take `as`, and render `<{as ?? 'button'} …>`, so the caller can pick the element.
- End the element with `{...rest}`, so the caller's attributes come last. Its `class` adds to the part's, and its handlers run after the part's own.
- Show state as `data-*` attributes, with `undefined` for false, so `[data-pressed]` matches only a pressed part.

### State

Give each state one `let` prop, typed `Bindable`, such as `let { pressed = false } = $props<{ pressed?: Bindable<boolean> }>()`. Write it, and call `onChange`:

- `pressed=(true)` starts the part's own copy.
- `pressed=$bind(signal)` writes the caller's signal.
- `pressed=$bind(signal, setter)` lets the caller refuse the value.

There is no `defaultPressed`. See [Controlled and uncontrolled](../../docs/proposals.md#controlled-and-uncontrolled).

### Contexts and slots

A part that holds other parts provides their props in the context of each part type, in `src/contexts.ts`. A context value is the props, or `{ slots: { name: props } }`.

- Read the props with `slotProps($getContext(ButtonContext), slot)`.
- A memo cannot hold handlers. Read the context in a function when a handler runs, and call the context's handler before the part's own.
- Spread the attributes of the context, from `contextAttributes`, before `{...rest}`, so the caller wins.

### Interactions

`press.brm.ts`, `hover.brm.ts` and `focus.brm.ts` return state and a function for each event. Call them from the handlers of the element. Two modules that need the same event, such as `onKeyDown`, share one handler that calls both.

- The handlers load on the first event, after the browser has moved on. `preventDefault` in a handler is too late. Wrap the handler in `prevent(handler, 'Space')`, which the loader applies by key.
- A press keeps its pointer with pointer capture, so its `pointerup` reaches the element even outside it. A listener on the document would be added too late to see it.
- Plain helpers go in a `.ts` file, such as `interactions.ts`. Every export of a `.brm.ts` file is a module function that a component calls at the top of its script.

### Tests

- Test the behaviour of React Aria, with the helpers of `test/interact.ts`: `pointer`, `pressWith`, `press` and `tab`.
- The handlers of a fixture run after their code loads, so wait for what they log with `page.waitFor`.
- Add a step to `e2e/suites/ui.mjs` for what happy-dom does not do, such as pointer capture, scrolling and `:focus-visible`. The suite runs axe-core on the page.
