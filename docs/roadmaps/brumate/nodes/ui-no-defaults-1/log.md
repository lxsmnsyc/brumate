# Log: ui-no-defaults-1

- Files picked: contexts.ts (Button, Heading, Text, Label, Separator, Group, Link, ToggleButton, Toolbar, ToggleGroup). Readers: Button, Link, ToggleButton, ToggleButtonGroup, Toolbar, Heading, Text, Label, Separator, Group, plus Checkbox (Label, Text), TooltipTrigger (Button), PreviewTrigger (Button, Link), Breadcrumb (Link).
- Baseline TS2554 in packages/ui: 61. After: 51.
- Toolbar and ToggleButtonGroup use `const nested = $hasContext(ToolbarContext)`; the provider still sets `true`.
- Checkbox gave `Store<... | undefined>` to `$toStore`; fixed with `?? null` inside a group.
- Full ui suite: 63 files fail, none for a group 1 context. Button.test.ts failed twice under load, passes alone.
- Example client JS built (vite build in examples/ui): 203,133 B before, 203,017 B after (gzip -9 sum).
