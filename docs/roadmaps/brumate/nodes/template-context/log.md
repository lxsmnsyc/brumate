# Log: template-context

- Proof on the base (fa137b5b): removed the `template-context` cause and its `diverge(...)` line from `test/differential/data.ts`, then `npx vitest run test/differential-3.test.ts -t tplContextListPage` (in packages/brumate). It fails: the browser render has `errors: ["Error: The context \"tpl-level-store\" has no provider above this component ..."]`, empty html. The server render shows 7.
- Cause as in the brief: `templateCall` built a `TemplateCall` with `lexical = true`, so `Children.from` was undefined, the scope of the template got no `t`, and `findProvider` walked `p` past the child.
- Fix: `TemplateCall` is always children of its owner (the `lexical` flag is gone). `createScope` then sets `t` on the template's scope to the scope that inserts it, as for children.
- That made `renderedTemplate` (inserts.ts) find two calls at one scope, because `scope.t === at` matched without the range test that `scope.l === at` had. `resume.test.ts` "updates each call of one template in its own scope" failed. The range test now applies to both.
- Probe `<TplProvider>{row('inside')}</TplProvider>` (`tplContextInFilePage.brm`): the browser render already matched the server on the base, so there was nothing to fix. The page stays as a guard in the differential test.
- Under load, "computes the memo of a template that a shallower component renders" (500 ms waitFor) and "leaves no markup when the block switches back" failed while two other workers ran; both pass alone three times, and on the base.
