import { component$, useServerData } from '@qwik.dev/core';
import { App } from './app';

export function todos(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    title: `Todo number ${i + 1}`,
    done: i % 3 === 0,
  }));
}

export default component$(() => {
  const n = useServerData<number>('n') ?? 3;
  return (
    <>
      <head>
        <meta charset="utf-8" />
        <title>bench</title>
      </head>
      <body>
        <App initial={todos(n)} />
      </body>
    </>
  );
});
