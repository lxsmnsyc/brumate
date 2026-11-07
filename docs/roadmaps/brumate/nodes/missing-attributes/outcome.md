# Outcome: missing-attributes

## Built

- packages/brumate/elements.d.ts has the attributes that were missing:
  - `meter form`, `dialog closedby` (`any | closerequest | none`), `style type` (`text/css | ''`).
  - `template`: `shadowrootclonable`, `shadowrootdelegatesfocus`, `shadowrootserializable`, `shadowrootcustomelementregistry`.
  - Every element: `exportparts`, and the microdata attributes `itemid`, `itemprop`, `itemref`, `itemscope`, `itemtype`.
  - SVG elements: `xlink:href` and `xml:lang`.
  - Typed values: `link as` (22 destinations), `script type` (`importmap | module | speculationrules` or any string), `meta http-equiv` (5 values), `iframe sandbox` (14 tokens, `''` or a list), `autocomplete` of `input`, `textarea` and `select` (autofill field names, `on`, `off`, boolean, or any string for `section-*` forms), `button command` (6 commands or `--custom`), and `blocking` of `link`, `script` and `style` (`render` or any string).
  - `autocorrect` was already a global attribute, so it is unchanged.
- packages/brumate/test/elements-types.ts has a valid case for each group and an expected error for the closed ones (`closedby`, `shadowroot*` on `div`, the namespaced names).
- .changeset/missing-attributes.md (minor).
- The lists come from the HTML Standard (autofill field names, sandboxing flag set, `dialog`, `button command`, `template`, `meta http-equiv`, microdata, `link as` destinations) and MDN. They were checked against lib.dom property types (`HTMLMeterElement.form`, `HTMLDialogElement`, `HTMLTemplateElement`, `HTMLLinkElement.as`).

## Deviations

- RDFa (`about`, `typeof` and others), `elementtiming`, and the Chromium-only `iframe credentialless`, `csp` and `browsingtopics` are not added: they are not in the HTML Standard. The brief did not list them.
- `blocking` is narrowed to `render` on `link`, `script` and `style`, which the brief did not name. It follows the standard.

## Stubs left

- None.

## Gotchas

- The typed values keep their known names for completions and accept any other string (`Known | (string & {})`), as `target` does. No value set rejects a string, so there are no expected-error cases for them.
- `xlink:href` is deprecated in SVG 2 but is listed because the brief asks for it.

## Proposed learnings

- None.

## Verification

- On the old elements.d.ts, `tsc --noEmit` in packages/brumate gives 11 errors with the new cases; now 0.
- `pnpm build`, `pnpm lint` (warnings only), `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test` (3018 passed): pass.

## Size

- Estimated S, actual S.
