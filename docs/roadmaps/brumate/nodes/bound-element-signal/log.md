# Log: bound-element-signal

- Set `$signal<any>()` fixtures to `$signal<HTMLElement>()` and reproduced TS2345 "A function cannot be sent to the client" on main, 15 in asControls.brm and 4 in the as-collections fixtures.
- A `ref=$bind(x)` on a component is a `value` attribute named `ref`, so the analyzer never adds it to `declaration.refs` (only elements do). `sentDeclarations` in check.ts therefore kept the signal.
- Test first: three tests in check.test.ts. The one for a signal bound only to `ref` failed on main.
- Fix: `declareBinding` records the prop names in `declaration.boundAs`. check.ts skips a signal whose only name is `ref`.
- as-collections fixtures still fail with `HTMLElement`: ListBox and ListBoxItem type `ref` as `Bindable<HTMLElement>`, without `undefined`. That is ref-type-parts. Those two signals stay `any`.
- Typecheck proven by a deliberate error in asControls.brm (TS2322), then removed.
