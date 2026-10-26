---
branches:
---

# Support for coding agents

## Outcome

An agent that writes .brm files has a skill with the rules it gets wrong, the docs as Markdown, one command that reports every problem as JSON with codes, and a way to copy what the devtools show. Component tests can check accessibility.

## Acceptance

- `npx brumate skill` installs the skill, and its code blocks compile.
- `brumate check --json` reports a compile error with its code.
- /llms.txt lists every page.

## Priorities

- must: none.
- should: the skill, llms.txt, `brumate check`, and accessibility checks in tests.
- could: copy in the devtools, sizes in the editor.
- later: the tasks that check the skill, and an MCP server, in ../inbox.md.

## Constraints

- The skill must not drift from the compiler: its code blocks are tested.

## Non-goals

- An MCP server, until the pieces show which tools agents use.

## Verification

- Fast check: `pnpm lint && pnpm format:check && pnpm typecheck`, then the tests of the node.
- Full check: `pnpm build && pnpm test`.

## Numbered resources

- Compile error codes (BRMnnn) are assigned once, in brumate-check.

## Sources

- [Agent support](../../proposals.md#agent-support)
- [Accessibility checks in tests](../../proposals.md#accessibility-checks-in-tests)
- [What ships, in the editor](../../proposals.md#what-ships-in-the-editor)

## Coverage

- Agent support, order 1, the skill -> brm-skill
- Agent support, order 2, llms.txt -> llms-txt
- Agent support, order 3, copy in the devtools -> devtools-copy
- Agent support, order 4, brumate check and codes -> brumate-check
- Agent support, order 5, the tasks run by hand -> inbox: after the skill ships
- Agent support, later, an MCP server -> inbox
- Accessibility checks in tests -> a11y-in-tests
- What ships, in the editor -> editor-sizes

## Open questions

- None.

## Gates

- None.
