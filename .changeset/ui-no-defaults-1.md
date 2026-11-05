---
'@brumate/ui': minor
---

`ButtonContext`, `LinkContext`, `ToggleButtonContext`, `ToggleGroupContext`, `ToolbarContext`, `HeadingContext`, `TextContext`, `LabelContext`, `SeparatorContext` and `GroupContext` have no default. Reading one with no provider throws. Button, Link, ToggleButton, Toolbar, ToggleButtonGroup, Heading, Text, Label, Separator and Group still render alone. Code that reads these contexts itself guards the read with `$hasContext(Context)`.
