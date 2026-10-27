# Outcome: template-value-imports

## Built

- `importsFor` in packages/brumate/src/codegen/client.ts adds the imports that the non-deferred sites inside each rendered scope read (`isWithin(site.scope, scope)` and not `DEFERRED_SITES`). A component named only in an attribute value (`as=GapTarget`, `icon=GapTarget`, `as=(flag ? GapTarget : AsLink)`) is a read of such a site, but `componentNames` finds tags only. `generateRender` already took its names the same way.
- Fixtures in packages/brumate/test/render: GapPart.brm and GapTarget.brm, gapTemplate.brm, gapTemplateProp.brm (with gapTemplateHost.brm), gapTemplateChoice.brm and gapTemplateUnused.brm.
- Four tests in packages/brumate/test/resume.test.ts, in `describe('a template that names a component only in an attribute value')`. All names start with "gapTemplate:". The last one asserts that an import which the template does not use stays out of the template part.
- In packages/ui, "renders a template that names the component, for a folder that opens" (as-collections.test.ts) and "renders a Toast that is a component" (as-controls.test.ts) are `it` now.
- Changeset .changeset/template-value-imports.md, a patch for brumate.

GapPart.brm, written exactly (2-space indent, one trailing newline):

```
<script>
  import { $props, $signal } from 'brumate/signals';
  const { as, children, ...rest } = $props();
  let on = $signal(false);
</script>
<{as ?? 'div'} role="tab" aria-selected=(on) onClick=(() => (on = !on)) {...rest}>{children}</>
```

GapTarget.brm, written exactly:

```
<script>
  import { $props } from 'brumate/signals';
  const { children, ...rest } = $props();
</script>
<div data-target {...rest}>{children}</div>
```

## Deviations

- Added gapTemplateProp, gapTemplateHost, gapTemplateChoice and gapTemplateUnused fixtures, for the cases beyond `as=` that the orchestrator asked for. They are in the owned test/render folder.

## Stubs left

- None.

## Gotchas

- The remaining `it.fails` tests in as-collections.test.ts and as-controls.test.ts are other gaps (as-live-props, spread-children-live). Leave them.
- `npx oxfmt --check` at the root fails on docs/roadmaps/brumate/reviews/core-gaps-2.md, which this branch does not change.

## Proposed learnings

- Imports for a client part come from the reads of its sites and from the tags of its markup | a component named in an attribute value is only a read, so a rule that uses tags alone misses it | packages/brumate/src/codegen | yes

## Verification

- The four gapTemplate tests fail on main (`GapTarget is not defined`) and pass with the fix.
- `npx vitest run` in packages/brumate: 55 files, 976 passed, 5 expected fail.
- `npx vitest run --maxWorkers=2` in packages/ui: 56 files, 531 passed, 5 expected fail.
- `npx tsc --noEmit -p .` in packages/brumate: no errors.
- `npx oxlint --quiet` from the root: exit 0. `npx oxfmt --check`: exit 1 only for docs/roadmaps/brumate/reviews/core-gaps-2.md, not changed here.
- Self review: the source diff is one block in `importsFor`. It adds only import reads, so the unused-import test passes with AsLink left out.

## Size

- Gzip of the eager core with `npx tsdown`: `client-*.js` 31186 B, `produce-*.js` 4591 B. The change is in the compiler only, so the runtime chunks do not change. The budget is 0.1 kB.
- Estimated S, actual S.
