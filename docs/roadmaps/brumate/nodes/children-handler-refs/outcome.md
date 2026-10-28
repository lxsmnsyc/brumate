# Outcome: children-handler-refs

## Built

A function or import that markup inside a component's children uses is defined in the browser when the children render later.

## Cause

`emitChildrenRenders` in `packages/brumate/src/codegen/client.ts` wrote `let bump = bump$.bind(null, $$p)` for every function that a site in the children read, including event sites. A handler is named by its table entry (`h3`), so it needs no local. But the update part, which holds the render, did not import `bump$`, because only handler parts reach it. With one use, the function lives in its handler part and the local was never reached the same way; with two uses it is placed in the shared part, and the update part had no import of it. The render then threw `bump$ is not defined`.

## Fix

- Reads of a function by a deferred site (event, effect, client) no longer make a local in a children render, because a handler is named by its table entry.
- A function that a non-deferred site in children passes on, such as a component prop `cb=bump`, still needs its local. The sites in the children (and the sites inside the templates of a template part) are now part of the update part (and the template part), so the placement imports `bump$` from the shared part. Their imports are added too, which defines `prevent` in `onSubmit=(prevent(...))`.

## The `prevent` case

Reproduced in the fixture `handlerRefsPrevent.brm`. The import was missing from the update part, which evaluates that prop for `handlerProp`. The same area as `bump$`, fixed by the same step: the update part holds what the children sites read.

## Tests

packages/brumate/test/resume.test.ts, `functions used in children that render later`: top plus children use, nested children, a template, a template in a block, `prevent`, a function passed as a prop (two uses and one use), and the same in a template. The prop and template-prop cases are the ToastRegion shape.

## Size

Todos client JS: 7 files, 79.1 kB / 28.2 kB before and after. Website client JS: 3,033,051 B (892,200 B gzip) before, 3,033,401 B (892,812 B gzip) after.

## Snapshots

None changed.
