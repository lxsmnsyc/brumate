# Log: dev-client-entry

- Proof before the fix: the test "load the client entry of the app, and the start module when it has none" in `packages/brumate/test/default-scripts/default-scripts.test.ts` fails on 4673289b. The dev page has `<script type="module" src="/@id/__x00__virtual:brumate/start">` and no tag for `/src/client.ts`, so the marker that the fixture's client entry sets never loads.
- After the fix the same test passes: the tag is `/src/client.ts`, and the dev server serves that file with the marker.
- The client entry in dev is `environments.client.build.rolldownOptions.input` of the resolved config, the input the build uses. The first input counts; an `.html` input counts as none.
