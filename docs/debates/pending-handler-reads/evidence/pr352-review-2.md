Review of bb5f507e (rework). Not approvable yet: one blocking finding against design point 2, and three should-fix findings. Comment only, not a request for changes.

## Checks (local, the repo is public but CI was not used)

- `pnpm lint`: pass (warnings only). `pnpm format:check`: pass. `pnpm typecheck`: pass (one failed run while e2e was rebuilding dist; passed when run alone).
- `npx vitest run` in packages/brumate: 59 files, 1186 tests pass.
- `pnpm --filter website check:samples`: 65 samples, 0 problems.
- `node e2e/run.mjs`: only the two known main failures (/docs/control-flow "10 live samples render", ColorArea drag). todos 9/9, tracker 14/14, nitro 2/2, kit 5/5.
- `pnpm bench`, branch against merge base fb4cd8eb: todos JS before `load` 14,869 -> 15,033 B gzip (+164 B, +1.1%; raw 35,326 -> 35,691). Dashboard boot 24,846 -> 25,016 B gzip (+170 B). Almost all of it is the runtime (`loadingValues`, `handler()`, the skip path), not the `, 1` per `$client`. Fine for what it adds, but finding 1 may change it.

## Blocking

**1. A promise prop or signal that the server streams now throws in a handler.** `packages/brumate/src/runtime/client/resume.ts:230` adds every promise slot of a resumed scope to `loadingValues`, not only memo slots. Probe: a parent renders `<Child value=(later()) />`, where `later()` returns a plain promise, and the child has `let held = $signal(new Promise(...))`. A click on handlers that read `value` and `held` before they settle gives two errors, `A handler read a memo that has no value yet. Check $isPending(memo) first`. On main both handlers get the promise. Design point 2 says a promise prop passes through as a plain value, and `website/docs/async-data.md:131` says "A promise in a signal or a prop is an ordinary value". There is also no way out: `$isPending` takes a memo, so the author cannot guard the read, and BRM182 does not report it. Fix: mark only the slots of memos as loading (the server knows which slots are memos; a flag in the state record, or the memo slots that `renderedLoads` already tracks), and add a test with a streamed promise prop.

## Should fix

**2. BRM182 rejects the documented `$optimistic` sample, and the only accepted guard drops guesses during a reload.** `website/docs/forms.md:395` (`shown = [...shown, String(name)]` in `guess`) now fails with BRM182. check:samples misses it because the fence is not `live`. A scan of every `brm` fence with a script in website/docs, website/ui and the skill (176 samples) finds this one new failure, so the noise elsewhere in the docs is low. But this is the canonical optimistic idiom (also in `packages/brumate/test/render/optimistic.brm`, which the PR had to change), and the fix it forces is wrong for it: `$isPending(shown)` is true while `names` reloads after the previous post (async-data.md: "true while a new value of the memo loads"), so a second quick submit loses its guess. The memo has a value then; only the first load lacks one. Options: a guard that means "has a value" (or accept `$isPending` only on first load), or treat a memo that markup reads as always having a value on a server-rendered page, where the server waits for it. At least the forms.md sample must compile again.

**3. An `async` handler that reads after an `await` still gets the promise.** `handler()` at `packages/brumate/src/runtime/client/updates.ts:354` counts `handling` only for the synchronous part (`handlers.ts:237`, `:240`). Probe: the worker's "known gap" component, `const data = await $memo(slow(name, 100))` in a component the browser renders. A plain handler that reads `data` throws the run-time error into `#try` (good, so the gap is smaller than the outcome says, never a promise there). The same handler with `await Promise.resolve();` before the read logs `data instanceof Promise === true`. The same holds for any unguarded read after `await` in code the compiler cannot follow (function props). Either document this limit, or make the awaited-memo case sound at compile time (do not exempt `await $memo` in a component that can be rendered in the browser), since that is the case where BRM182 is silent.

**4. Docs do not match the runtime.** `docs/decisions.md:135` and the PR body say the browser render of `await $memo(…)` "gives the promise"; it throws for a synchronous read (probe above), and gives the promise only after an `await`. `async-data.md:131` is wrong as described in finding 1 (it also contradicts the outcome's gotcha "A signal whose value is a promise that the server streamed is also treated as loading"). The run-time message suggests "declare the memo with await $memo(…)" even when the memo already is awaited.

## Analyzer (`src/pending-reads.ts`)

Probed 23 cases. Correct: early `return`/`throw`, `if`/`else`, `?:`, `&&`/`||` with `!`, guard inside a nested function not counted for a read outside it, a nested `if (x) { if ($isPending(m)) return; }` not counted, guard of a derived memo covers its source, effects not checked, `$client` checked, writes to `$optimistic` not counted as reads. Truth tables for `!`, `&&`, `||` are right.

False positives (nits, but they add noise):
- A guard in the caller does not cover a helper it calls: `function run() { if ($isPending(user)) return; show(); }` reports the read in `show`. Docs say "in the same function", so it is documented; following the guard into callees of a guarded path would remove the most likely refactor complaint.
- `continue`/`break` exits in loops and `switch`, `const p = $isPending(m); if (p) return;`, and `if ($isPending(m)) { return; } else { … }` are not recognised.
- `if ($isPending(user)) return; log(name)` (name reads user) is rejected. Conservative, fine.

False negatives: a memo of a function imported from a `'use server'` module is not `async-memo` (`analyze.ts:1588`), so BRM182 is silent for `const issue = $memo(getIssue(id))` in examples/tracker, the usual shape in real apps. The runtime throw covers it for streamed and browser-rendered memos, but the docs present BRM182 as the check. Worth a sentence in async-data.md, or a follow-up to detect imported server functions.

Cost: `pathTo` walks the site's AST once per read of a memo that lacks a value, only after the cheap filters. Fine.

## Effects

Read the skip and rerun path in `updates.ts:835-895`. The token in `skipped` stops a double run when a compiled input reruns the effect first (`effect()` deletes the key on entry), a second skip replaces the token, the `scopes.get(scope.id) === scope` check covers a disposed scope, and a hidden `#offscreen` body returns before the key is touched, then runs on show. No race found. Nit: when the promise rejects, `again` never runs (`.then(again, noop)` at `updates.ts:870`), so an effect that reached the memo through a function prop stays skipped until some other input changes; running it once on rejection would send the memo error to `#try`.

## Changeset and level

Minor is right for 0.x. The text is accurate apart from findings 1 and 3.

Approval stays with the maintainer.

