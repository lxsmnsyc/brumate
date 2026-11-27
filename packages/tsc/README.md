# @brumate/tsc

Type-checks a brumate project, `.brm` files included. Use `brumate-tsc --noEmit` in place of `tsc --noEmit`. It runs the TypeScript 6 compiler, because TypeScript 7 has no programmatic API. A syntax error of a `.brm` file fails the run, with its `BRM` code. `brumate check` runs it too.

Part of [brumate](https://github.com/lxsmnsyc/brumate), a component language and compiler for resumable web apps.
