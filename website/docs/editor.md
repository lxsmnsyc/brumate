# Editors

The VS Code extension gives `.brm` files highlighting, types, style support and the diagnostics of the compiler. Other editors can use the same language server and TypeScript plugin.

## VS Code

The extension is in [`packages/vscode`](https://github.com/lxsmnsyc/brumate/tree/main/packages/vscode). It gives:

- Highlighting for markup, blocks, scripts, expressions and styles.
- Types, completion, hover and go to definition from TypeScript, in `.brm` files and in `.ts` files that import them.
- Completion, hover and errors in style blocks, for CSS, SCSS and Less.
- The errors and warnings of the compiler, such as a compile-time function that is not imported, a value that is changed in place, or an image without `alt`.

It bundles a language server for styles and diagnostics, and a TypeScript plugin for types. It needs no native modules, so it works on every platform.

## Other editors

- Run `brumate-language-server --stdio` from `@brumate/language-server` with the language server client of the editor. It gives style features and the diagnostics of the compiler.
- For types, add `@brumate/typescript-plugin` to the TypeScript server of the editor, as [TypeScript](./typescript.md#in-an-editor) describes.
- The TextMate grammar is in [`packages/vscode/syntaxes`](https://github.com/lxsmnsyc/brumate/blob/main/packages/vscode/syntaxes/brumate.tmLanguage.json). Its scope name is `source.brm`.

## Coding agents

`brumate skill [folder]` copies a skill for `.brm` files into `folder/brumate`, by default `.claude/skills/brumate`. It teaches an agent the syntax, state and events, and lists every compile error with its cause and fix.

## Limits

- TypeScript 7 does not load plugins, so types in `.brm` files need TypeScript 5.0 to 6. VS Code ships with a version that works.
- The diagnostics of the compiler read one file at a time. A warning that depends on how other files use a component can differ from the build, which reads the whole project.
