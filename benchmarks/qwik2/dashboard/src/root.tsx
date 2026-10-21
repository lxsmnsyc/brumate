import { component$ } from '@qwik.dev/core';
import { Dashboard } from './widgets/Dashboard';

export default component$(() => {
  return (
    <>
      <head>
        <meta charset="utf-8" />
        <title>bench</title>
      </head>
      <body>
        <Dashboard />
      </body>
    </>
  );
});
