import { component$, useSignal } from '@qwik.dev/core';
import { build, remove, swap, update } from '../../../harness/rows.mjs';
import type { Row } from '../../../harness/rows.mjs';

export const App = component$<{ initial: Row[] }>((props) => {
  const rows = useSignal(props.initial);
  const selected = useSignal(0);
  const next = useSignal(props.initial.length + 1);
  return (
    <>
      <div class="jumbotron">
        <h1>Qwik</h1>
        <button
          id="run"
          onClick$={() => {
            rows.value = build(next.value, 1000);
            next.value += 1000;
          }}
        >
          Create 1,000 rows
        </button>
        <button
          id="runlots"
          onClick$={() => {
            rows.value = build(next.value, 10000);
            next.value += 10000;
          }}
        >
          Create 10,000 rows
        </button>
        <button
          id="add"
          onClick$={() => {
            rows.value = [...rows.value, ...build(next.value, 1000)];
            next.value += 1000;
          }}
        >
          Append 1,000 rows
        </button>
        <button id="update" onClick$={() => (rows.value = update(rows.value))}>
          Update every 10th row
        </button>
        <button id="clear" onClick$={() => (rows.value = [])}>
          Clear
        </button>
        <button id="swaprows" onClick$={() => (rows.value = swap(rows.value))}>
          Swap rows
        </button>
      </div>
      <table class="table">
        <tbody>
          {rows.value.map((row) => (
            <tr key={row.id} class={selected.value === row.id ? 'danger' : ''}>
              <td class="col-md-1">{row.id}</td>
              <td class="col-md-4">
                <a class="lbl" onClick$={() => (selected.value = row.id)}>
                  {row.label}
                </a>
              </td>
              <td class="col-md-1">
                <a class="remove" onClick$={() => (rows.value = remove(rows.value, row.id))}>
                  x
                </a>
              </td>
              <td class="col-md-6"></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
});
