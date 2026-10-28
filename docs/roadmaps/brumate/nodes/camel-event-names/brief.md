---
id: camel-event-names
title: Event attributes are written in camel case only
status: done
priority: should
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/tsc/test/fixture/src/EventCase*.brm
shared:
  - .changeset/*.md
  - packages/brumate/elements.d.ts
  - packages/brumate/src/check.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/forms/**
  - packages/brumate/test/**
  - packages/tsc/test/tsc.test.ts
  - packages/ui/src/**
  - packages/ui/test/**
  - website/**
  - examples/**
  - docs/decisions.md
reserves: []
provides: []
depends_on:
  - on: element-checks
    kind: hard
    why: it rewrites how check.ts checks element attributes and handlers, which this node narrows
---

# Event attributes are written in camel case only

## Goal

An event of more than one word is written in camel case: `onFocusOut`, `onKeyDown`, `onPointerDown`, `onDblClick`. Today elements.d.ts (`CamelEvent`, near line 150) accepts both `onKeyDown` and `onKeydown`, because the compiler lower-cases the name, and the repo mixes them: `onFocusout` in brumate/forms (`createForm` attrs), website/src/components/Search.brm, website/docs/forms.md, and `onKeydown` in packages/brumate/test/elements-types.ts. Make camel case the one form. The maintainer asked for it on 2026-10-27.

## Context

- No deprecation period (the maintainer's rule): the lower-case form of a multi-word event becomes an error at once, with a catalog entry whose fix names the camel form. Decide whether the error comes from the types alone (drop the lower-case keys from `ElementProps`) or also from the compiler, and prefer the one with a clearer message at the attribute.
- One-word events stay as they are: `onClick`, `onInput`.
- Events an app merges into `ElementEvents` (event-names, #283) have lower-case names, such as `itemaction`, so the types cannot split the words. Today they reach `ElementProps` only as `onItemaction`. Find a way to give them a camel name (for example a second map from camel name to event, or a declared camel key) and write it in docs/decisions.md. ToastRegion's `toastchange` is one such event.
- The `createForm` attrs object is public API: `onFocusout` becomes `onFocusOut`. Say so in the changeset.
- Check `<window>` and `<document>` handlers and component handler props too.

## Acceptance

- [ ] The brumate-tsc fixture reports `onKeydown` and `onFocusout` on an element at the attribute, with the camel name in the message, and accepts `onKeyDown` and `onFocusOut`.
- [ ] A merged custom event has a camel attribute name, and its handler gets the event type.
- [ ] `git grep` finds no lower-case multi-word event attribute in packages, website or examples.
- [ ] Every package, the website and the examples type-check; the brumate, tsc and ui suites pass.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: the types and one error, the custom-event mapping, and a rename across the repo.
