# Log: seroval-1-8

- Installed seroval 1.8.0, seroval-plugins 1.8.0, @seroval/transport 0.1.0 (`^` ranges in package.json, lockfile updated).
- Read the d.ts of seroval and the transport. Validators are `validate` fields of a plugin (`seroval/validator`), checked on `fromJSON`, `fromCrossJSON` and `createCrossDeserializer`. There is no separate validate call.
- Moved every import to `seroval/read`, `seroval/write` or `seroval/shared`. `serial.ts` uses shared only. `devtools-calls.ts` loads `seroval/read`.
- Added `validate` to the plugins of brumate whose fields a client can send (element, slot, binding, function, merged, children, raw, component, store, upload). Removed the hand written type checks of the upload plugin.
- A validation failure arrives wrapped in `SerovalDeserializationError`, with the `SerovalPluginValidationError` as cause. `readArgs` in server.ts turns it into a `ServerError` 400 with the message.
- `stream.ts` uses `createJSONWriter` with `toWebStream`, and `createJSONReader` with `fromWebStream`. The own 12 byte header framing, `ChunkReader`, `Refs` and `failPending` are removed. `toChunkStream` and `fromChunkStream` keep their names, so the tests did not change.
- Split the read side into `stream-read.ts`, so the browser (`rpc.ts`, `devtools-calls.ts`) does not load the transport writer.
- The page state stays seroval cross-reference code in a script (`crossSerializeStream`), not a byte stream, so it has no framing to replace. The server wrote that code and the browser runs it, so validators do not apply to it.
- Todos bench: JS before `load` is 5 files, 33.0 kB / 13.8 kB gzip, the same as the base 13.8 kB.
- Review fixes: stream.ts onError, upload index check, unknown plugin tag 400, docs rewrite, rpc chunk size measured (+2.4 kB gzip, from libraries).
