# Log: unread-memo-rejection

- 2026-11-02: Reproduced on d49e4c74 with the scratchpad fixtures: `expected [ 'Error: side failed' ] to deeply equal []`.
- The server never computes a memo that nothing reads (`memo()` in runtime/server.ts is lazy), so a server render shows no error at all. The browser render computes it in place, as it does for a memo that throws, whose error already reaches the `#try`. The fix sends the rejection the same way.
- A `#try` whose body holds only a child component gets no entry in the `t` table of its module (`tryCatchesClient` looks only at the sites of its own component), so it cannot catch any client error of the child. The `#catch` test puts the button inside the `#try`. Not fixed here.
- An async memo that only markup reads, with no slot, renders empty in a browser render and its value never lands. Not fixed here.
- Snapshot `uses-counter` changed with the first version, which also wrapped `counter_double = other * 2`. Memos that `isPrimitive` accepts are now left out, and the snapshot is unchanged.
