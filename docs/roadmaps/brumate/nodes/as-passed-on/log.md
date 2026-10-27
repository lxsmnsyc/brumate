# Log: as-passed-on

- Test first: gapPassOnComponent, gapPassOnChoice and gapPassOnChoiceOther time out on main. Each uses targets that no other fixture names, since the test project analyzes all fixtures together.
- project.ts: `summarize` records, for each prop, the `.brm` imports its value names (also the branches of `?:`, `??`, `||`) and the own props it reads (`{as}`). `analyzeProjectProps` keeps the components given to each prop of each file, passes them on through the second kind, and sends the live props of the dynamic tags that read the prop.
- ToggleButton it.fails stays. The analysis follows `as` through ToggleButton and Button, but AsTarget is already live for Button's props in the ui project, so the ui result does not change (no new live prop). The ARIA of ToggleButton reaches Button's `...rest`, which the dynamic tag spreads, and a spread on a component tag stays static (gap 2 of component-tag-live-props).
- Tried: counting a live spread of a dynamic tag, and routing `attrs` of a component anchor to `spreadProps`. 3 as-controls tests fail (Toolbar focus, Disclosure, ToggleButton), so I reverted both.
