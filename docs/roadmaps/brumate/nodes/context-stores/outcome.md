# Outcome: context-stores

## Built

- Story PR #471 (feat/context-stores -> next) merged 2026-11-07, merge commit d4240387.
- Child nodes, all done: context-stores-spike (#463), store-contract (#464), ui-stores-fields, ui-stores-calendar (#465), ui-stores-collections, ui-stores-rest (#468), static-contexts-final (#469, BRM196), context-throw, has-context, ui-no-defaults-1..4, context-docs, store-any-source (#470), ui-store-guards, context-read-fallback, store-bridge (BRM200), store-repair-compare.
- API: contexts are static; live values cross in stores (`$toStore`, `$store` of any store expression); `createContext(key)` takes no default; `$getContext(C, fallback)` replaces `$hasContext`; `bridge()` names module-level stores, also in installed packages.

## Deviations

- The no-defaults and read-fallback debates (context-no-defaults, context-read-fallback) changed the API during the story; see their entries in decisions.md.

## Stubs left

- A bridge outside the `dir` of a package with a `brumate` field is not found (reviewer nit).
- The BRM197 example in error-catalog.ts still shows the double-guard form (reviewer nit).

## Gotchas

- Syncing main into the story after 0.6.1 needed two fixes on the story: a fixture from main passed a `createContext` default, and the module-script-shared `it.fails` test had to become `it`.

## Verification

- Before the merge, on the story at fb82a021: build, lint, format, typecheck, `pnpm test` (brumate 2956, ui 783 + 1 expected fail, all packages and examples) and `node e2e/run.mjs` (website 72, todos 10, tracker 17, nitro 2, kit 5, ui 56, browser-async 6) pass. CI green at 3b035423.
