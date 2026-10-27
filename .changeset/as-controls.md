---
'@brumate/ui': minor
---

`as` and `ref` on more parts. ToggleButton, Toolbar, ToggleButtonGroup, Disclosure, DisclosureGroup, DisclosurePanel, RadioGroup, CheckboxGroup, Meter, ProgressBar, Toast, ToastRegion, Dialog, Popover and Tooltip take an element name or a component in `as`, with the props of the target, and forward `ref` to the element they render. Each exports `<Name>OwnProps` and `<Name>Props<T>`.
