# Change request: part-props v1.1 to v1.2

- From node: as-collections, PR #252
- Status: rejected, 2026-10-26

## Problem

A component in `as` hits four gaps in the core:

- a forwarded `ref` stays empty when the component spreads its props;
- a component in a prop renders nothing in markup that the browser renders later;
- a component used only as a value in a `#template` is not imported in its client code;
- a dynamic tag with a spread of `$handler` attributes loses its keys.

The request proposed to say in the contract that a part also reads its root by an ID, and that a component in `as` works only for what the server renders.

## Decision

Rejected by the user, on the orchestrator's recommendation. The gaps are bugs of the core on main, left by ref forwarding (#243) and dynamic tags. They get their own nodes in the core-correct milestone, each from main with a failing test. The contract stays as it is.

as-collections goes back to todo. Its PR #252 is kept as a draft. Once the core fixes land, it is reworked without the ID lookups, and it tests component targets in the browser too. as-controls waits for the same fixes.
