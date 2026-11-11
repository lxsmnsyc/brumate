---
id: block-styles-scope
title: Styles in blocks, scoping and first render
status: active
priority: must
type: feature
story:
early: false
outline: false
milestone: 0.8.0
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/styles/block-styles.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-09
spent:
owns:
  - packages/brumate/src/css.ts
  - packages/brumate/test/styles/block-styles.test.ts
shared:
  - packages/brumate/src/ast.ts
  - packages/brumate/src/parser.ts
  - packages/brumate/src/plan.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/test/error-codes.json
  - website/docs/errors.md
  - packages/brumate/skills/brumate/references/errors.md
  - packages/language-core/src/index.ts
reserves: []
provides: []
depends_on: []
---

# Styles in blocks, scoping and first render

## Goal

A `<style>` in a block body is parsed, scoped to the elements of that block and of the blocks inside it, and sent with the stylesheet of the component. Its `${}` reads what is in scope at the block (block script values, enclosing blocks, the component) and is written as custom properties on the top-level elements of each instance when the block renders, on the server and in the browser. Updates after a value changes are the node block-styles.

```brm
#for (tag of tags by tag.id) {
  <span class="tag">{tag.name}</span>
  <style>
    .tag { background: ${tag.color}; }
  </style>
}
```

## Context

- Source: [Styles in blocks](../../../../proposals.md#styles-in-blocks). The proposal fixes the scope rules and the compile; this node builds the parse, the scope and the first render.
- Today a `<style>` is top level only. `parseNodes` fails for any mode but `file` (packages/brumate/src/parser.ts:242-247, BRM011 at error-catalog.ts:97). `parseBody` reads one leading `<script>` and no style (parser.ts:848-860). `Body` has `script`, `templates` and `children` (ast.ts:158); `Style` and `SFCFile.styles` are at ast.ts:17-35.
- `compileStyles(file, scope, filePath)` (css.ts:336) loops over `file.styles`, names one attribute `b-c-<hash>` and the custom properties `--s-<hash>-<n>`, runs postcss and `scopeRules` (css.ts:127-191), and records `targets` so a build puts the attribute only on elements a selector could match (`needsScope`, css.ts:44; `hasScope`, codegen/markup.ts:2517). `<style global>` passes `unscoped` (style-global outcome).
- `plan.ts:802` calls it once per file. `analyze.ts:464-468` makes one `style` site per `${}` on the component scope; a block style needs the site on the scope of its block.
- The sheet is written once per page by `emitComponentContent` (markup.ts:1744). The scope attribute is written in markup.ts at about 2237, and the variables go in `emitVariables` (markup.ts:2125), which skips elements with `this.nesting > 0`, so only top-level elements of the component carry them. Spreads and components have their own paths (markup.ts:2772, 2805, 2827; client.ts:1292-1295).
- A block script is read at the start of the body only; how its `let` is scoped is the pattern to follow for names (`bodyScopes` in plan.ts, `emitBody` in markup.ts:1763).
- Decisions apply: a `<style>` in markup is an error today, so nothing that works changes. `<style global>` stays top level only (docs/decisions.md, style-global entry), and `:global(...)` in a block style is a compile error (proposal).
- Prior art: Svelte 5 and Vue SFC scope one style per file. Per-block styles have no direct prior art; the scope rule is the proposal's.
- The custom properties and `b-v` of live updates belong to block-styles. Do not add runtime files here.

## Steps

- [ ] Probe on `release/0.8`: a test page with a `#for` whose body has a script and a `${}` read in a component-level style. Record what the component style does for rows (values on top-level elements only) so the new behavior is told from it.
- [ ] Parser: allow `<style>` at the top level of a body (before or after the markup, as in the proposal), collect it in `Body.styles`. Keep BRM011 for a style inside an element, and reword its catalog text ("at the top level of the file or of a block"). `<style global>` in a block gets its own error code (take the next free `BRM2xx` in error-catalog.ts). `:global(...)` in a block style gets one too.
- [ ] css.ts: compile the style of each body with its own attribute `b-c-<hash>-<n>` (n counts blocks with a style in source order) and its own targets and `--s-<hash>-<n>` names. The sheet joins the component's CSS, outer rules first and inner blocks after, in source order, so the inner rule wins at equal specificity.
- [ ] Markup: elements of the block, and of blocks inside it, get the attribute of every block style around them, plus the component's. Children that the block passes to a component do not (they belong to the component that wrote them). A `#template` body is a block of its own.
- [ ] `${}` in a block style is a site on the block's scope. Write its custom properties on the top-level elements of the block instance (the `nesting` of the body, not of the component), with `vars()` as the component does, on the server and in markup that the browser renders. Spreads and component roots follow the existing rules.
- [ ] language-core: the style blocks of a block get their own virtual code (src/index.ts:50 reads `parse().styles`; expose the block styles with their offsets).
- [ ] Tests, then the error docs are regenerated with `UPDATE_SKILL=1` (see the style-global outcome).

## Acceptance

- [ ] A probe test on `release/0.8` is in the log before the parser changes.
- [ ] Render tests in `packages/brumate/test/styles/block-styles.test.ts` (fail on main, pass here) show: a rule in a `#for` style matches the rows' elements and carries the block attribute; it does not match an element of the component outside the block or a sibling block; a nested block's elements carry both attributes; an inner rule comes after an outer one in the sheet; an `#if` branch style matches only its branch; a `#template` body is its own scope; `${tag.color}` and a block-script value come out as custom properties on each row's top-level elements, with different values per row; an element passed through `{children}` does not get the attribute.
- [ ] Compile errors with tests: `<style global>` in a block, `:global(...)` in a block style, `<style>` inside an element (BRM011), an unknown attribute.
- [ ] `lang="scss"` and `lang="less"` work in a block style, as at top level.
- [ ] The `<style>` of the component still behaves as before: the existing `test/styles.test.ts` passes unchanged.
- [ ] language-core test or sample: a block style gets CSS features in the editor.
- [ ] No docs page and no changeset here; block-styles writes them.
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/styles`. Then `pnpm lint`, `pnpm format:check`, `pnpm typecheck` (CI checks).

## Sizing

M. Uncertainty medium (component styles are the pattern, per-block attributes are new). Blast radius medium: parser, plan and `codegen/markup.ts`, which other open nodes edit (run `plan.py impact block-styles-scope`). Size medium: about 8 source files plus generated error docs.

## Notes for the worker

- Count the number of blocks with a style in source order, not by depth, so the attribute names are stable when markup changes elsewhere.
- In development every element of a component with styles gets the attribute (`hideNames` false), so hot reload works. Keep that for block attributes.
- Do not edit the live path (`setVar`, `b-v`): block-styles does. If the first render needs `b-v` on block elements to avoid a mismatch, write it and say so in the outcome.
- New error codes collide when two nodes add them at once. Take the next free ones when you start, and regenerate `error-codes.json` and both `errors.md` files at the end.
