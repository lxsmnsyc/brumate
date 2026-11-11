# Log: attribute-value-case

- Probe on af581bbf (main): `ElementProps<'div'> = { dir: 'LTR', translate: '' }` and `ElementProps<'button'> = { type: 'Submit' }` added to test/elements-types.ts, then `npx tsc --noEmit` in packages/brumate. Result: TS2820 for `"LTR"`, TS2322 for `""`, TS2820 for `"Submit"`. Reproduced.
- Runtime: SWITCHES in html.ts only maps `true` and `false` to words; strings pass through unchanged, so there is no runtime gap.
- Fix is types only: a `Keyword<S>` helper in elements.d.ts. The first 12 characters take any case; the rest of a longer keyword is all lower or all upper case, to keep the union small.
- Left alone: `ol` `type` (`1 a A i I`, case-sensitive), MathML values, `aria-*` values, and attributes that end in `(string & {})`.
