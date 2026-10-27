# Checkpoint 2026-10-27, wave 4

## Merged since the last checkpoint

- as-sound (#271), as-collections (#272), as-controls (#273): `as` and `ref` on 28 parts. #272 broke tree.test.ts on main through a fixture that spread onto TreeItem; fixed on main in 0f02513e.
- split-client-runtime (#274): client.ts is 21 modules under runtime/client/. client-modules is frozen at v2, with a fixed import order (no cycles).
- ref-type-parts (#275), ref-reaches-element (#280), ref-from-as (#284): a part's `ref` is in its own props, reaches its element, and takes the element type of `as` (`TargetElement<T>`). part-props is v1.4. The typing is strict, as Solid 2.0's variable form: a signal binds only with the element type or narrower.
- Core fixes for a component in `as`: template-value-imports (#276), bound-element-signal (#277), as-live-props (#278), as-passed-on (#285), spread-children-live (#281).
- Types: element-values (#279, element-types v1.1), event-names (#283).

## Open

- ordered-updates (#282): ready for the maintainer. Two fresh reviews; all findings fixed. Todos +295 B gzip (budget 300 B). A write to 10000 rows is about 1.2x main.

## Added nodes

- core-correct: style-vars-target, rest-ref-spread, component-tag-spread.
- ui-0.1, from the type audit in reviews/type-parity.md: mathml-elements, aria-types, control-target, missing-attributes, dynamic-tag-types. element-checks now waits for element-values and event-names.

## Next

- After #282: rest-ref-spread, component-tag-spread, style-vars-target (must), then batching and fields-typed-early.
- ui-0.1: aria-types, mathml-elements, ui-generics, docs-generator.

## Notes

- Workers skipped the self-review step twice, so every PR got a fresh reviewer. The reviews found real bugs in #278, #279, #281 (three rounds) and #282 (two rounds).
- A redo of a node goes on its existing PR's branch, not a new PR (#252 and #272 both existed for as-collections).
- Several ui tests (as-collections "ref", tooltip delay, tree Right/Left) fail once under heavy machine load and pass alone. CI stays green.
- The main checkout's `.bin` shims broke once more, from a reviewer's worktree. Rebuilt with `pnpm install --frozen-lockfile --force`.
