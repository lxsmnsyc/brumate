# Log: ui-docs-pages-utilities

- 2026-10-30: all seven pages were stubs with one demo each. Added what applies to each (table in outcome.md).
- A `<p>` with text before a `Transition` that is removed on leave throws "Missing end marker" in the browser. Wrapping the text in a `<span>` fixed it. Found with a probe page, not fixed in core.
- `moveIndicator` in packages/ui/src/selection-indicator.ts splits `transition-timing-function` at the first comma, so `cubic-bezier(0.2, 0, 0, 1)` throws in `element.animate`. The demo uses `ease-out`. The `.ui-indicator` rule in the site layout has the same value.
- A `locale` that changes on an `I18nProvider` printed the same Meter text in the e2e run until the provider sat inside `#if`; the page now builds one provider for each locale.
- e2e: the control-flow flow fails as on main. The overlays flow passed on the last run.
