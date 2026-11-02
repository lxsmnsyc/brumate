# @brumate/typescript-plugin

## 0.1.6

### Patch Changes

- @brumate/language-core@0.2.2

## 0.1.5

### Patch Changes

- @brumate/language-core@0.2.1

## 0.1.4

### Patch Changes

- 54d4852: An untyped `#template` parameter takes its type from the prop it is passed to. With `<ListBox items=(animals) item=row>` and `#template row(a)`, `a` is an `Animal`, so `a.nope` is an error at its place in the file. Hover, go to definition, references and rename on the template name still work. The TypeScript server plugin drops a diagnostic that repeats another at the same place, as the error of a template used twice does.
- Updated dependencies [6bbd8e3]
  - @brumate/language-core@0.2.0

## 0.1.3

### Patch Changes

- @brumate/language-core@0.1.3

## 0.1.2

### Patch Changes

- @brumate/language-core@0.1.2

## 0.1.1

### Patch Changes

- @brumate/language-core@0.1.1

## 0.1.0

### Minor Changes

- c530c07: First release of brumate: the compiler, the Vite plugin, the server and client runtimes, routing, type-checking for `.brm` files, and a language server with a VS Code extension.

### Patch Changes

- Updated dependencies [c530c07]
  - @brumate/language-core@0.1.0
