# Outcome: template-context-types

## Built

- packages/brumate/src/check.ts: an untyped `#template` whose every read passes it to a prop of a component or dynamic tag (`item=row`, `item=(row)`, `{row}`) is written at each use as `item: (async (a): Promise<$$Markup> => { ...body... })`. The arrow takes the type of the prop, so `a` is typed, also when the component is generic (`V` of ListBox is inferred from `items`). The body and parameters are copied with their mappings at each use, so an error in the body points at its line and column in the .brm file.
  - `inlineTemplates()` picks the templates: untyped (a parameter without a type), with at least one prop use, and no other read in the scope that declares them. A parameter with the template's name (`#template item(item)`) hides it in its body, so it is not a read.
  - An inlined template keeps its name declared as `const row = $$template;`, mapped to the name in `#template row(...)`, and each use writes `$$use(row);` before the call, mapped to the name at the use. Hover, go to definition, references and rename on the name work from the template and from each use. Hover on the name shows `(...args: any[]) => Promise<$$Markup>`; hover on the parameter shows its type from the prop. Typed templates, templates without parameters, and templates that are called, read by the script, passed to an element or used in an expression keep the hoisted `async function`.
  - The generator keeps a stack of the names that each generated block declares (`#for` item and index, `#repeat` index, `#catch` names, block script declarations, declared templates, template parameters). At a use, if a name declared between the template's scope and the use is one the template reads, or the template passes itself, it throws `Hoist`, the template goes back to a declaration, and the file is written again.
- packages/typescript-plugin/src/index.ts wraps the Volar plugin and drops repeated diagnostics with `dedupeDiagnostics`, a new export of packages/language-core. Tested in packages/language-server/test/server.test.ts.
- website/tsconfig.json includes `ui/demos`, so `brumate-tsc` checks the 64 demos.
- packages/brumate/test/check.test.ts: 12 tests of the generated code: one use and two, shorthand, `#for` and `#if`, the mappings of the body and parameter at each use, typed and parameterless templates kept, other reads kept, a shadowed name kept, nested inline templates, a template that passes itself, a template of a block, `#template item(item)`, a template that calls itself, and the mappings of the declared name and of each use.
- packages/ui/test/generics-markup.test.ts: 3 brumate-tsc tests: the untyped fixture checks clean; `a.nope` is `Page.brm(14,9): Property 'nope' does not exist on type 'Animal'`; one template used with `animals`, `cars` and inside `#for` and `#if` reports only the car's missing `name`, at `(22,9)`.
- Docs: virtualizer.md and toast.md say that a TableBody and a ToastRegion template still need a typed parameter. Removed "a template parameter takes a type" from website/ui list-box, grid-list, tree, navigation-tree, select and data, and dropped the annotations in those samples, calendar, token-field and docs/components.md. components.md says the typed form is allowed and that a called template needs types. table.md keeps the annotation and says the TableBody does not get the type of the Table's items. Demos NavigationTreeDemo, DataDemo, TreeDemo, VirtualizerDemo and TokenFieldDemo dropped their annotations (website typecheck passes).
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
- The body of a template used twice is checked twice. brumate-tsc, the Volar language server and now the tsserver plugin each show the same error once.
- Hover and completions inside the body of a template used twice read the first copy, so they show the type from the first use.
- A TableBody does not infer `V` from its Table, and ToastRegion not from its queue: their templates still need a typed parameter.

## Proposed learnings

- A template passed to a prop needs no parameter types; one that is called does | the check writes prop-only templates inline | website, packages/ui | yes (brumate-tsc in generics-markup.test.ts)

## Verification

- Probe on main: TS7006 only. On the branch: `Property 'nope' does not exist on type 'Animal'` at (14,9).
- `npx tsdown` in packages/brumate, language-core, tsc, language-server, typescript-plugin.
- `npx tsc --noEmit` in brumate (and `-p tsconfig.elements.json`), language-core, tsc, language-server, typescript-plugin, vscode: exit 0.
- `npx brumate-tsc --noEmit` in packages/ui, website (with ui/demos) and the 7 examples: exit 0.
- `npx vitest run`: packages/brumate 1110 passed; packages/tsc 1 passed; packages/language-server 5 passed; packages/ui (`--maxWorkers=2`) 563 passed, 1 expected fail.
- `node scripts/check-samples.ts` in website: 63 samples, 0 problems.
- `npx oxlint`: exit 0, no new warnings. Root `npx oxfmt --check`: exit 0.
- `npx brumate-tsc --noEmit --extendedDiagnostics` in packages/ui: 7,698,025 instantiations on main and on the branch (+0%). Check time 8.5 to 10.7 s on both (shared machine). Website with the demos included: main 6,880,947, branch 6,883,002 (+0.03%).
- Editor features checked with a script on Volar's proxy language service (see the log).

## Size

- Estimated M, actual M.
