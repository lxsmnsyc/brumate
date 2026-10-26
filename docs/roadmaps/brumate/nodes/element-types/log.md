# Log: element-types

- check.ts: components are `$$Component<P> = (props: P, ...rest: any[]) => unknown`, children are `undefined as any`, templates are async functions that return nothing. as.ts builds element props from `HTMLElementTagNameMap` fields.
- Handler names in the repo are camel case (`onKeyDown`, `onFocusIn`), and the parser lower-cases them. The types take both forms.
- skipLibCheck hides errors in a .d.ts. Checked elements.d.ts once with `--skipLibCheck false`: no error of its own.
- The tag coverage test bites: with `wbr` removed it failed. The DOM lib of this TypeScript has no obsolete tags, so no exclusions.
- Proof of the 14 `@ts-expect-error` lines: a copy of the test with the comments blanked gave 14 errors, one on each line.
