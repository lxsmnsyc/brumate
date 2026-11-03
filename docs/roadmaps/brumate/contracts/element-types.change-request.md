# Change request: element-types v1 to v1.1

- From node: the type audit of 2026-10-27 (reviews/type-parity.md)
- Status: accepted

## Problem

`Elements` rejects values that the runtime and the syntax accept: `class` arrays and objects, `style` objects, `value` on `select`, `value=$bind` and `checked=$bind`, a server function in `form action`, and static strings for number attributes such as `tabindex="0"`. Once element-checks checks plain elements, each becomes a false error.

## Proposed change

Widen those types, as reviews/type-parity.md section 4 B lists, export the handler type, and add `KeyPress` in place of `ToggleEnd`.

## Affected nodes

element-values (writes it), element-checks, mathml-elements, aria-types, missing-attributes, control-target.

## Workaround in place

None. Nothing checks plain elements yet.

## Decision

Accepted by the maintainer on 2026-10-27. The node element-values makes the change and bumps the contract to v1.1.

---

# Change request: element-types v1.2 to v1.3

- From node: camel-event-names (PR #317)
- Status: accepted

## Problem

The Behavior rule for handlers says the markup writes an event in camel case (`onKeyDown`) or as the event name (`onKeydown`). The maintainer asked for camel case as the one form on 2026-10-27.

## Proposed change

- The handler rule becomes: a handler is `on` plus the event, in camel case only. The lower-case form of an event of more than one word (`onKeydown`) is a compile error at the attribute, reported by the parser, and not an attribute in the types. Events of one word (`onClick`) are unchanged.
- `ElementEventNames` is a new public export of `brumate/elements`: an interface from the lower-case event to its camel word (`keydown: 'KeyDown'`). An app that merges a custom event of several words into `ElementEvents` merges its camel word here (`itemaction: 'ItemAction'`). Without an entry the attribute keeps the one-word name (`onItemaction`).
- `Handlers<E>` accepts fewer keys: the lower-case keys of the events of several words are gone. It is one mapped type over `ElementEvents`, named through `ElementEventNames`.

## Affected nodes

Every node that writes a handler of an event of several words, and any app that merges custom events. In this repo the PR renames them all.

## Workaround in place

None needed. The PR changes the types and the parser at once.

## Decision

Accepted by the maintainer on 2026-10-28. PR #317 makes the change, and the contract is v1.3.

---

# Change request: element-types v1.4 (from aria-types)

## Problem

`aria-*` takes any string, number or boolean, and `role` any string, so a wrong value such as `aria-expanded="yes"` or an unknown role type-checks.

## Proposed change

- Each `aria-*` attribute of WAI-ARIA 1.2 has its own type, in `AriaAttributes` (exported from `brumate/elements`, and part of `GlobalAttributes`). Booleans take `boolean | 'true' | 'false'`, since the runtime writes both as words. `aria-checked` and `aria-pressed` also take `'mixed'`. `aria-current`, `aria-haspopup` and `aria-invalid` take their tokens plus a boolean. Counts, levels and values take `number | \`${number}\``. ID lists and text are strings.
- `role` takes `AriaRole`, the 83 roles of WAI-ARIA 1.2 and the `doc-*` roles of DPUB-ARIA, or a space-separated fallback list that starts with one (`role="doc-footnote listitem"`), as HTML allows. An unknown first role is an error.
- `aria-${string}` still takes `string | number | boolean` for a name not in the list, such as the deprecated `aria-dropeffect` and `aria-grabbed`.
- Tests: packages/brumate/test/elements-types.ts, section "ARIA attributes".

## Affected nodes

missing-attributes and control-target (0.7.0) build on these types. Callers that pass `String(flag)` or keep a role in a `string` variable narrow it; in this repo #442 changes 5 of them.

## Workaround in place

None needed. #442 changes the types and the callers at once.

## Decision

Accepted by the orchestrator on 2026-11-03, with the fallback list of roles from the review of #442. The contract becomes v1.4 when #442 merges.
