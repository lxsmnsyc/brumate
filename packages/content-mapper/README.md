# @brumate/content-mapper

Lets TypeScript 7.1 check `.brm` files. TypeScript starts it for each `.brm` file of a project and checks the TypeScript that it returns.

```json
{
  "contentMappers": [{ "package": "@brumate/content-mapper", "extensions": [".brm"] }]
}
```

Run `tsc --noEmit --runExternalCode`. See [TypeScript](https://github.com/lxsmnsyc/brumate/blob/main/website/docs/typescript.md#typescript-7).

Part of [brumate](https://github.com/lxsmnsyc/brumate), a component language and compiler for resumable web apps.
