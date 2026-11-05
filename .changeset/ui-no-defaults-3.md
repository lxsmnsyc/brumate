---
'@brumate/ui': minor
---

`ListBoxContext`, `ListBoxGivenContext`, `CollectionFocusContext`, `SectionContext`, `SelectValueContext`, `VirtualizerContext`, `MenuTriggerContext`, `MenuContext`, `SubmenuContext`, `DialogContext`, `TreeContext`, `TreeRowContext`, `TokenFieldContext`, `TokenContext`, `TableContext`, `TableRowContext`, `TableResizeContext`, `ColumnContext`, `NavigationTreeContext` and `NavigationLinkContext` have no default. Reading one with no provider throws. The parts that read them still render alone. Code that reads these contexts itself guards the read with `$hasContext(Context)`.
