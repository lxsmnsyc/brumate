# Outcome: template-call-try

## Built

- Finding: the brief's case (`const c = boom(1)` outside a `#try`, `{c}` inside it) already matches between server, resume and browser on this base, for a const, a signal, a memo and a prop. The render of the call runs inside the `#try` of its insert in the browser, through the `#try` code that the compiler already ships.
- The real gap is the update path. When a signal or a prop that holds a call changes to a call that throws, the insert reuses the template's scope and the update of its slot (`u2`) throws. `fail` walks `scope.l` to the insert's scope and looks for the `#try` in the module's `t` table. The compiler left `t` out, because `tryCatchesClient` (`src/graph.ts`) saw no client code in the `#try` body, so the error was logged as uncaught and the page kept the old markup.
- `tryCatchesClient` now counts an insert of a plain name that is a prop, or a signal or `let` in a file that has a `#template` (`insertedIdentifier`). A memo read already counted.
- Docs: `website/docs/control-flow.md`, `#try` section, says which `#try` catches the error of a kept call.
- Patch changeset `.changeset/template-call-try.md`.

## Where the error of the call's arguments belongs

A call renders at its insert, but its arguments run where the call is written. An error in the arguments (`item(load())`) is thrown there and goes to the `#try` around the call, or to the page. Only an error of the template body goes to the `#try` around the insert. Reason: the arguments are plain code of the place that wrote them, and the call may never be inserted; the body is markup that renders at the insert, as children do.

## Tests

- `packages/brumate/test/resume.test.ts`, `a #template call that throws, inserted in a #try`: const, signal, memo and prop pages that open the `#try` in the browser (`*TemplateTryLater`), and a click that makes a signal (`signalTemplateTryBad`), a memo (`memoTemplateTryBad`) and a prop (`propTemplateTryBad`) throw.
- Differential pages `constTemplateTry`, `signalTemplateTry`, `memoTemplateTry`, `propTemplateTry` (child `TemplateTryKid`): server, resume and browser render match with the `#catch`. Helper `test/render/templateTryCheck.ts`.
- On base (`src/graph.ts` reverted): the signal click test and the prop click test fail (5 s timeout, error logged uncaught). The other tests pass on base: the render path was not broken. The memo click already passed, since a memo read counted.

## Checks

- `pnpm lint` (warnings only), `pnpm format:check`, `pnpm typecheck`: pass.
- Root `pnpm test`: pass (brumate 3813, ui 846 + 1 expected fail).
- `node e2e/run.mjs`: see the report of the worker.

## Size

M estimated; smaller in the runtime (no client runtime change), the fix is in the compiler. No bench: no client runtime file changed. A `#try` whose body inserts a prop or a signal now ships its `t` entry and `#catch` code.
