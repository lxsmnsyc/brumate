# Outcome: docs-overlays

## Built

- The 20 pages of Overlays, Navigation, Status, Layout, Animation and Utilities in website/ui follow the props-table contract: dialog, popover, modal, sheet, tooltip, preview-trigger, toast, disclosure, disclosure-group, breadcrumbs, toolbar, meter, progress-bar, group, separator, heading, transition, visually-hidden, keyboard, i18n-provider. Each has a `props` block for every part it covers.
- Doc comments for the props of 31 parts in packages/ui/src (128 new comments, comments only): Dialog, DialogTrigger, Popover, OverlayArrow, Modal, ModalOverlay, ModalContent, Sheet, Tooltip, TooltipTrigger, PreviewTrigger, Toast, ToastContent, ToastRegion, Disclosure, DisclosurePanel, DisclosureGroup, Breadcrumbs, Breadcrumb, Toolbar, Meter, ProgressBar, Group, Separator, Heading, Transition, TransitionChild, VisuallyHidden, Keyboard, I18nProvider. No prop of these parts has an empty Description (160 rows checked with `readProps`).
- The comment of Breadcrumb that named a library is reworded, and so is the one of VisuallyHidden.
- Changeset .changeset/docs-overlays.md (patch, @brumate/ui).

Sections per page (A anatomy, P props, D data attributes, K keyboard, C controlled and uncontrolled, S styling). x = written, - = left out on purpose.

| Page            | A   | P   | D   | K   | C   | S   |
| --------------- | --- | --- | --- | --- | --- | --- |
| dialog          | x   | x   | -   | x   | x   | x   |
| popover         | x   | x   | x   | x   | x   | x   |
| modal           | x   | x   | x   | x   | x   | x   |
| sheet           | x   | x   | x   | x   | x   | x   |
| tooltip         | x   | x   | x   | x   | x   | x   |
| preview-trigger | x   | x   | x   | x   | x   | x   |
| toast           | x   | x   | x   | x   | -   | x   |
| disclosure      | x   | x   | x   | x   | x   | x   |
| disclosure-group| x   | x   | x   | x   | x   | x   |
| breadcrumbs     | x   | x   | x   | x   | -   | x   |
| toolbar         | x   | x   | x   | x   | -   | x   |
| meter           | x   | x   | x   | -   | -   | x   |
| progress-bar    | x   | x   | x   | -   | -   | x   |
| group           | x   | x   | x   | x   | -   | x   |
| separator       | -   | x   | x   | -   | -   | x   |
| heading         | -   | x   | x   | -   | -   | -   |
| transition      | x   | x   | x   | -   | -   | x   |
| visually-hidden | -   | x   | x   | x   | -   | x   |
| keyboard        | -   | x   | x   | -   | -   | x   |
| i18n-provider   | -   | x   | -   | -   | -   | x   |

Left out: Anatomy for a single part. Data attributes for Dialog, DialogTrigger and I18nProvider (they set none). Keyboard for parts that take no keys. Controlled and uncontrolled for parts with no state (Toast keeps its state in the queue, not in a prop). Styling for Heading, which sets nothing to style. Where a part sets no data attributes but the page has the section, the page says so in a sentence (meter, heading, keyboard, preview-trigger).

## Deviations

- The old prose stays under the demo, as on the other docs pages. The old `## Keyboard` prose of preview-trigger.md moved into the keyboard table, with one line of prose after it.
- Props of Modal, ModalOverlay, Sheet, Group and others that take `[attribute: string]: unknown` do not list the attributes they pass on. Sheet's page says it also takes the props of a Modal.
- Demos are unchanged.

## Stubs left

- None.

## Gotchas

- The DialogTrigger comment said the Button gets `aria-haspopup`. The code does not set it, and the page says so. The comment is fixed.
- Popover and ModalOverlay call `onOpenChange` only when they close themselves with their own `isOpen`. With a DialogTrigger, the trigger reports the change. The comments say so.
- Escape closes a Popover or a Modal only when focus is inside it (the handler is on the element). Not run in a browser.
- The keys of the tables follow the handlers (overlay.ts, preview.ts, toast.ts, toolbar.ts) and were not checked one by one in a browser.
- Toast: F6 acts on the first toast that is not inert, not strictly the newest while another leaves. Shift + F6 behaves like F6 in the code, so the table lists F6 only.
- Toolbar focus stops at the first and the last item. It does not wrap.
- Group takes `as` in a separate `$props` call, so its default shows as `'div'` only because the generator reads it. TransitionChild shows only `children`, since it forwards the rest.
- ToastRegion needs `toast` and its type shows `QueuedToast<V>`.

## Proposed learnings

- Check each key of a table against a handler, and each data attribute against the markup, before writing the row | earlier docs nodes needed a fix round for claims the code did not back | website/ui | no

## Verification

- `node scripts/check-samples.ts` in website: 63 samples, 0 problems.
- `npx tsdown` in packages/brumate, packages/tsc and packages/language-core, then `npx vite build` (client and ssr) in website: passes; every `props` block resolves.
- Website tests: 9 passed.
- `npx brumate-tsc --noEmit` in packages/ui and in website: exit 0.
- `npx vitest run --maxWorkers=2` in packages/ui: 58 files, 544 passed, 1 expected fail.
- `npx oxlint --quiet`: exit 0. Root `npx oxfmt --check`: passes.
- Public repo; no workflow was triggered by hand.

## Size

- Estimated M, actual M.
