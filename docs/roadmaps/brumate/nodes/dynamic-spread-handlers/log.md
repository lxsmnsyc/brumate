# Log: dynamic-spread-handlers

- Wrote the tests first: fixtures dynamicKeys, dynamicKeysArgs, dynamicKeysEach and dynamicKeysSwap, and four tests in test/resume.test.ts. All four failed on main (timeout, or no handler in `b-on`).
- Both client functions write the start tag through one helper, `startAttributes`, so they cannot differ. It takes the own `b-on` out of the attributes, as the server `spread` does, so the element gets one `b-on`.
- Probed which path each test takes: dynamicKeys, Args and Each go through `dynamicNodes` (clone), Swap through `dynamic` (HTML string).
- First version of the helper grew the eager core by 0.113 kB. Reusing the exported `spread` of client.ts brought it to 0.095 kB.
- Fixed in one commit with the tests. All checks pass.
