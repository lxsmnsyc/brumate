import { describe, expect, it } from 'vitest';
import { parse } from '../src/parser.ts';
import { classifyComponents, propControls } from '../src/workbench.ts';

const files = new Map(
  Object.entries({
    '/app/Button.brm': `<script>
  import { $props } from 'brumate/signals';
  const { label } = $props<{ label: string }>();
  let pressed = $signal(false);
</script>
<button onClick=(() => (pressed = !pressed))>{label}</button>`,
    '/app/Toolbar.brm': `<script>
  import Button from './Button.brm';
</script>
<div><Button label="Save" /></div>`,
    '/app/Feed.brm': `<script>
  import { $memo } from 'brumate/signals';
  import { feed } from './api.ts';
  const stories = await $memo(feed());
</script>
#for (story of stories by story.id) { <p>{story.title}</p> }`,
    '/app/Page.brm': `<script>
  import Toolbar from './Toolbar.brm';
  import Feed from './Feed.brm';
</script>
<Toolbar /><Feed />`,
    '/app/Status.brm': `<script>
  import { getEvent } from 'brumate/server';
  const agent = getEvent().request.headers.get('user-agent');
</script>
<p>{agent}</p>`,
    '/app/Crumbs.brm': `<script>
  const route = $route();
</script>
<p>{route.path}</p>`,
    '/app/Themed.brm': `<script>
  import { Theme } from './theme.ts';
  const theme = $getContext(Theme);
</script>
<p>{theme}</p>`,
    '/app/Quoted.brm': `<script>
  // $route() in a comment
  const note = 'use $navigation() here';
</script>
<p>{note}</p>`,
    '/app/Agent.brm': `<script>
  import * as server from 'brumate/server';
  const agent = server.getEvent().request.headers.get('user-agent');
</script>
<p>{agent}</p>`,
    '/app/Stories.brm': `<script>
  import { $memo } from 'brumate/signals';
  import * as api from './api.ts';
  const stories = await $memo(api.feed());
</script>
#for (story of stories by story.id) { <p>{story.title}</p> }`,
    '/app/Thread.brm': `<script>
  import Thread from './Thread.brm';
  import Feed from './Feed.brm';
  const { depth } = $props<{ depth: number }>();
</script>
#if (depth > 0) { <Thread depth=(depth - 1) /> } #else { <Feed /> }`,
    '/app/Later.brm': `#defer ('visible') { <p>Later</p> } #else { <p>Wait</p> }`,
    '/app/Any.brm': `<script>
  const { as } = $props<{ as: string }>();
</script>
<{as}>Text</>`,
    '/app/Fancy.brm': `<script>
  import Chart from 'charts/Chart.brm';
</script>
<Chart />`,
    '/app/Comment.brm': `<script>
  import Comment from './Comment.brm';
  const { replies } = $props<{ replies: { id: number; replies: unknown[] }[] }>();
</script>
#for (reply of replies by reply.id) { <Comment replies=reply.replies /> }`,
  }),
);

const classes = classifyComponents(files, {
  serverImport: (_, specifier) => specifier === './api.ts',
});
const needs = (file: string) =>
  classes
    .get(file)!
    .needs.map((need) => `${need.kind} ${need.name}${need.via ? ` via ${need.via}` : ''}`);

describe('classifyComponents', () => {
  it('finds the components that depend only on their props and state', () => {
    expect(classes.get('/app/Button.brm')!.selfContained).toBe(true);
    expect(classes.get('/app/Toolbar.brm')!.selfContained).toBe(true);
    // A component that renders itself is self-contained when it is otherwise.
    expect(classes.get('/app/Comment.brm')!.selfContained).toBe(true);
    // A context without a provider has its default.
    expect(classes.get('/app/Themed.brm')!.selfContained).toBe(true);
    // A call in a comment or a string is not a call.
    expect(classes.get('/app/Quoted.brm')!.selfContained).toBe(true);
  });

  it('finds what a component needs, also through the components that it renders', () => {
    expect(needs('/app/Feed.brm')).toEqual(['server feed']);
    expect(needs('/app/Page.brm')).toEqual(['server feed via /app/Feed.brm']);
    expect(needs('/app/Status.brm')).toEqual(['request getEvent']);
    expect(needs('/app/Crumbs.brm')).toEqual(['route $route']);
    expect(needs('/app/Agent.brm')).toEqual(['request * as server']);
    expect(needs('/app/Stories.brm')).toEqual(['server * as api']);
    // A component that renders itself gets the needs of what else it renders.
    expect(needs('/app/Thread.brm')).toEqual(['server feed via /app/Feed.brm']);
    expect(needs('/app/Later.brm')).toEqual(['defer #defer']);
    expect(needs('/app/Any.brm')).toEqual(['dynamic <{…}>']);
    expect(needs('/app/Fancy.brm')).toEqual(['component charts/Chart.brm']);
  });
});

describe('propControls', () => {
  it('makes a control for each prop that it can, from the type and the defaults', () => {
    const file = parse(
      `<script>
  interface Props {
    label: string;
    count?: number;
    disabled?: boolean;
    tone?: 'info' | 'warning' | 'danger';
    size?: 1 | 2 | 3;
    open?: Bindable<boolean>;
    items: string[];
    onPress?: () => void;
  }
  const { label, count = 3, tone = 'info', disabled = false } = $props<Props>();
</script>
<button>{label}</button>`,
      { filename: '/app/Button.brm' },
    );
    expect(propControls(file)).toEqual([
      { name: 'label', optional: false, kind: 'text' },
      { name: 'count', optional: true, kind: 'number', default: 3 },
      { name: 'disabled', optional: true, kind: 'boolean', default: false },
      {
        name: 'tone',
        optional: true,
        kind: 'choice',
        options: ['info', 'warning', 'danger'],
        default: 'info',
      },
      { name: 'size', optional: true, kind: 'choice', options: [1, 2, 3] },
      { name: 'open', optional: true, kind: 'boolean' },
      { name: 'items', optional: false, kind: 'json', empty: [] },
    ]);
  });

  it('reads the types that the file declares', () => {
    const file = parse(
      `<script>
  interface User {
    name: string;
  }
  type Handler = () => void;
  type Tone = 'info' | 'danger';
  interface Base {
    id: string;
    label: number;
  }
  interface Props extends Base {
    label: string;
    user: User;
    onSave: Handler;
    tone?: Tone;
  }
  const { label } = $props<Props & Partial<{ open: boolean }>>();
</script>
<p>{label}</p>`,
      { filename: '/app/Card.brm' },
    );
    expect(propControls(file)).toEqual([
      { name: 'id', optional: false, kind: 'text' },
      { name: 'label', optional: false, kind: 'text' },
      // A required object starts as `{}`, so reading a field of it does not throw.
      { name: 'user', optional: false, kind: 'json', empty: {} },
      { name: 'tone', optional: true, kind: 'choice', options: ['info', 'danger'] },
      { name: 'open', optional: true, kind: 'boolean' },
    ]);
  });

  it('has no controls for a type that it cannot read', () => {
    const file = parse(
      `<script>
  import type { Props } from './types.ts';
  const { label } = $props<Props>();
</script>
<p>{label}</p>`,
      { filename: '/app/Imported.brm' },
    );
    expect(propControls(file)).toBeUndefined();
  });
});
