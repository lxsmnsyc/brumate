# Editors

The VS Code extension in [`packages/vscode`](../packages/vscode) gives `.brm` files the features of a language:

- Highlighting for markup, blocks, scripts, expressions and styles.
- Types, completion, hover and go to definition from TypeScript, in `.brm` files and in `.ts` files that import them.
- Completion, hover and errors for styles in CSS, SCSS and Less.
- The errors and warnings of the compiler, such as a compile-time function that is not imported, or a value that is changed in place.

## How it works

- `@brumate/typescript-plugin` runs in the TypeScript server of the editor. It gives the TypeScript features, from the TypeScript that `toTypeScript` writes for each file.
- `@brumate/language-server` gives the rest. It reads each style block as its own CSS, SCSS or Less code, and runs the compiler on the file for its diagnostics.
- The extension bundles both, with the WebAssembly build of the parser, so it works on every platform without native modules.

## Other editors

An editor with a language server client can run `brumate-language-server --stdio` from `@brumate/language-server`. For TypeScript features, add `@brumate/typescript-plugin` to the TypeScript server of the editor, as [TypeScript](./typescript.md) describes.

The TextMate grammar is in [`packages/vscode/syntaxes`](../packages/vscode/syntaxes/brumate.tmLanguage.json). Its scope name is `source.brm`.

## Limits

- TypeScript 7 does not load plugins, so TypeScript features need the TypeScript of VS Code or a workspace version from 5.0 to 6.
- The diagnostics of the compiler read one file. A warning that depends on how other files use a component can differ from the build.
