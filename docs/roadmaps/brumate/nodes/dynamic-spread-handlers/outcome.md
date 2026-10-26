# Outcome: dynamic-spread-handlers

## Built

- `dynamic` and `dynamicNodes` in packages/brumate/src/runtime/client.ts write the start tag of an element through a new helper, `startAttributes`. It writes the attributes with `spread(rest, on)`, and adds one `b-on` with `onAttribute(on, own)`. `own` is the `b-on` that the compiler passes for the handlers of the tag, and the entries in `on` are those of the spreads, as the plain element path and the server `dynamic` write them. Entries are escaped by `onAttribute`.
- Tests in packages/brumate/test/resume.test.ts, in `children`:
  - a dynamic tag keeps the handlers of a spread when the browser renders it (the test of core-gaps.md section 4, fixture dynamicKeys.brm);
  - a list of dynamic tags that the browser renders (dynamicKeysEach.brm);
  - the `b-on` is escaped, with the own handlers first, and `prevent` with the key `"` and a `$handler` argument with quotes, `&` and `<` work (dynamicKeysArgs.brm);
  - a dynamic tag that changes from `div` to `section` keeps its handlers, and its `b-on` is escaped (dynamicKeysSwap.brm).
- `dynamicKeys.brm`, `dynamicKeysArgs.brm`, `dynamicKeysEach.brm` and `dynamicKeysSwap.brm` in packages/brumate/test/render/.
- Changeset .changeset/dynamic-spread-handlers.md, a patch.

## Deviations

- Three more fixtures than the brief names, to reach both client paths: `dynamicNodes` (clone) is taken by dynamicKeys, Args and Each, and `dynamic` (HTML string) by Swap. The brief owns only dynamicKeys.brm.

## Stubs left

- None.

## Gotchas

- A bug remains on main, not caused by this fix: when the browser renders a dynamic tag whose tag is a component, and that component puts its own handler on the element it spreads onto, the caller's handler is lost. The client `spread` does not keep an incoming `b-on`, and `setOn` overwrites it. The client also does not add the scope to the `b-on` entries of a component tag, as the server `dynamic` does. The roadmap node component-tag-handlers fixes it.
- `startAttributes` takes `b-on` out of the attributes first. Without that, `spread` would write the own `b-on` and `onAttribute` a second one, and the browser keeps the first.

## Proposed learnings

- A function of client.ts that writes the start tag of an element goes through `spread(attributes, on)` and `onAttribute`, never `spreadText` alone | `spreadText` skips `on*` entries, so the handlers get no `b-on` | packages/brumate/src/runtime | yes, a resume test with a spread of `$handler`

## Verification

- The four new tests fail on main (4 failed) and pass with the fix.
- `npx vitest run` in packages/brumate: 55 files passed, 944 tests passed, 5 expected fails (the `it.fails` of ordered updates). Exit 0.
- `npx tsc --noEmit -p .` in packages/brumate: no errors.
- `npx oxlint` and `npx oxfmt --check` from the root: exit 0.

## Size

- Eager core, gzip level 9, `client-*.js` + `produce-*.js` of dist from `npx tsdown`: before 30748 + 3863 = 34611 bytes, after 30843 + 3863 = 34706 bytes. Growth 95 bytes, 0.095 kB, within the 0.1 kB budget. produce is unchanged.
- Estimated S, actual S.
