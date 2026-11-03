---
goal: Decide whether a block body may be one markup child without braces (#445), or blocks keep #word { } only
date: 2026-11-03
rounds: 2 of 3
status: rejected
roadmap: docs/roadmaps/brumate (node single-child-blocks, dropped)
supersedes: none
decision: docs/decisions.md (block bodies keep braces, 2026-11-03)
---

# Debate: block bodies without braces

The maintainer asked for the short form on 2026-11-02 (`#try <UnsafeComponent /> #catch (error, reset) <Fallback {error} {reset} />`), #445 built it, and its review found that prose in markup such as `<p>call #defer <b>x</b></p>` silently became a block. The maintainer reopened the choice. After two rounds the maintainer dropped the short form: block bodies keep `#word { }`, and #445 is closed unmerged.

## Settled structure

Braces only (A1). Nothing is built.

The strongest short form found was P7 with P9: a headerless `#word <` opens a short block only where a node starts with no text before it on the line, and the one child starts on the header's line; longer bodies use braces. It keeps the maintainer's `#try` example and the 12 real uses in the repo (evidence/midline.txt), but `<p>#defer <b>x</b></p>` still becomes a block (O9), the grammar starts to care about position and line breaks, and about 102 of 267 one-line bodies would pass 100 columns on one line (O11).

## Budget

- readability: the short form drops two braces from about 165 to 250 bodies, under 600 characters across the repo (J3, O4, P5).
- tokens: #445 spent about 177k tokens; the rework to P7 and P9 was estimated at 15k, unmeasured (O5, O12). This debate spent about 157k.
- device and client bytes: none either way; the compiled output is the same (P5).

## Rejected

- #445's rule, `#word <` and `#word #` open a block anywhere: prose turns into blocks without an error (O6, J2).
- A short body only after a header or a branch word (P1): it sends the maintainer's headerless `#try` example back to braces (O1, J7).
- A formatter that prints one-element bodies on one line (A2): brumate has no .brm formatter (O3).
- A short body only for components or uppercase tags (P8): it fixes less of the trap than P7 and adds a rule about tag case.
- The revised short form (P7 with P9): dropped by the maintainer; the gain is under 600 characters, and it still leaves a trap and a position rule.

## Prior art

- Svelte closes every block, Marko uses tags, Vue uses attributes; Rust and Swift require braces on every `if` (J5).
- C and JS allow a braceless body and carry the dangling-else rule; the 2014 goto fail bug came from a sibling line indented like a braceless body (J5, O2).
- Kotlin and C# allow a braceless body after a `)` header (P6, though its goto fail reading was wrong).

## Open risks

- None: nothing is built.

## Inferred choices

- Brumate has no deprecation periods and 0.x breaks are minor; a decision on an unmerged branch is not a recorded decision (J4, J7).

## Answers from the user

- Re-evaluate the short form: "probably worth a debate, should we continue with this change or just stick with the `#word { }`".
- After round 2: "I'm planning to drop this plan."

## Overruled

- None.

## Cost of this debate

- 2 of 3 rounds, about 157k tokens.
