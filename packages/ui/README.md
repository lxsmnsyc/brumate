# @brumate/ui

Accessible, unstyled components for brumate. They follow the behaviour and the composition of [React Aria Components](https://react-spectrum.adobe.com/react-aria/components.html), and the API of [Terracotta](https://github.com/lxsmnsyc/terracotta). The plan is in [Headless UI components](../../docs/proposals.md#headless-ui-components).

The package is private while its first phase is built.

- The parts render markup, ARIA attributes and `data-*` state, and no CSS of their own, except what a part needs to work, such as the styles that hide the content of `VisuallyHidden`.
- A part uses a feature of the platform only when at least 95% of global usage supports it.
- Each part has a `.stories.ts` file for the workbench of the dev server, at `/__brumate/workbench`.

## Parts

- `Breadcrumbs` and `Breadcrumb`: an `<ol>` of links. `isCurrent` marks the step of the current page.
- `Button`: presses with a pointer, Enter, Space or a screen reader. Its state is in `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled` and `data-pending`.
- `Checkbox`: a label around a native checkbox, with `data-selected`, `data-indeterminate`, `data-pressed` and the focus and hover of its label.
- `CheckboxGroup`: checkboxes with one value, a list. With `isRequired`, the browser asks for a box on a submit.
- `Dialog` and `DialogTrigger`: a dialog in an overlay, named by a Heading with `slot="title"`, and closed by a Button with `slot="close"`.
- `Disclosure`, `DisclosurePanel` and `DisclosureGroup`: content that expands and collapses. A collapsed panel is `hidden="until-found"`. `transition` on the panel lets CSS animate it, with `--disclosure-panel-height`, and `unmount` decides what happens to its content while it is collapsed.
- `FieldError`: the errors of a field, while it is invalid.
- `FileTrigger`: opens the file picker from a Button inside, and calls `onSelect` with the files.
- `Form`: a form that tells its fields how to validate, and gives them the errors of the server by name.
- `Group`: parts that belong together, with `data-focus-within`, `data-hovered`, `data-disabled` and `data-invalid`.
- `Heading`: a heading of a level, which a context can set.
- `I18nProvider`: gives the parts inside it a locale and its direction. The default is `en-US`.
- `Input` and `TextArea`: the input of a field, with `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled` and `data-invalid`.
- `Keyboard`: a keyboard shortcut, left to right in every language.
- `Label`: the label of a field, with the `id` and `for` that the field gives.
- `Link`: a link that presses as a button does, with `data-current`. A disabled link has no address.
- `ListBox`, `ListBoxItem`, `ListBoxSection` and `Header`: a list of options with single or multiple selection, the arrow keys, typeahead and ranges. It reads its items from the page, so they can come from any markup.
- `Meter` and `ProgressBar`: a value in a range, with its text in the locale and `--percentage` for CSS.
- `ModalOverlay` and `Modal`: a dialog over the page. The page is inert and does not scroll while it is open. Escape closes it, and a press outside does with `isDismissable`.
- `OverlayArrow`: an arrow from a Popover to its trigger.
- `Popover`: an overlay beside its trigger, in a layer of its own. It is modal unless `isNonModal`, closes on Escape and a press outside, and takes `transition`.
- `PreviewTrigger`: a Popover of a Link or a Button, on hover, on keyboard focus and on a long press. It is not modal, and Tab moves into it.
- `RadioGroup` and `Radio`: native radios with one name, so the arrow keys move the choice.
- `SearchField`: a search input with a button that clears it. Escape clears it, and Enter calls `onSubmit`.
- `Separator`: an `<hr>`, or a vertical separator.
- `Sheet`: a Modal along an edge of the window, with `data-side`.
- `Switch`: a native checkbox with `role="switch"`.
- `Text`: the text of a field, such as its description, with the `id` that the field gives.
- `TextField`: a field of a Label, an Input or a TextArea, a description and a FieldError. The browser checks it on a submit, and `field` takes a field of `createForm`.
- `Transition` and `TransitionChild`: animate content in and out, with `data-closed`, `data-enter` and `data-leave`, and keep it until its leave ends. Each step waits for the animations of the element, and a child moves with its parent.
- `TooltipTrigger` and `Tooltip`: a description of a Button, on hover after a delay and on focus from the keyboard.
- `Toolbar`: the arrow keys move focus between its items, and Tab stops at one of them.
- `Toast`, `ToastContent` and `ToastRegion`: notices from a queue, `toastQueue()` of `@brumate/ui/toast.ts`, in a landmark that F6 reaches. A timeout stops while the pointer or focus is in it.
- `ToggleButtonGroup`: ToggleButtons with one selection, as radios, or several, as a toolbar.
- `ToggleButton`: a button that stays pressed, with `aria-pressed` and `data-selected`.
- `VisuallyHidden`: hides its content from sight and keeps it for screen readers.

## Writing a part

A part is a `.brm` component in `src`, with a `.stories.ts` file, a test in `test`, and a section in `examples/ui`. It follows the part of React Aria Components of the same name, and React Aria's tests are its specification. `Button.brm` shows each step.

### Props

- Name the props as React Aria does: `isDisabled`, `onPress`, `onHoverChange`.
- Export `<Name>Props` from `<script module>`, and use it in `$props<NameProps>()`, so apps can import it. See [Props types](../../website/docs/typescript.md#props-types).
- Take `as`, and render `<{as ?? 'button'} …>`, so the caller can pick the element. Its type is `AsProps` of `src/as.ts`, as `ButtonProps` shows: the other props are those of the element or the component.
- End the element with `{...rest}`, so the caller's attributes come last. Its `class` adds to the part's, and its handlers run after the part's own.
- Show state as `data-*` attributes, with `undefined` for false, so `[data-pressed]` matches only a pressed part.

### State

Give each state one `let` prop, typed `Bindable`, such as `let { pressed = false } = $props<ToggleProps>()`, with `pressed?: Bindable<boolean>` in `ToggleProps`. Write it, and call `onChange`:

- `pressed` alone starts the part's own copy as on.
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
