# Log: skill-0-9-apis

- Read SKILL.md, references/ and the docs pages of the brief (effects.md, state.md, reference-signals.md, reactive-modules.md, navigation.md, markup.md, styles.md, observability.md, errors.md).
- state.md: `$produce` on `Map` and `Set` (bullet and example), BRM209 named next to the effect rule, an "Async effects" part with the `connect` example of effects.md and its rules. The old line "is not `async`" is gone.
- signals.md: `$effect` and `$client` callbacks can be `async`, with the cleanup forms; `$signal` notes module level; `$produce` names maps and sets.
- syntax.md: scoping adds no specificity (`:where`); component CSS inline in server renders plus cached sheets; `<script inline data-rerun>` replaces the `raw()` head script, as navigation.md does since external-scripts; `<script src trigger="idle">` and `<script inline trigger="interaction">`; "Shared state at module level" with the cart.brm.ts example of reactive-modules.md, a `wrong:` block for `Cannot assign to module signal`, BRM211 and BRM208.
- events.md: "View transitions" with the `transition()` example of markup.md, `viewTransition`, `viewTransitionName`, `navigate: { transition: true }`.
- SKILL.md: rules for async effects, scripts in markup (replaces the `raw()` rule), module signals, view transitions, BRM209. Route lines updated. The onTrace bullet was already there (observability-docs).
- run-tasks needs a project whose package.json lists `@brumate/ui` as a dependency, or the theme task fails with BRM167: `brumate check` finds component packages from the dependencies.
