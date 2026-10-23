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
        <style
          dangerouslySetInnerHTML={
            'table{border-collapse:collapse}td{padding:4px 8px;border-top:1px solid #ddd}tr.danger{background:#f2dede}'
          }
        />
      </head>
      <body>
        <App initial={build(1, n)} />
      </body>
    </>
  );
});
