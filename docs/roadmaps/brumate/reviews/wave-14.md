# Checkpoint 2026-10-30, wave 14

## Merged

- loading-header-error (#350): `#loading (expr)` is a compile error, BRM181.
- date-field-sync (#351): DateField, DatePicker and DateRangePicker re-show the kept date after a refused write or a reset, follow a runtime locale change, block a submit outside minValue/maxValue; CalendarCell and DateSegment get `data-hovered` and `data-focus-visible`.
- checkbox-description (#354): a standalone Checkbox and Switch tie their description and error to the input. With `<Label as="span">` the input is named by the Label; without one, the slots are aria-hidden from the first server byte. Switch gets `isInvalid` (minor).
- overlay-navigation-cleanup (#355): ModalOverlay, Popover and Tooltip release their layer, inert, scroll lock and focus when the page is left by client navigation, and again after an `#offscreen` body hides and shows.
- tokenfield-sync (#358): the TokenField box shows the kept value after a reset and after quick edits then a reset. The refused-edit case is `it.fails`, waiting on bind-read-your-writes.
- field-error-clears (#360): ColorField and NumberField clear their native error once the value is valid (input, blur, keys, wheel, step buttons).
- Not roadmap nodes: #353 (Vercel skips deploys of commits that do not change the site), #356 (the DateField e2e step expects the blocked submit since #351), #357 (CI only after review, see Process), #359 (a regression test for cleanups of a page that arrived by client navigation).

## Ready for the maintainer to merge

- #352 streamed-memo-reads: `$resolve`, BRM182 to BRM184, handler reads of a loading memo throw. Fresh review clean (round 3 plus a final check), CI passes on b2558540, +160 B gzip on todos. Minor changeset.
- #361 overlay-focus-fixes: nested modals with a transition return focus to the first opener; a tooltip refused by its setter is asked again; a press on PreviewTrigger after a hover hides the card; modal plus menu start-open already worked (test only). Review clean after two fixes, CI passes on a2400785.

## Waiting for review

- #362 ui-docs-pages-utilities (draft): Separator, Transition, Heading, VisuallyHidden, Keyboard, I18nProvider and SelectionIndicator pages, with one e2e flow. Needs a fresh reviewer, then `gh pr ready 362`.

## Decisions (the maintainer)

- Pending memos in handlers: debate docs/debates/pending-handler-reads (approved). Explicit waiting with `$resolve` (Solid semantics: waits while the memo is pending, reloads included); BRM182 for reads the compiler sees; a throw for reads it cannot see; effects skip and rerun; promise props are read through `$memo` (node promise-prop-memo).
- `await` in a component the browser renders should wait like React's `use`: 0.5.0, spike first (browser-await-spike, which also checks Compostate's `toResult`).
- Function props that read state for a derivation: 0.5.0 node function-prop-reads (probe first, then decide supported or an error).
- Ideal behavior wins over 0.4.0 speed.

## Process changes

- PRs open as drafts; the orchestrator runs `gh pr ready` after a clean fresh review, so CI runs once (#357). Pushes to `docs/**` skip Test and Release. Memory: draft-prs-until-review.
- Vercel skips commits that do not touch website/, packages/ or the root package files (#353).
- oxlint and oxfmt skip `docs/debates/*/evidence/**`.

## Added nodes

- In the 0.4.0 cut: promise-prop-memo (after #352).
- 0.4.0, not yet in the cut (ask): transition-sibling-text, indicator-timing-function, i18n-locale-change, all found by #362. indicator-timing-function breaks the live site's `.ui-indicator` rule.
- 0.5.0: function-prop-reads, browser-await-spike.
- Dropped: client-arrived-cleanups (the repro was a race in the check; see its brief).

## Left for 0.4.0

- After #352 merges (they touch the same runtime files or depend on it): late-state-record, bind-read-your-writes, runtime-event-cancel, promise-prop-memo.
- check-package-imports (after #352: both edit check-command.ts).
- Docs and release prep: code-examples, ui-skill, try-sample-console, then changeset-review and release-0.4 (the maintainer merges #98).

## Follow-ups noted, no node yet

- `brumate check` finds server functions only through relative imports (server-files.ts findServerImport); package imports, tsconfig aliases and folder index files are missed while `vite build` catches them.
- A cut server stream leaves `#loading` bodies and effects pending forever (debate O7, O9).
- BRM182 still reports an `await $resolve` in a nested block followed by a read after the block (rare false positive).

## Flakes seen

- website e2e "/ui: the overlays open, save, close and give focus back" fails now and then with "Escape left the tooltip" on a loaded machine; it passed on main and on reruns.
- `/docs/control-flow: 10 live samples render` fails on main ("Not connected"), every run.
- brumate resume/devtools tests time out in full parallel runs on a loaded machine and pass alone.

## Worktrees left

- .claude/worktrees/streamed-memo-reads (#352), overlay-focus-fixes (#361), ui-docs-pages-utilities (#362). Remove each after its PR merges.

## Resume

1. Mark streamed-memo-reads and overlay-focus-fixes done once #352 and #361 merge; clean their worktrees and branches.
2. Review #362 with a fresh reviewer.
3. Ask the maintainer about the three new 0.4.0 nodes, then `plan.py ready` and start the runtime nodes that waited for #352.
