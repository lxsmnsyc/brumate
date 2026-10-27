# Log: event-names

- Probe on main: fixture Events.brm gave TS2339 for `event.detail` of a merged `itemaction` event, and no error for `onFooBar` or `onDoubleClick`.
- `declare module` is not allowed in a .brm script (TS1234), so the fixture merges the event in `events-aug.ts`.
- The generated code wrote the event name as a literal with no mapping. It now stands in place of the attribute name (same length: `on` plus the name, against the name plus two quotes), so the error is at the attribute. A shorthand `{onClick}` maps to its name inside the braces.
- `$$on` reads `ElementEvents`. `$$onWindow` and `$$onDocument` keep `WindowEventMap` and `DocumentEventMap`, with the same constraint.
- Callers: `brumate-tsc` on packages/ui flagged `onToastchange` in ToastRegion.brm. The event is real (toast.ts dispatches it), so toast.ts merges it into `ElementEvents`. The website and the 7 examples had no unknown event.
- Proved the checker fails: `onToastchang` in ToastRegion.brm gave TS2345 at the attribute (exit 2), reverted.
