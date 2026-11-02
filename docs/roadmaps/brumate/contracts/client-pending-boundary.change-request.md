# Change request: client-pending-boundary

From: settled-memo-merge (2026-11-02).

- `waits.ts` now exports `fillSettled` from `brumate/client` too, next to `wait`. The Interface section says "Only `wait` is exported from `brumate/client`".
- `fillSettled(id, values, write)` is a wait of cloned markup that reads memos which never change (#419, #421). With a promise among `values` it counts in the boundary of the render with `join`, ends with `leave` after `write` or when its scope goes, and with `fail` then `fault` on a rejection. A rejection is reported to `fail` once per error and scope; `fault` runs for each wait.
- Proposed text for Interface: "`wait` and `fillSettled` are exported from `brumate/client`. The rest is internal to the client runtime." and one line under Behavior for `fillSettled` as above.
