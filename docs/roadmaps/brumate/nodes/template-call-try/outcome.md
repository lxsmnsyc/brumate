# Outcome: template-call-try

## Built

- Finding: the brief's case (`const c = boom(1)` outside a `#try`, `{c}` inside it) already matches between server, resume and browser on this base, for a const, a signal, a memo and a prop. The render of the call runs inside the `#try` of its insert in the browser, through the `#try` code that the compiler already ships.
- The real gap is the update path. When a signal or a prop that holds a call changes to a call that throws, the insert reuses the template's scope and the update of its slot (`u2`) throws. `fail` walks `scope.l` to the insert's scope and looks for the `#try` in the module's `t` table. The compiler left `t` out, because `tryCatchesClient` (`src/graph.ts`) saw no client code in the `#try` body, so the error was logged as uncaught and the page kept the old markup.
- `tryCatchesClient` now counts an insert whose expression reads, in any form, a declaration that can hold a call (`canHoldTemplateCall`): a prop, the rest of the props, a signal or `let`, a template parameter, a `$store` value, a module signal or memo (`Declaration.moduleSignal`). The check goes through `declaration.reads`, so `{box.row}` and `{c ? c : 0}` count as `{c}` does. A memo read already counted.
- Cost rule: `Declaration.plain` (set by `markPlainValues` in `analyze.ts`) marks a prop whose `$props<T>` type is strings, numbers, booleans, literals, null and undefined only, and a signal that starts as a string, number or boolean literal. Those, and the `children` prop, do not count. A context value from `$getContext` is read once, so it does not count either; a store from a context does (`$store`).
- A read that only goes into a call, an operator or a template string (`{String(item)}`, `{item + 1}`) shows nothing and does not count (`showsRead`). `CatchLeak` ships no table for `{fail(kind)}`.
- Not covered: a `const` derived from a prop or a signal (`const x = item`), and an untyped prop. An untyped prop counts.
- Docs: `website/docs/control-flow.md`, `#try` section, says which `#try` catches the error of a kept call.
- Patch changeset `.changeset/template-call-try.md`.

## Where the error of the call's arguments belongs

A call renders at its insert, but its arguments run where the call is written. An error in the arguments (`item(load())`) is thrown there and goes to the `#try` around the call, or to the page. Only an error of the template body goes to the `#try` around the insert. Reason: the arguments are plain code of the place that wrote them, and the call may never be inserted; the body is markup that renders at the insert, as children do.

## Tests

- `packages/brumate/test/resume.test.ts`, describe `a #template call that throws, inserted in a #try`: const, signal, memo and prop pages that open the `#try` in the browser (`*TemplateTryLater`), and a click that makes a call throw: signal, memo, prop, a member of a signal (`memberTemplateTryBad`), a ternary (`ternaryTemplateTryBad`), a store from a context (`contextTemplateTryBad`), the rest of the props (`restTemplateTryBad`).
- `packages/brumate/test/module-signals.test.ts`: a module signal that holds a call (`ModuleTemplateTry`).
- `packages/brumate/test/codegen.test.ts`: a `#try` that inserts a prop of plain types ships no table, and one that inserts a prop that can hold a call ships it.
- Differential pages `constTemplateTry`, `signalTemplateTry`, `memoTemplateTry`, `propTemplateTry` (child `TemplateTryKid`). Server and browser match. They pass on base too.
- On base (`graph.ts`, `analyze.ts`, `model.ts` from the batch branch): every click test fails (signal, prop, member, ternary, store, rest, module signal), each with a timeout and an uncaught `Error: bad`. The open-in-the-browser tests and the memo click pass on base.

## Checks

- `pnpm lint` (warnings only), `pnpm format:check`, `pnpm typecheck`, root `pnpm test` and `node e2e/run.mjs`: pass.

## Size

- Per component (compile output): `TemplateTryKid` (prop `unknown`) client.ts 232 B + client.update.ts 772 B, render.ts 1267 B (base: 95 B, no update file, 1007 B). `TemplateTryPlainKid` (prop `string`) client.ts 99 B, no update file, render.ts 1030 B.
- Website build (`dist/client` JS), base vs branch: 4253746 B / 1272065 B gz to 4255708 B / 1273263 B gz, +1962 B raw / +1198 B gz; server JS 10660005 B to 10660944 B, +939 B. The change includes the new paragraph of `control-flow.md`, which the website bundles as text, so the part from the compiler is smaller. With the first version of the rule (a bare name only), the client delta was +1355 B raw, all in the repl's `run.js`.
- `pnpm bench --only brumate --scenario todos`: JS before load 35.6 kB / 14.7 kB gz and client JS in dist 88.5 kB / 31.2 kB gz, the same as base.
- Estimated M, actual M. The fix is in the compiler, no client runtime file changed.
