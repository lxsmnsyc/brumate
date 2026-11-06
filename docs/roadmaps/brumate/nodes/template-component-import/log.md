# Log: template-component-import

- Repro: `tplImportHost.brm` opens `TplImportList.brm` (an `#if` shows it) which calls its `row` template in a keyed `#for`; `row` renders `TplImportItem`. First pick threw `ReferenceError: TplImportItem is not defined`.
- Cause: in the update part, `fillValue` wraps a call to a template with `withTemplates`, which copies the template function. `assemble` took the components and imports from `renderedScopes()` (scopes that render functions render) and the children renders. A template called only by an update site was in neither.
- Fix: `partScopes(part)` in client.ts adds, for every site the part holds, the scopes of the templates it calls or passes on (with the templates they call). `assemble` and `assembleAll` use it. It gathers components, other imports and nested templates alike, since `importsFor` already reads the sites of each scope.
- Cleanup test: effects of a component made in the browser run on change, not on creation, so the test clicks each item first (6 mounts), then picks. A pick calls the template again for all six rows, so six old rows clean up once each. It fails on main for the leak of #472; it passes with #472's three source files copied in (checked by `git show`, not stash). Marked `it.fails` until #472 merges.
- Sizes (gzip -9 of dist/client/**/*.js): todos 39246 to 39229, ui 199059 to 199052.
