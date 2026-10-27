# Log: split-client-runtime

- A first split by the names of the contract failed `import/no-cycle`. The calls of the functions form no cycle, so I found an order of modules in which every statement only reaches modules before it, and placed the statements by that order.
- Statements were moved by a script that reads the original with the TypeScript checker, so imports and exports follow the code. Then I edited by hand the `let`s that two modules write.
- Those `let`s now have a small function in the module that holds them (see the change request). `hiding` and `guesses` live in state.ts, because modules below their writers read them.
- Parity checks: the exports of client.ts match the original (126 names, same kinds), and every original statement appears unchanged in the new files except the ones named in the outcome.
- Size: the built chunk grows with `//#region` comments and the setters. The built todos app shrinks. Numbers in the outcome.
- The sandbox guard rejects some long shell commands that contain the repo path. Short commands and `python3` scripts passed.
