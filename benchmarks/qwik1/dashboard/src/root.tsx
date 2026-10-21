import { component$ } from '@builder.io/qwik';
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
