---
'@brumate/ui': minor
---

`DisclosurePanelContext`, `DisclosureGroupContext`, `OverlayTriggerContext`, `ModalOverlayContext`, `ColorSwatchContext`, `ColorPickerContext`, `DatePickerContext`, `CalendarContext`, `CalendarGridContext`, `DateStringsContext`, `DateFieldContext`, `DateRangeFieldContext`, `ColorThumbContext`, `ColorWheelContext`, `TransitionContext`, `TabsContext`, `TagGroupContext`, `SliderContext`, `TooltipTriggerContext`, `ToastRegionContext`, `ToastContext` and `SelectionIndicatorContext` have no default. Reading one with no provider throws. The parts that read them still render alone. Code that reads these contexts itself guards the read with `$hasContext(Context)`. No `createContext` in the package has a default now.
