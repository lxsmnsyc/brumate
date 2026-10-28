# Outcome: children-handler-refs

## Built

A function or import that markup inside a component's children uses is defined in the browser when the children render later.

## Cause

`emitChildrenRenders` in `packages/brumate/src/codegen/client.ts` wrote `let bump = bump$.bind(null, $$p)` for every function that a site in the children read, including event sites. A handler is named by its table entry (`h3`), so it needs no local. But the update part, which holds the render, did not import `bump$`, because only handler parts reach it. With one use, the function lives in its handler part and the local was never reached the same way; with two uses it is placed in the shared part, and the update part had no import of it. The render then threw `bump$ is not defined`.

## Fix

- Reads of a function by a deferred site (event, effect, client) no longer make a local in a children render.
- The imports read by the sites in the children are added to the update part. This defines `prevent` in `onSubmit=(prevent(...))` on a component, because the update part evaluates that prop for `handlerProp`.

## The `prevent` case

Reproduced in the fixture `handlerRefsPrevent.brm` (a component with `onSubmit=(prevent(...))` and `$bind` inside children of a toggled wrapper). It has a different cause from `bump$`: the import was missing from the update part, not the shared function. The same area of code, a separate fix.

## Tests

packages/brumate/test/resume.test.ts, `functions used in children that render later`: top plus children use, nested children, a template passed to a component, a template rendered by a block later, and the `prevent` case. The first, nested and `prevent` tests failed on main and pass now. The two template tests passed on main: the ToastRegion failure is likely the same shared-function cause but I could not reproduce it with a template alone.

## Size

Todos client JS: 7 files, 79.1 kB / 28.2 kB before and after.

## Snapshots

None changed.
