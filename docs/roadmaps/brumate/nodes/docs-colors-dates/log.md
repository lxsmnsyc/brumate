# Log: docs-colors-dates

- Made worktree node-docs-colors-dates from origin/main. Did color-slider first and built the website to see its props table, then the other 11 pages.
- Read each part's source for the data attributes and keys. Each Keyboard row matches a handler: ColorThumb (keyAll), the inputKey of ColorSlider, ColorArea and ColorWheel, ColorField keyDown, CalendarGrid keyDown, DateSegment keyDown and beforeInput, DateInput keyDown, ColorSwatchPicker keyDown.
- Found: the Home and End of ColorArea move x by a page, not to the ends. The page says so.
- Review fix: PageUp and PageDown of a Calendar, and `pageBehavior="single"`, move one unit of `visibleDuration`.
- Found: DateSegment erases on Delete too (deleteContentForward), so the key row says `Backspace` or `Delete`.
- Found: CalendarHeading takes `children` in its type but does not render them. Its comment says so.
- Wrote 125 doc comments with a script that inserts the comment line above the prop, then read the props tables through readProps: no empty Description.
- ColorSwatch and ColorPicker set no data attributes and take no keys, so those sections are left out.
- Checked: website check:samples, vite build (client and ssr), website tests, brumate-tsc in packages/ui and website, ui suite, oxlint, root oxfmt.
- Review round: fixed the claims on Calendar paging, the hue snap with Shift, DateInput arrows with modifiers, ColorArea aria and tab order, Calendar comments (onChange, focusedValue), and removed Keys prose that repeated the tables.
