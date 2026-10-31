# Outcome: visible-forwarded-ref

## Built

- A `$client(fn, 'visible')` that reads an element through a forwarded `ref` waits for that element to come into view, also when a component relays the binding.
- The element that a component forwards gets `b-r="S.slot"` (server render only). The caller's `<template>` gets `b-near="S.slot"` for a visible callback that reads a signal passed with `$bind`. The loader (boot.ts) looks for `[b-b=near],[b-r=near]`.
- `refKey` and `bound` on the server render context (runtime/server.ts). `bound` records the bound props before the markup renders.
- Resume test `runs a visible $client callback when the element that a component forwards comes into view`, with test/render/refVisibleForward.brm. Verify command passes.
- Patch changeset `.changeset/visible-forwarded-ref.md`, and website/docs/components.md no longer lists the gap (only rest-props `ref` remains).
- Size, gzip of the todos client JS: main 29801 B, branch 29805 to 29807 B, +4 to +6 B (limit 0.3 kB).

## Deviations

- Edited packages/brumate/src/runtime/server.ts (not owned) because the caller cannot know the element: the server must resolve the binding chain. plan.ts was not needed.
- website/docs/components.md edited as the task asked.

## Notes

- `ref` left in rest props has no marker, so its callback still waits for the element after it.
- A signal passed with `$bind` to a non-ref prop also gets a `b-near` that finds no element and falls back; this costs a few bytes of HTML.
- `pnpm format:check` fails on docs/roadmaps/brumate/archive.md on main already.
