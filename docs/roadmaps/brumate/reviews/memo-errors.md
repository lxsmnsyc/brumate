# Memo errors: probes

From the reviews of #282 (rounds 4 and 5), 2026-10-27. Each fixture goes in packages/brumate/test/render/, and the tests in packages/brumate/test/resume.test.ts with its `resume`, `click` and `waitFor` helpers. The expected results are those of the rule in nodes/memo-errors-at-read/brief.md.

## r4Stale.brm

```brm
<script>
  import { $memo, $signal } from 'brumate/signals';
  import { ran } from './runs.ts';

  let n = $signal(0);
  let m = $signal(0);
  const bad = $memo(n > 0 ? (() => {
    throw new Error(`Bad ${n}`);
  })() : `ok${n}`);
  const both = $memo(ran('both', `${n} ${bad}`) && `${n}/${bad}`);
</script>

<button class="warm" onClick=(() => m++)>Warm</button>
<p class="m">{m}</p>
<button class="bump" onClick=(() => n++)>Bump</button>
<p class="n">{n}</p>
<p class="both">{both}</p>
```

## r4StaleTry.brm

```brm
<script>
  import { $memo, $signal } from 'brumate/signals';

  let n = $signal(0);
  let m = $signal(0);
</script>

<button class="warm" onClick=(() => m++)>Warm</button>
<p class="m">{m}</p>
#try {
  <script>
    const bad = $memo(n > 0 ? (() => {
      throw new Error(`Bad ${n}`);
    })() : 'ok');
    const both = $memo(n > 0 && bad === 'ok' ? (() => {
      throw new Error(`Stale ${n}`);
    })() : `${n}/${bad}`);
  </script>
  <button class="bump" onClick=(() => n++)>Bump</button>
  <p class="both">{both}</p>
} #catch (error) {
  <p class="caught">{String(error)}</p>
}
```

## r4HandlerTry.brm

```brm
<script>
  import { $memo, $signal } from 'brumate/signals';

  let n = $signal(0);
  let m = $signal(0);
  let after = $signal('no');
  const bad = $memo(n > 0 ? (() => {
    throw new Error(`Bad ${n}`);
  })() : 'ok');
</script>

<button class="warm" onClick=(() => m++)>Warm</button>
<p class="m">{m}</p>
<p class="bad">{bad}</p>
<p class="after">{after}</p>
#try {
  <button class="bump" onClick=(() => {
    n++;
    after = 'yes';
  })>Bump</button>
} #catch (error) {
  <p class="caught">{String(error)}</p>
}
```

## r5Effect.brm

```brm
<script>
  import { $effect, $memo, $signal } from 'brumate/signals';
  import { ran } from './runs.ts';

  let count = $signal(0);
  let other = $signal(0);
  const bad = $memo(count > 0 ? (() => {
    throw new Error(`Bad ${count}`);
  })() : `ok${count}`);

  $effect(() => {
    ran('both', `${count} ${bad}`);
  });
  $effect(() => {
    ran('bad', `${bad}`);
  });
  $effect(() => {
    ran('count', `${count}`);
  });
</script>

<button class="warm" onClick=(() => other++)>Warm</button>
<p class="other">{other}</p>
<button class="bump" onClick=(() => count++)>Bump</button>
<p class="c">{count}</p>
```

## r5Split.brm

```brm
<script>
  import { $memo, $signal } from 'brumate/signals';
  import R5Show from './R5Show.brm';

  let count = $signal(0);
  let other = $signal(0);
  let side = $signal(0);
</script>

<button class="warm" onClick=(() => other++)>Warm</button>
<p class="other">{other}</p>
<button class="bump" onClick=(() => count++)>Bump</button>
<button class="two" onClick=(() => {
  count++;
  side++;
})>Two</button>
<p class="c">{count}</p>
<p class="side">{side}</p>
#try {
  <script>
    const bad = $memo(count > 0 ? (() => {
      throw new Error(`Bad ${count}`);
    })() : 'ok');
  </script>
  <p class="a">{bad}</p>
} #catch (error) {
  <p class="caught">{String(error)}</p>
}
#if (other >= 0) {
  <p class="b">{count}</p>
}
<R5Show value=(count) />
```

## r5Split2.brm

```brm
<script>
  import { $memo, $signal } from 'brumate/signals';
  import R5Show from './R5Show.brm';

  let count = $signal(0);
  let other = $signal(0);
  let side = $signal(0);
</script>

<button class="warm" onClick=(() => other++)>Warm</button>
<p class="other">{other}</p>
<button class="bump" onClick=(() => count++)>Bump</button>
<button class="two" onClick=(() => {
  count++;
  side++;
})>Two</button>
<p class="c">{count}</p>
<p class="side">{side}</p>
#try {
  <script>
    const bad = $memo(count > 0 ? (() => {
      throw new Error(`Bad ${count}`);
    })() : 'ok');
  </script>
  <button class="in" onClick=(() => count++)>In</button>
  <p class="a">{bad}</p>
} #catch (error) {
  <p class="caught">{String(error)}</p>
}
#if (other >= 0) {
  <p class="b">{count}</p>
}
<R5Show value=(count) />
```

## R5Show.brm

```brm
<script>
  import { $props } from 'brumate/signals';

  const { value } = $props<{ value: number }>();
</script>

<p class="kid">{value}</p>
```
