# Checkpoint 2026-10-28, wave 13 (paused for a device restart)

## Merged

- combobox-fixes (#340): ComboBox and Select keep later server errors, ComboBox shows and restores its required message, a refused pick shows the kept item, Autocomplete filters by the text the field shows (typing and code writes).
- overlay-start-open (#341): Popover, ModalOverlay and Tooltip open on load from an open start value, through `queueLoad` in document order; modals that start open stack; a non-modal popover leaves focus in an input.
- ui-docs-pages-fields (#342): TextField, SearchField, TokenField, NumberField, Slider.
- ui-docs-pages-dates (#343): Calendar, RangeCalendar, DateField, TimeField, DatePicker, DateRangePicker; the `.ui-calendar` layout fix.

## Decisions (the maintainer)

- 0.4.0 cut adds combobox-fixes and overlay-navigation-cleanup.
- After 0.4.0: minor work targets `next`, hotfixes target `main`, `next` is synced after every main release (node next-branch, gated).

## Added nodes

- overlay-navigation-cleanup (in the cut), tokenfield-sync and date-field-sync (not yet in the cut; ask), next-branch (after release-0.4).
- overlay-focus-fixes also takes the modal-plus-menu start-open case.

## Left for 0.4.0

- Part fixes: overlay-navigation-cleanup, overlay-focus-fixes, checkbox-description, field-error-clears.
- Docs: ui-docs-pages-collections-3, ui-docs-pages-utilities.
- Release prep: ui-skill, code-examples, try-sample-console, then changeset-review and release-0.4 (the maintainer merges the Version Packages pull request).
- To ask: tokenfield-sync and date-field-sync in the cut (both visible form bugs on main; recommend yes).

## Notes

- No worktree, branch or server is left; resume with `plan.py ready --max-parallel 3`.
