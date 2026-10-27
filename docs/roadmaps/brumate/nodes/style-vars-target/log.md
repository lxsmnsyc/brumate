# Log: style-vars-target

- Probed on main with a part (`[role='row'] { --size: ${size}px }`, `{...rest}`) and a component in `as`. A part with only the style variable passes: both targets update to 13px. The bug needs a second live prop on the tag (`aria-selected=(size > 12)`), which makes the target's rest live.
- Cause: a change of a rest prop rewrites every attribute from the rest, including the `style` string that the server sent (`--s-x-0:12px`). `withVariables` in runtime/client/inserts.ts kept the element's live value only when the new style did not name the variable, so the old 12px won over the 13px that `setVar` had written.
- Fix: `withVariables` puts the live variables after the style, so they win over an older value in it.
- Test harness: a test after a loader run gets a fresh `brumate/server` for the fixture but the static `renderParts` of the old graph, so an `Internal` in the page state fails the plugin check. The new test renders with a dynamic import of the server module. Changing `resume` for all tests breaks "the serial entry" test, so it is not changed.
- Size: client chunk gzip 34747 B to 34735 B (-12 B).
