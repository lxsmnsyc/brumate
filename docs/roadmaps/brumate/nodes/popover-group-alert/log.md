# Log: popover-group-alert

- Checked for existing work: no PopoverGroup, Alert, or group check in overlay.ts on the base.
- Design: no registry. The group element has `data-popover-group=<id>`, and the layer of each popover inside it has `data-popover-group-panel=<id>`. `blurOutside` takes a `keeps(target)` check; `inPopoverGroup` looks for either marker above the target. The context holds only `{ id }`, so it is sendable. A Popover resets the context for the popovers inside it, so nested ones are not members.
- Gap on a common path: a panel renders at the end of the page, so Tab from its last element left the document and never reached the next trigger. `leaveByTab` (overlay.ts) moves Tab to the next element after the trigger that is not in a layer, and Shift+Tab from the start to the trigger. Only for non-modal popovers in a group.
- Focus on the Dialog of a panel (index -1 of the tab order) counts as before the first element.
- Event handlers of the test runner load lazily, so the Tab test waits for the result with waitFor.
- `key` is not a prop; the way to re-announce is `#key (value)`. Docs and the Alert comment say so.
- Alert needs no extra work for announcements: role="alert" is an assertive live region, and a new element inserted is announced.

## Review fixes

- Read Headless UI `packages/@headlessui-react/src/components/popover/popover.tsx` on main, last commit of the file fe9ec1793f174246367ac90a7b4a0b4071da27b4 (https://github.com/tailwindlabs/headlessui). Found:
  - The focus-out handler returns early when `isFocusWithinPopoverGroup()`. The group returns true when its own element contains the active element, or when a registered popover's button or panel does (for portals). So focus in the group element, such as on a plain link, keeps a popover open. Item 2 of the review (narrow to registered members) does not match the source, so `inPopoverGroup` is kept, and a test pins the link case as open.
  - The outside click containers are only the popover's own button and panel, so a click on another button is an outside click.
  - `closeOthers` runs when a button opens its popover (click, Enter, Space; Escape on a closed one too), so opening one closes the others of the group. This is what we now copy: `closeOthersInGroup` (overlay.ts), called from `show()` of Popover.
  - Only focus alone (Tab) leaves a popover open next to another focused trigger. Two popovers are not open at once.
- Tests updated: the click case now expects the first to close when the second opens. Docs say so.
- `leaveByTab` stays limited to groups. Non-modal popover outside a group that loses focus by Tab from its last element stays open: main bug, for a 0.7.1 node.
- `leaveByTab` tests: empty panel, trigger last on the page.
- Alert has `aria-atomic="true"` and a clearer alert.md.
