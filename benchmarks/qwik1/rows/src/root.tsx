import { component$, useServerData } from '@builder.io/qwik';
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
