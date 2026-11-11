# Log: block-styles-scope

## 2026-11-11 Probe on the base (release/0.8, aa8650ae)

A component with a `<style>` (`.tag { background: ${base}; }`), a `#for (tag of tags by tag.id)` whose
body has a `<script>` and `<span class="tag">`, and a `<p class="tag">` after it. Rendered on the server:

```
.tag[b-c-kt955c] { background: var(--s-kt955c-0); }
<span b-c-kt955c style="--s-kt955c-0:green" class="tag">a</span>
<span b-c-kt955c style="--s-kt955c-0:green" class="tag">b</span>
<p b-c-kt955c style="--s-kt955c-0:green" class="tag">out</p>
```

- One attribute for the whole file, one `--s-<hash>-<n>` per `${}`, in the component scope.
- Rows are top-level elements (the `#for` is at nesting 0), so they carry the component's variables, the same
  value on every row. The block script's value is not reachable from the style.
- A `<style>` in the `#for` body fails with BRM011 today (`parseNodes` allows it for mode `file` only).
- `nesting` in the emitter is not reset by blocks, so a `#for` inside a `<div>` gets no variables.
- Checked: new error codes start at BRM205 (error-codes.json ends at BRM204).
- The worktree had no node_modules; `pnpm install --frozen-lockfile --offline` fixed it.

## Build notes

- `Body.styles` (ast.ts) and `SFCFile.blockStyles` (a flat list of the same `Style` objects, for the editor and `getMarkup`).
- `bodyTree(file)` in ast.ts gives each body its parent body and whether it is at the top level of it. `blockBodies`
  moved from plan.ts to ast.ts; plan.ts re-exports it, so imports stay as they were.
- css.ts compiles the component styles first, then each styled body in source order. `StyleOutput.blocks` and
  `StyleOutput.bodies` carry the result; markup.ts and client.ts read them.
- Component attribute no longer follows `styles.css` (it now includes block CSS). `StyleOutput.hasComponentCss` does.
- Variables: `emitVariables` and `emitDynamic` build one object from the component's variables (nesting 0) and
  those of the block styles whose top level the element is at (`nesting === bodyBase`). The browser path reuses
  this code, so cloned templates and HTML renders both get them.
- Client prologue (client.ts) declares the outer values that a block style reads, for the render functions of the
  bodies that carry its variables. Block style sites emit no update function yet (block-styles).
- The full brumate suite passed once, except 3 `devtools.test.ts` tests under load. That file passes alone (14/14).
