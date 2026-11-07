# Outcome: mathml-elements

## Built

- packages/brumate/elements.d.ts: the 30 tags of `MathMLElementTagNameMap` (all but `a`, which stays the HTML one) in `Elements`. Each has `GlobalAttributes` plus the global MathML attributes (`displaystyle`, `scriptlevel`, `mathvariant`, `mathcolor`, `mathbackground`, `mathsize`, `href`) and its own (`display` on `math`; `form`, `stretchy`, `lspace` and more on `mo`; `linethickness`, `accent`, `accentunder`, `columnspan`, `rowspan`, `encoding` and others).
- `ElementOf` and `$$Element` in packages/brumate/src/check.ts read `MathMLElementTagNameMap` after HTML and SVG, so `currentTarget` is a `MathMLElement`.
- packages/brumate/test/elements-types.ts: valid cases, a wrong attribute, a bad `display`, an attribute of another tag, and a handler whose `currentTarget` is a `MathMLElement` and not an `HTMLElement`.
- contracts/element-types.md is v1.5 with the change entry. .changeset/mathml-elements.md (minor).
- Type shape: follows Solid's split of MathML into global attributes plus per-tag attributes, with tags from MathML Core and the lib.dom map, as Svelte and React type handlers on the DOM interface of the tag.

## Deviations

- None. check.ts is in the brief's shared paths.

## Stubs left

- None.

## Gotchas

- `mathvariant` takes only `normal`, as in MathML Core (the legacy values are not in Core).
- `mathsize`, `mathcolor`, `mathbackground`, `maction` `actiontype` and `selection` are legacy but still read by browsers, so they are kept.
- `<semantics>` and `<annotation>` have no extra attributes beyond `encoding`.

## Proposed learnings

- None.

## Verification

- `tsc --noEmit -p .` and `-p tsconfig.elements.json` in packages/brumate: exit 0. The new `@ts-expect-error` lines fail on main, where the MathML tags are not in `Elements`.
- Full check: see the report of the worker.

## Size

- Estimated S, actual S. Types only, no runtime change.
