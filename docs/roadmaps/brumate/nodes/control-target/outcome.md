# Outcome: control-target

## Built

- packages/brumate/elements.d.ts: new export `ElementEvent<K, E>`, the event `K` on the element `E`. `currentTarget` is `E`. `target` is `E` for `input`, `change`, `beforeinput`, `focus`, `blur`, `focusin` and `focusout` when `E` is `HTMLInputElement`, `HTMLSelectElement` or `HTMLTextAreaElement`, and `Element` otherwise (so a `div`, an SVG element, a dynamic tag of `HTMLElement | SVGElement`, and other events on a control). `Handlers<E>` uses it.
- packages/brumate/check.d.ts: `DynamicHandle` uses `ElementEvent`.
- packages/brumate/src/check.ts: `$$on` uses `ElementEvent`. `$$onWindow` and `$$onDocument` are unchanged, so they keep `EventTarget`.
- Type shape follows Solid (its handlers type `target` as the element for input, change and focus events, `Element` otherwise). Svelte types `target` as `EventTarget & T` for every event and React as `EventTarget & T` for `currentTarget` only (`target` stays `EventTarget`), so Solid was closest.
- Tests: packages/tsc/test/fixture/src/Target.brm and 2 expected errors in packages/tsc/test/tsc.test.ts (`value` on a click of an `input` and of a `div` is an error). Before the change the same fixture gave 12 errors for `event.target.value` on `input`, `select`, `textarea` and `blur` (`EventTarget` has no `value`). packages/brumate/test/elements-types.ts has 6 accepted and 2 rejected cases.
- .changeset/control-target.md (minor for brumate).

## Deviations

- None. No cast was removed in packages/ui or website: every `event.target as ...` there is in a function typed with a plain `Event`, or on a handler of a `div` or of an event outside the list (`invalid`), so this change does not make it unneeded.

## Stubs left

- None.

## Gotchas

- `EventHandler<E, Ev>` (the exported helper for a function that a prop takes) is unchanged: it takes the event type, not its name, so it cannot know the `target`. Use `ElementEvent<'input', HTMLInputElement>` for a typed target.
- The tsc fixture needs `pnpm --filter brumate build` after a change to check.ts, since packages/tsc uses its dist.
- A custom event merged into `ElementEvents` gets `target: Element`.

## Proposed learnings

- None.

## Verification

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm --filter @brumate/tsc test`: 3 passed.
- `pnpm --filter brumate test`: 2995 passed, 1 timeout (differential-4 ResolveGoneChild, load); it passes alone.

## Size

- Estimated S, actual S. Types only, no runtime change.
