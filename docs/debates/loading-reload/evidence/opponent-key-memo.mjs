import { compile } from '/Users/alexis/Documents/GitHub/brumate/packages/brumate/dist/index.js';
const src = `<script>
  import { getUser } from './user.server';
  import { $signal, $memo } from 'brumate/signals';
  let id = $signal(1);
</script>
<button onClick=(() => (id = id + 1))>next</button>
#key (id) {
  <script>
    import { $memo } from 'brumate/signals';
    const user = $memo(getUser(id));
  </script>
  #loading { <h1>{user.name}</h1> } #else { <p>Loading</p> }
}`;
try {
  const r = await compile(src, { filename: 'K.brm' });
  console.log('OK; parts:', Object.keys(r.parts ?? {}));
  console.log(r.server);
  for (const [k, v] of Object.entries(r.parts ?? {})) console.log('--- part', k, '\n', typeof v === 'string' ? v : JSON.stringify(v).slice(0, 1500));
} catch (e) {
  console.log('ERR', e.message.split('\n').slice(0, 4).join('\n'));
}
