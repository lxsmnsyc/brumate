# Outcome: popover-group-alert

## Built

- `PopoverGroup` (packages/ui/src/PopoverGroup.brm): one element with `data-popover-group=<id>`, `as` and passed props; gives `PopoverGroupContext` (`{ id }`, contexts.ts). A non-modal `Popover` inside it adds `data-popover-group-panel=<id>` to its layer and passes `blurOutside` a `keeps` check (`inPopoverGroup`, overlay.ts), so focus on the trigger or panel of another popover of the group closes nothing. Other focus still closes it.
- Tab path: `leaveByTab` (overlay.ts) moves Tab from the end of a group panel to the next element after its trigger outside any layer, and Shift+Tab from the start to the trigger. Panels render at the end of the page, so the browser alone could not reach the next trigger.
- Opening a popover of a group closes the others (`closeOthersInGroup`, overlay.ts), as Headless UI's `closeOthers` does. Focus alone (Tab) keeps the first open; a click on another trigger opens that popover and closes the first.
- A Popover resets the context for popovers inside it, so nested popovers are not members.
- `Alert` (packages/ui/src/Alert.brm): `<div role="alert" aria-atomic="true">`, `as`, props passed. Re-announcing the same message: wrap it in `#key`.
- Docs: website/ui/popover-group.md, website/ui/alert.md, demos PopoverGroupDemo.brm and AlertDemo.brm; sidebar entries in website/src/ui-groups.ts.
- Example examples/ui/src/sections/PopoverGroupSection.brm; e2e e2e/suites/ui/popover-group.mjs (1 step). Tests packages/ui/test/popover-group.test.ts (8) with fixture popover-groups.brm. Changeset .changeset/popover-group-alert.md (minor).

## Deviations

- Edited outside owned and shared paths (minimal): packages/ui/src/contexts.ts (the context), website/src/ui-groups.ts (sidebar), examples/ui/src/sections.brm (two lines), e2e/suites/ui/index.mjs (one line). New: packages/ui/test/fixtures/popover-groups.brm, examples section, e2e step.
- Not ported from Headless UI: its registry of popovers. DOM markers do the same job and keep the context sendable.
- The brief says `key` for repeating a message; `key` is not a prop in brumate, so the docs use `#key`.

## Stubs left

- None.

## Gotchas

- The Tab handler is an event handler that loads with the page; in the happy-dom tests it loads lazily, so tests wait with `waitFor`.
- A group needs the trigger inside the group element; a trigger outside it is not a member, though its panel can be.
- Modal popovers are unaffected (the page is inert).

## Proposed learnings

- None.

## Verification

- `pnpm --filter @brumate/ui exec vitest run`: 81 files, 835 passed, 1 expected fail (before the last #key test; popover-group.test.ts alone after: 8 passed).
- `node e2e/run.mjs --only ui`: 61 passed, 0 failed.
- `node e2e/run.mjs --only website`: 2 failures, neither on my pages: "/docs/context 4 live samples render" (Derived stores, other work) and "/ui each page of the sidebar loads" fails on /ui/color-scheme color-contrast (color-scheme page, not mine). The run started before the AlertDemo `#key` edit; /ui/alert and /ui/popover-group came earlier in the sidebar order and did not fail.
- `pnpm --filter website check:samples`: 70 samples, 0 problems. `pnpm exec oxlint`: no errors. `pnpm format:check`: clean. brumate-tsc --noEmit in packages/ui, website, examples/ui: exit 0.
- Public repo, no workflow triggered.

## Size

- Estimated S, actual S to M (Tab path, docs).

## Review fixes verification

- Prior art read: Headless UI popover.tsx, file's last commit fe9ec1793f17 (see log.md). Its group also keeps a popover open for focus anywhere in the group element, so `inPopoverGroup` is not narrowed; a test pins it.
- leaveByTab tests added (empty panel, trigger last on the page). leaveByTab stays group-only; the non-group Tab-leave gap is a main bug for a 0.7.1 node.
- After merging batch/brumate-release-0.8 (256668d6): popover-group, popover, menu, context-menu tests 68 passed; `pnpm --filter @brumate/ui typecheck` clean; check:samples 70/0; oxlint no errors; format:check clean; e2e ui 61 passed; e2e website 75 passed, 0 failed.

## Main bugs

- A non-modal Popover outside a group, when Tab leaves its last element, stays open (panels render at the end of the page and focus leaves the document without a focusin). Repro: open a `isNonModal` Popover, focus its last button, press Tab.
