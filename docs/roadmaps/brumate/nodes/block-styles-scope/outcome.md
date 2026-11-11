# Outcome: block-styles-scope

## Built

A `<style>` at the top level of a block body is parsed, scoped, sent with the stylesheet, and its `${}` values go
on the top-level elements of each instance on the server and in markup that the browser renders. Updates after a
value changes are not built (block-styles).

Names

- Attribute of the component: `b-c-<hash>` (as before). Attribute of a block: `b-c-<hash>-<n>`, `n` from 1, one per
  body that has a style, counted in source order of the body (`{` position), outer before inner. A body with two
  `<style>` elements shares one attribute and one numbering of variables.
- Custom properties of the component: `--s-<hash>-<k>` (as before). Of a block: `--s-<hash>-<n>-<k>`, `k` counts the
  `${}` of that block from 0.
- The sheet is `component rules, then block rules` in `n` order, so an inner rule comes after an outer one.

Where

- packages/brumate/src/ast.ts: `Body.styles`, `SFCFile.blockStyles`, `bodyTree(file)` (parent body and `top` flag
  of every body), `blockBodies` (moved from plan.ts, still exported from there).
- packages/brumate/src/parser.ts: `parseNodes` takes a `styles` list for body mode; `parseStyle(inBlock)`;
  `parseBody` fills `Body.styles`; `#reveal` rejects a style.
- packages/brumate/src/css.ts: `compileStyle` (one style), `bodyStyles` (what each body takes), `compileStyles`.
  New on `StyleOutput`: `blocks: BlockStyle[]` (`body`, `attribute`, `variables`, `targets`), `bodies: Map<Body,
  BodyStyles>` and `hasComponentCss`. `BodyStyles.attributes` are the block styles whose attributes the elements of
  the body get (own and enclosing, outermost first). `BodyStyles.variables` are the block styles whose variables go
  on the top-level elements of the body (own, and enclosing ones the body is at the top level of).
- packages/brumate/src/analyze.ts `visitBodyContent`: one `style` site per block `${}` on the scope of the body
  (a `#template` body has its template scope).
- packages/brumate/src/plan.ts: `liveStyles` counts component style sites only.
- packages/brumate/src/codegen/markup.ts: `scopeAttributes`, `variableValues(scope)`, `blockStyles`, `bodyBase`,
  `emitBody` (sets `bodyBase`), `atTopLevel` (resets it), `emitLiveStyles`; the element and dynamic tag paths use them.
- packages/brumate/src/codegen/client.ts: spreads keep the block attributes as the element's own; `prologue`
  declares the outer values that a block style reads for the render functions that carry its variables.
- packages/brumate/src/check.ts: `$$use` of block style expressions inside the body, so the editor checks them.
- packages/brumate/src/print.ts: block styles in the printed tree.
- packages/language-core/src/index.ts: `styleCodes` adds `blockStyles` after the styles of the file
  (`style_<index>`, offsets of the file).
- Tests: packages/brumate/test/styles/block-styles.test.ts (19 tests), and a block style case in
  packages/language-server/test/server.test.ts.

Behavior

- Elements of the body and of the bodies inside it get the attribute of every block style around them, and the
  component's if it has a style. In a build (`hideNames`) a block attribute is written only on elements that a
  selector of that block could match (`needsScope` with the block's `targets`). In development every element gets it.
- A `#template` body is its own block with its own attribute. It also takes the attributes of the bodies it is
  declared in (lexical), but never their variables, since it renders where it is called.
- `{children}` that a parent passes in were written in the parent, so they carry the parent's attributes, not the
  block's. Children written inside a block and passed to a child component do carry the block's attributes, as
  they carry the component's (the brief says they do not; see Deviations).
- Variables go on an element at the top level of its body (`nesting === bodyBase`, the nesting at which the body
  began). In server mode nesting counts all elements around, so a `#for` inside a `<div>` puts its variables on its
  own rows. In browser render functions every body is its own emitter, so nesting starts at 0. A body at the top
  level of another (no element between, `bodyTree().top`) also puts the outer block's variables on the same
  elements, so one element can hold several blocks' variables. Children of components and dynamic tags (`atTopLevel`)
  are treated as top-level, as the component's variables already were.
- Spreads and dynamic tags use the same variable object as before (`$$b.vars` after the merge).
- `b-v` is not written for block variables. The first render in the browser never reads the server markup of a
  block again (resume does not rerender), so no mismatch needs it. block-styles decides what marks the elements
  (the instance scope of the block is `$$s<scope.id>` of `plan.bodyScopes.get(body)`). `liveStyles` and the
  existing `b-v` stay for the component only, and are written only on elements that carry component variables.

Errors (new)

- BRM205 `<style global>` in a block. BRM206 `:global(…)` in a block style (checked on the compiled CSS, so a rule
  made by SCSS or Less nesting counts). BRM207 `<style>` in a `#reveal`, which has no scope.
- BRM011 reworded to "<style> must be at the top level of the file or of a block" (same code; test/error-codes.json
  edited by hand for that line). An unknown attribute is still BRM189.
- `error-codes.json`, `website/docs/errors.md` and `skills/brumate/references/errors.md` regenerated.

## Proof

Not a fix. The probe on the base is in log.md: a block style failed with BRM011, and a component style put the same
value on every row.

## Deviations

- Touched, outside owned and shared paths, with the smallest edit: packages/brumate/src/check.ts (type-check of
  block `${}`), packages/brumate/src/print.ts (tree printout), packages/brumate/src/vite.ts (`getMarkup` removes block
  styles from the markup shape, one line), packages/brumate/src/codegen/client.ts (prologue and spread attributes),
  packages/language-server/test/server.test.ts (the editor test; language-core has no test folder).
- Children that a block writes and passes to a component carry the block attributes (the brief says they do not).
  The proposal and the acceptance only exclude `{children}` written elsewhere, which holds. Dropping them would
  differ from how the component style treats the same children.
- `StyleOutput.css` now holds block CSS too. Code that asks "does this component have a style" uses
  `hasComponentCss` (markup.ts `hasScope`).
- Custom property names for blocks are `--s-<hash>-<n>-<k>`, not `--s-<hash>-<n>`, so they cannot meet the
  component's `--s-<hash>-<k>`.

## Stubs left

- Block style sites (`site.kind === 'style'`, `site.scope.body` set) emit no update function: `client.ts` looks the
  variable up in `plan.styles.variables`, which holds the component's only. block-styles adds the update, the
  `setVar` target and the resume. The site exists, so `isLiveSite(site)` already says which blocks change.

## Gotchas

- `plan.styles.blocks[i].variables[j].expression.ast` is the `site.node` of the block's style site.
- `plan.styles.bodies.get(body)` is undefined for a body that no block style reaches. `scope.body` is set for
  `body` and `template` scopes only.
- `emitBody` sets `bodyBase`; any new path that emits a body in a new emitter starts at nesting 0.
- A template used from a `#for` body has its own variables on its own top-level elements and not the loop's.
- The test harness writes server modules to `test/.output/block-styles/` (ignored by git as the other outputs).
- A lone `<style>` in a body does not need a `<script>`; the order is free, the script first only if there is one.
- Full-suite run: 3 `test/devtools.test.ts` tests failed once under load, passed alone.

## Proposed learnings

- Compare "does the component have a style" with `hasComponentCss`, never with `styles.css` | `css` also holds block rules | packages/brumate/src/codegen | no

## Verification

- `pnpm --filter brumate exec vitest run test/styles`: pass (block-styles 19 tests, styles.test.ts unchanged).
- `UPDATE_SKILL=1 npx vitest run` in packages/brumate: 3156 passed; 3 devtools tests failed under load, pass alone.
- `npx vitest run test/server.test.ts` in packages/language-server: pass (after building brumate and language-core).
- `pnpm format:check`: pass. `pnpm lint`: no errors (warnings in files I did not touch).
- `pnpm typecheck` (after `pnpm build`): pass.

## Size

- Estimated M, actual M.
