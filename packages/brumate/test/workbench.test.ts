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
    '/app/Where.brm': `<p>{$route().path}</p>`,
    '/app/Typed.brm': `<script>
  import * as T from './api.ts';
  import * as server from 'brumate/server';
  const { label } = $props<{ label: T.Label }>();
</script>
<p>{label}</p>`,
    '/app/Passed.brm': `<script>
  import * as api from './api.ts';
  const { feed } = api;
  const stories = await $memo(feed());
</script>
<p>{stories.length}</p>`,
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
    // A namespace that only types use, or that nothing uses, is not a need.
    expect(classes.get('/app/Typed.brm')!.selfContained).toBe(true);
  });

  it('finds what a component needs, also through the components that it renders', () => {
    expect(needs('/app/Feed.brm')).toEqual(['server feed']);
    expect(needs('/app/Page.brm')).toEqual(['server feed via /app/Feed.brm']);
    expect(needs('/app/Status.brm')).toEqual(['request getEvent']);
    expect(needs('/app/Crumbs.brm')).toEqual(['route $route']);
    expect(needs('/app/Where.brm')).toEqual(['route $route']);
    expect(needs('/app/Agent.brm')).toEqual(['request * as server']);
    expect(needs('/app/Stories.brm')).toEqual(['server * as api']);
    expect(needs('/app/Passed.brm')).toEqual(['server * as api']);
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

  it('reads a type that two branches reach, and keeps a prop required when one branch requires it', () => {
    const file = parse(
      `<script>
  interface Base {
    label: number;
    id: string;
  }
  interface Mid extends Base {
    label: string;
  }
  interface Extra {
    note?: string;
    id?: string;
  }
  const { label } = $props<Mid & Base & Partial<Extra>>();
</script>
<p>{label}</p>`,
      { filename: '/app/Both.brm' },
    );
    const controls = propControls(file)!;
    expect(controls.map((control) => control.name)).toEqual(['label', 'id', 'note']);
    expect(controls.find((control) => control.name === 'id')!.optional).toBe(false);
    expect(controls.find((control) => control.name === 'note')!.optional).toBe(true);
  });

  it('puts the prop of an interface in the place of the one that it replaces', () => {
    const file = parse(
      `<script>
  interface Base {
    label: number;
    id: string;
  }
  interface Props extends Base {
    label: string;
  }
  const { label } = $props<Props>();
</script>
<p>{label}</p>`,
      { filename: '/app/Override.brm' },
    );
    expect(propControls(file)).toEqual([
      { name: 'label', optional: false, kind: 'text' },
      { name: 'id', optional: false, kind: 'text' },
    ]);
  });

  it('has no controls for a generic type', () => {
    const file = parse(
      `<script>
  interface Base<T> {
    value: T;
  }
  interface Props extends Base<string> {}
  const { value } = $props<Props>();
</script>
<p>{value}</p>`,
      { filename: '/app/Generic.brm' },
    );
    expect(propControls(file)).toBeUndefined();
  });

  it('keeps a prop whose name is a number next to a method', () => {
    const file = parse(
      `<script>
  interface A {
    '0'?: string;
  }
  interface B {
    go(): void;
  }
  const props = $props<B & A>();
</script>
<p>x</p>`,
      { filename: '/app/Numbered.brm' },
    );
    expect(propControls(file)).toEqual([{ name: '0', optional: true, kind: 'text' }]);
  });

  it('reads a type that many branches reach in little time', () => {
    const levels = Array.from({ length: 30 }, (_, index) =>
      index === 0
        ? 'interface T0 { label: string; }'
        : `interface T${index} extends T${index - 1}, T${index - 1} { p${index}?: number; }`,
    );
    const file = parse(
      `<script>
  ${levels.join('\n  ')}
  const props = $props<T29>();
</script>
<p>x</p>`,
      { filename: '/app/Deep.brm' },
    );
    expect(propControls(file)).toHaveLength(30);
  });
});
