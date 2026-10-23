// The code samples of the home page, highlighted when the page renders.
import { highlight } from '../repl/highlight.ts';

export const streaming = highlight(
  `<script>
  import { $memo } from 'brumate/signals';
  import { getProfile } from '../data.ts';

  const profile = $memo(getProfile());
</script>

#loading {
  <h2>{profile.name}</h2>
  <p>{profile.bio}</p>
} #else {
  <p class="skeleton">Loading the profile</p>
}`,
  'brm',
);

export const serverFunctions = highlight(
  `<script>
  import { $signal } from 'brumate/signals';
  import { db } from '../db.ts';

  async function like(id: number) {
    'use server';
    return db.posts.like(id);
  }

  let likes = $signal(0);
</script>

<button onClick=(async () => (likes = await like(1)))>
  {likes} likes
</button>`,
  'brm',
);

export const typed = highlight(
  `<script>
  import { $signal } from 'brumate/signals';

  let price = $signal(1);
  let format = $signal((n: number) => n.toFixed(2));
</script>

<button onClick=(() => price++)>{format(price)}</button>`,
  'brm',
);
