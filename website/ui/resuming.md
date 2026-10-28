# How the parts resume

A brumate page loads the code of its components when it starts, and nothing renders twice. The parts are built for that, and a few of their behaviors come from it.

## Handlers run after the event

The loader catches an event and runs its handler once the browser is done with the event. So a handler cannot call `preventDefault`, and focus can have moved by the time it runs. `prevent(handler, keys)` from `brumate/events` is what applies during the event, before the handler runs.

- **A press keeps its pointer.** A button takes pointer capture when a press starts, so its `pointerup` reaches it even when the pointer ends outside, and the press ends.
- **Space is prevented by key, and Enter keeps its default.** Space never scrolls the page. On Enter, a link follows and a submit button sends its form without any code, and the click that the browser sends after Enter does not press again.
- **A disabled link has no `href`,** so there is nothing for the browser to follow. It leaves the order of Tab.
- **A read-only box prevents its click** with the wrapper, so the browser never toggles it, and a screen reader announces no change.
- **Tab stops at one item of a toolbar,** the one that had focus last. The other items leave the order of Tab, which is the roving tabindex of the WAI-ARIA toolbar.
- **A toolbar prevents only Up and Down,** so the page does not scroll. Home and End can scroll the page while they move focus.
- **A handler checks where focus is** before it shows a part as focused, since focus can have moved on.

## The server renders first

- **A field names its description before it knows that there is one.** The server writes the input before it reaches the `Text slot="description"`. When the browser is idle, the field leaves out the ID of a description that is not there.
- **The last Breadcrumb is the one that you mark** with `isCurrent`, since a part cannot read the structure of the markup that it gets.
- **The default locale is `en-US`,** not the language of the browser, which the server does not know. An `I18nProvider` sets it for the server and the browser alike.
- **The focus ring follows `:focus-visible`,** so no code listens to every key and pointer from the start of the page.

## Without scripts

- A native element still works: a button sends its form, a link follows, a box checks, and the radios of a group move with the arrow keys.
- A form checks its fields in the browser, and posts its values by name.
- A part that needs code, such as a `FileTrigger`, says so on its page.
