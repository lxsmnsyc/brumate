# Outcome of release-0.6.2

- Main's Test run on the #492 merge failed once on Node 22: `resume.test.ts > renders a #try body again with reset` timed out at 5 s. That test also timed out locally under load and passed alone; #492's own CI passed.
- Sync checks on the merge: build, lint, format, typecheck, brumate 3026, ui 799, tsc 3, language-server 7 and vscode 5 tests pass. Todos bench: JS before load 33.0 kB / 13.8 kB, client JS in dist 78.6 kB / 27.7 kB, the same as before the sync.
