# Outcome: ui-skill

## Built

- `packages/ui/skills/brumate-ui/SKILL.md`: name, description, the rules that agents get wrong, links to the references. `references/` holds composition, slots-and-contexts, state, as-and-ref, templates, styling, collections, overlays, dates-and-colors and i18n.
- `files` in `packages/ui/package.json` has `skills`, so the skill ships with the parts and has their version.
- `packages/ui/test/skill.test.ts`: frontmatter, links, no other library named, `files` has `skills`, every import names a part that exists, every `brm` block compiles and renders on the server, none reads `.value` of a signal, and a block marked `wrong: message` fails with exactly that message.
- Changeset `.changeset/ui-skill.md` (minor, @brumate/ui).

## Deviations

- The blocks render on the server and are not resumed. The plugin scans components at start, so a file that the test writes later has no manifest entry.
- The blocks are not typechecked, so a wrong prop name inside a block is not caught.
- Edits outside the owned paths: `.changeset/ui-skill.md` (shared) and the node folder only.

## Stubs left

- None.

## Gotchas

- A change to a prop, a slot or a rule in `website/ui` that the skill states needs the same change in the skill. The test catches a block that no longer compiles or renders, not a rule that went stale.
- Blocks import `@brumate/ui/X.brm`, the form a user writes. The test turns it into a path in `src`.
- A bare `ref=name` on a component compiles. Only an element reports BRM027, so the wrong block uses an element.
- The skill does not copy itself into a project (no `npx` command like `brumate skill`). The folder ships in the package: copy `node_modules/@brumate/ui/skills/brumate-ui`.

## Proposed learnings

- A change to a part's props or slots updates `packages/ui/skills/brumate-ui` in the same PR | the test cannot see a stale rule | packages/ui | no

## Verification

- `pnpm --filter @brumate/ui exec vitest run test/skill.test.ts`: see the PR for the run.
- `npm pack --dry-run` in packages/ui lists `skills/brumate-ui/SKILL.md` and the ten references.
- `pnpm lint && pnpm format:check && pnpm typecheck`: see the PR.

## Size

- Estimated M, actual M.
