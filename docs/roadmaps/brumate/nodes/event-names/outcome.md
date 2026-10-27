# Outcome: event-names

## Built

- packages/brumate/src/check.ts:
  - `$$on` reads `ElementEvents` of `brumate/elements`, so an event that an app merges in reaches the handler with its type.
  - The event name of `$$on`, `$$onWindow` and `$$onDocument` must be a key of its map. An unknown name (`onFooBar`, `onDoubleClick`, which listens to `doubleclick`) is TS2345 at the attribute name. The `$$Event` fallback to `Event` is gone.
  - A new `Writer.event` writes the name as a string that is mapped to the attribute name, so the error is at the attribute and not lost.
- packages/tsc/test/fixture/src/Events.brm and events-aug.ts, and four expected errors in packages/tsc/test/tsc.test.ts: `onFooBar` and `onDoubleClick` on a `div`, `onFooBar` on `<window>` and `<document>`. `onItemAction` with a merged `itemaction: CustomEvent<string>` has no error and `event.detail` is a string. On main the fixture gave the `detail` error and none of the four.
- packages/brumate/test/check.test.ts: the event name maps to the attribute, also for a shorthand.
- Caller fix: packages/ui/src/toast.ts merges `toastchange` into `ElementEvents`, since ToastRegion.brm listens to it and toast.ts dispatches it.
- .changeset/event-names.md (patch for brumate and @brumate/ui).

## Deviations

- events-aug.ts is a new file in the fixture, not listed in `owns`: `declare module` is not allowed in a .brm file.
- packages/ui/src/toast.ts is not a `*.brm` file, but it is the place of the event, and the change is 6 lines.

## Stubs left

- None.

## Gotchas

- The error message lists the first names of the event union, not "did you mean". The position is what points to the mistake.
- A custom event reaches a handler only when the file that merges it is in the program. In an app, put the `declare module` in a `.ts` or `.d.ts` file that the tsconfig includes.
- `ElementProps` still has only `onItemaction` for a merged `itemaction`, not `onItemAction` (the fixed camel list of elements.d.ts). That is for element-checks, which checks attributes against `ElementProps`.

## Proposed learnings

- None.

## Verification

- `brumate-tsc --noEmit`: exit 0 in packages/ui, website and the 7 examples (hackernews, kit-app, nitro, todos, tracker, ui-kit, ui). With `onToastchang` in ToastRegion.brm it exits 2 at the attribute.
- `npx vitest run` in packages/tsc: pass. In packages/brumate: 984 passed, 6 expected fail. In packages/ui (`--maxWorkers=2`): 536 passed, 2 expected fail.
- `npx tsc --noEmit -p .` and `-p tsconfig.elements.json` in packages/brumate: exit 0. `npx oxlint` and `npx oxfmt --check`: exit 0.

## Size

- Estimated S, actual S. check.ts only (language tooling), no runtime change, so no size numbers.
