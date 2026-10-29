import { compile } from '/Users/alexis/Documents/GitHub/brumate/packages/brumate/dist/index.js';
const mk = (h) => `<script>
  import { fetchUser } from './user';
  import { $signal, $memo } from 'brumate/signals';
  let userID = $signal(1);
  function next() { userID = 2; }
  const data = $memo(fetchUser(userID));
</script>
#loading${h} {
  <h1>{data.name}</h1>
} #else { <p>Loading</p> }
<button onClick={next}>x</button>`;
for (const h of ['', ' (data)']) {
  try { const r = await compile(mk(h), { filename: 'A.brm' });
    console.log(JSON.stringify(h), 'OK server-len', r.server.length, 'client parts', Object.keys(r.parts), JSON.stringify(r.parts.update).length);
  } catch (e) { console.log(JSON.stringify(h), 'ERR', e.message.split('\n')[0]); }
}
for (const h of ['', ' (data)']) { const r = await compile(mk(h), { filename: 'A.brm' }); console.log('#####', h); console.log(r.server); }
