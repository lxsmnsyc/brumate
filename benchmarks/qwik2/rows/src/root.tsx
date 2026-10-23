import { component$, useServerData } from '@qwik.dev/core';
import { build } from '../../../harness/rows.mjs';
import { App } from './app';

export default component$(() => {
  const n = useServerData<number>('n') ?? 0;
  return (
    <>
      <head>
        <meta charset="utf-8" />
        <title>bench</title>
      </head>
      <body>
        <App initial={build(1, n)} />
      </body>
    </>
  );
});
