# Outcome: template-context-types

## Built

- packages/brumate/src/check.ts: an untyped `#template` whose every read passes it to a prop of a component or dynamic tag (`item=row`, `item=(row)`, `{row}`) is written at each use as `item: (async (a): Promise<$$Markup> => { ...body... })`. The arrow takes the type of the prop, so `a` is typed, also when the component is generic (`V` of ListBox is inferred from `items`). The body and parameters are copied with their mappings at each use, so an error in the body points at its line and column in the .brm file.
  - `inlineTemplates()` picks the templates: untyped (a parameter without a type), with at least one prop use, and no other read in the scope that declares them. Typed templates, templates without parameters, and templates that are called, read by the script, passed to an element or used in an expression keep the hoisted `async function`.
  - The generator keeps a stack of the names that each generated block declares (`#for` item and index, `#repeat` index, `#catch` names, block script declarations, declared templates, template parameters). At a use, if a name declared between the template's scope and the use is one the template reads, or the template passes itself, it throws `Hoist`, the template goes back to a declaration, and the file is written again.
- packages/brumate/test/check.test.ts: 9 tests of the generated code: one use and two, shorthand, `#for` and `#if`, the mappings of the body and parameter at each use, typed and parameterless templates kept, other reads kept, a shadowed name kept, nested inline templates, a template that passes itself, a template of a block.
- packages/ui/test/generics-markup.test.ts: 3 brumate-tsc tests: the untyped fixture checks clean; `a.nope` is `Page.brm(14,9): Property 'nope' does not exist on type 'Animal'`; one template used with `animals`, `cars` and inside `#for` and `#if` reports only the car's missing `name`, at `(22,9)`.
- Docs: removed "a template parameter takes a type" from website/ui list-box, grid-list, tree, navigation-tree, select and data, and dropped the annotations in those samples, calendar, token-field and docs/components.md. components.md says the typed form is allowed and that a called template needs types. table.md keeps the annotation and says the TableBody does not get the type of the Table's items. Demos NavigationTreeDemo, DataDemo, TreeDemo, VirtualizerDemo and TokenFieldDemo dropped their annotations (website typecheck passes).
- Changeset .changeset/template-context-types.md (patch, brumate).
- This fixes the first gotcha of nodes/ui-generics/outcome.md ("a template parameter needs this annotation"). I did not edit that file: it is another node's.

## Deviations

- The type-checked .brm test is in packages/ui/test/generics-markup.test.ts (a shared path), not packages/brumate/test/check/templateContext*.brm: brumate has no type checker it can run on a .brm file (TypeScript 7 has no JS API, and brumate-tsc lives in packages/tsc). The brumate tests check the generated code and mappings.
- website/ui/date-field.md keeps `part(segment: Segment)`: ui-date-i18n edits that page now. Untyped works there (checked with DateInput).

## Stubs left

- None.

## Gotchas

- A template that is both passed to a prop and read another way (called, or `cond ? row : other`) stays a declaration, and its untyped parameter is still `any` (TS7006 under `strict`). Same when a `#for` item or another name at the use hides a name that the template reads.
- An inline template passed to a component with untyped props (`Record<string, any>`) gets `any` silently, as `item=(a => ...)` does. Before it was TS7006.
- The name at the use (`item=row`) is no longer emitted, so hover and go to definition on it do not reach the template.
- The body of a template used twice is checked twice. brumate-tsc and the Volar language server dedupe the same error at the same place; the tsserver plugin may show it twice.
- A TableBody does not infer `V` from its Table, and ToastRegion not from its queue: their templates still need a typed parameter.

## Proposed learnings

- A template passed to a prop needs no parameter types; one that is called does | the check writes prop-only templates inline | website, packages/ui | yes (brumate-tsc in generics-markup.test.ts)

## Verification

- Probe on main: TS7006 only. On the branch: `Property 'nope' does not exist on type 'Animal'` at (14,9).
- `npx tsdown` in packages/brumate, language-core, tsc, language-server.
- `npx tsc --noEmit` in brumate (and `-p tsconfig.elements.json`), language-core, tsc, language-server, typescript-plugin, vscode: exit 0.
- `npx brumate-tsc --noEmit` in packages/ui, website and the 7 examples: exit 0.
- `npx vitest run`: packages/brumate 1107 passed; packages/tsc 1 passed; packages/ui (`--maxWorkers=2`) 563 passed, 1 expected fail.
- `node scripts/check-samples.ts` in website: 63 samples, 0 problems.
- `npx oxlint`: exit 0, no new warnings. Root `npx oxfmt --check`: exit 0.
- `npx brumate-tsc --noEmit --extendedDiagnostics` in packages/ui: 7,698,025 instantiations on main and on the branch (+0%). Check time 8.5 to 10.7 s on both (shared machine).

## Size

- Estimated M, actual M.
