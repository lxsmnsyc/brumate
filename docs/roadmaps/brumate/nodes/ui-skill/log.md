# Log: ui-skill

- Read the outcomes of the seven dependencies and the brumate skill (layout, frontmatter, test harness).
- Layout: `packages/ui/skills/brumate-ui/SKILL.md` (rules, 10 reference links) and `references/` with composition, slots-and-contexts, state, as-and-ref, templates, styling, collections, overlays, dates-and-colors and i18n.
- `files` in packages/ui/package.json gets `skills`. `npm pack --dry-run` lists the 11 files.
- Test `packages/ui/test/skill.test.ts`: writes each `brm` block to `test/.output/skill/` (gitignored) with `@brumate/ui/` turned into `../../../src/`, imports it with `?brumate-server` and renders it with `render` from `brumate/server`. A block marked `wrong: message` is compiled and must fail with that first message.
- A resumed `mount` does not work for these files: the plugin scans for components when it starts, before the test writes them, so the manifest has no entry (`Unknown component`). The blocks render on the server only, which runs every part's code and compiles its client code.
- Compile alone does not check props of a part. The blocks are not typechecked (brumate-tsc needs files known to the project). A wrong prop name in a block is not caught, only a wrong import, a bad syntax or a server error.
- Wrong blocks: bare `ref=name` on an element (BRM027), markup as an attribute value (`Expected ")"`), and `:prevent` modifier on a part (BRM023). A bare `ref=name` on a component compiles, so the block uses an element.
- Facts used from the current code and docs: promise props are plain promises (brumate, noted only by pointing to the brumate skill), change handlers get the kept value only when it changed, TextField and SearchField keep typed text after a refused edit, `as` gaps with a component target from the as-controls and as-collections outcomes.
