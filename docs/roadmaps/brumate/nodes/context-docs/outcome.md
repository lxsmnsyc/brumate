# Outcome: context-docs

## Built

- `website/docs/context.md`: no `createContext` call passes a default. "Creating a context" says there is no default and why. "Reading a value" gives the throw with its exact message. "Reading without a provider" (from has-context) stays, with a lead-in about the throw. The `Counter` and `Level` demos use the typed key-only form.
- `website/docs/reference-signals.md`: new `$hasContext` section and summary row; `$getContext` throws without a provider. `website/docs/reference-server.md`: both `createContext` rows are `createContext(key)`. `website/docs/inspect.md`: a context has no default.
- `examples/tracker/src/user.ts`: `createContext<string | undefined>('user')`.
- `packages/brumate/skills/brumate/references/state.md` (the skill is at `packages/brumate/skills/brumate`, not `skills/brumate`) and `signals.md`: no default, `$getContext` throws, `$hasContext`.
- `docs/decisions.md`: `$hasContext` in the function list (line 7) and a last entry, "Contexts have no default value" (line 164), with the debate link `./debates/context-no-defaults/debate.md`, why, Svelte 5.40 as the model, Solid 2.0's difference and the rejected options.
- Changesets: `context-throw.md` now covers `createContext(key)`, the throw and `$hasContext` (brumate, minor); `ui-no-defaults.md` replaces ui-no-defaults-1 to 4 and lists all 61 contexts (@brumate/ui, minor). `has-context.md` and the four ui files are deleted.

## Result

Not an experiment node.

## Deviations

- Only two `createContext` calls passed a default outside `context.md` (`examples/tracker/src/user.ts`, and a debate evidence file `docs/debates/function-prop-derivations/evidence/pcCtx.ts`, left alone). The brief's "12" and "4" counts were of an older state.
- The website live demos in `context.md` drop the `store` import of `level.ts`, which only the default used.
- The `decision:` field of the debate is on main only; set it to `docs/decisions.md`, the entry that starts "Contexts have no default value" (line 164 on this branch).

## Stubs left

- None.

## Gotchas

- `docs/decisions.md` line 162 and others about the old state were checked; none said a reader gets a default.

## Proposed learnings

- None.

## Verification

- Root `npx oxfmt --check`: pass. `npx oxlint`: 0 errors (warnings only).
- `npm run typecheck` in `examples/tracker` and `website`: pass (after `npx tsdown` in brumate, language-core, tsc).
- `npx vitest run` in `website`: 336 pass. `test/skill.test.ts` in `packages/brumate`: 55 pass.
- plain-writing checker on the changed docs: warnings for long sentences only, most on lines that were already there.

## Size

- Estimated S, actual S.
