# Log: popover-tab-out

## Proof on the base (af581bbf)

Two tests in packages/ui/test/popover.test.ts, on the `isNonModal` popover of the fixture:
Tab from its last element must focus `.elsewhere` (the element after the trigger) and close it;
Shift+Tab from its first must focus the trigger. Both fail on the base: Tab is not handled in a
non-modal popover, so focus stays in the panel (the browser takes it out of the document).

## Prior art

Headless UI, packages/@headlessui-react/src/components/popover/popover.tsx at commit
fe9ec1793f174246367ac90a7b4a0b4071da27b4 (main when read). Its panel has focus sentinels. Tab
forwards past the last element reaches the after-panel sentinel, which focuses the first
focusable element after the button, skipping the panel and the sentinels, and wrapping. Shift+Tab
before the first element reaches the before-panel sentinel, which focuses the button. The popover
closes as focus leaves it. Without sentinel nodes, a keydown handler does the same here.

## Fix

`leaveByTab(panel, trigger, event)` in overlay.ts, copied unchanged from batch/brumate-release-0.8
(popover-group-alert), and called from the keydown of Popover.brm for every non-modal popover
(`isNonModal` or a non-modal trigger), not previews. `blurOutside` then closes it.
