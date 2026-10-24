# Differences from React Aria

The parts follow React Aria and its tests. Where they differ, it is because of how brumate runs a page.

## Handlers run after the event

A brumate page ships no code before an event. The loader catches the event, loads the handler, and runs it after the browser is done with the event. So a handler cannot call `preventDefault`, and focus can have moved. `prevent(handler, keys)` from `brumate/events` is the one thing that applies during the event.

- **Press keeps its pointer with pointer capture.** React Aria listens to the document for the end of a press. That listener would come too late, so the button keeps the pointer and gets its `pointerup` itself.
- **Space is prevented by key, and Enter keeps its default.** A link follows and a submit button sends its form on Enter, without code. The click of the browser after Enter does not press again.
- **A disabled link has no `href`.** React Aria prevents its click. Here, it has no address, so there is nothing to follow. It stays in the order of Tab, as in React Aria.
- **A read-only box prevents its click with the wrapper,** so the browser never toggles it.
- **Tab stops at one item of a toolbar.** React Aria moves focus to the edge of the toolbar just before Tab moves on. Here, the other items leave the order of Tab, which is the roving tabindex of the WAI-ARIA toolbar.
- **A toolbar prevents only Up and Down,** so the page does not scroll. Home and End can scroll the page while they move focus.

## The server renders first

- **A field names its description before it knows that there is one.** The server writes the input before it reaches the `Text slot="description"`. When the browser is idle, the field leaves a missing ID out, as React Aria does after its first render.
- **The last Breadcrumb is the one that you mark** with `isCurrent`. React Aria reads it from a collection of children, which a brumate part cannot read.
- **The default locale is `en-US`,** not the language of the browser, which the server does not know.
- **The focus ring follows `:focus-visible`,** in place of listeners on every key and pointer from the start of the page.

## The API

- **One prop for each state,** with no `defaultSelected` or `defaultValue`. See [State](./state.md).
- **`TextField` takes a field of `createForm`,** from brumate's forms.
