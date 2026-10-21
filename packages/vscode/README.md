# brumate for VS Code

Language support for `.brm` files.

- Highlighting for markup, blocks, scripts, expressions and styles.
- Types, completion, hover and go to definition from TypeScript, in `.brm` files and in `.ts` files that import them.
- Completion, hover and errors for styles in CSS, SCSS and Less.
- The errors and warnings of the compiler, such as a compile-time function that is not imported, or a value that is changed in place.

TypeScript features need the TypeScript version of VS Code or of the workspace, 5.0 or newer. TypeScript 7 does not load plugins.

## Development

```bash
pnpm --filter brumate-vscode build
```

Then run "Run the extension" from the debug panel of this repository. It opens the example app with the extension.

`pnpm --filter brumate-vscode package` writes a `.vsix` file to install.
