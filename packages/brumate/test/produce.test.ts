import { describe, expect, it } from 'vitest';
import { produce } from '../src/runtime/produce.ts';

describe('produce', () => {
  const todos = [
    { id: '1', title: 'Docs', done: true, tags: ['a'] },
    { id: '2', title: 'Compiler', done: false, tags: ['b'] },
  ];

  it('returns the value itself when nothing changes', () => {
    expect(produce(todos, () => {})).toBe(todos);
    expect(
      produce(todos, (draft) => {
        draft[0]!.done = true;
      }),
    ).toBe(todos);
  });

  it('copies only what changes', () => {
    const next = produce(todos, (draft) => {
      draft[1]!.done = true;
    });
    expect(next).not.toBe(todos);
    expect(next[0]).toBe(todos[0]);
    expect(next[1]).toEqual({ ...todos[1], done: true });
    expect(next[1]!.tags).toBe(todos[1]!.tags);
    expect(todos[1]!.done).toBe(false);
  });

  it('supports array methods', () => {
    const next = produce(todos, (draft) => {
      draft.push({ id: '3', title: 'Ship', done: false, tags: [] });
      draft.splice(0, 1);
    });
    expect(next.map((todo) => todo.id)).toEqual(['2', '3']);
    expect(next[0]).toBe(todos[1]);
    expect(todos).toHaveLength(2);
  });

  it('keeps unchanged items when an array is reordered', () => {
    const next = produce(todos, (draft) => {
      draft.reverse();
    });
    expect(next[0]).toBe(todos[1]);
    expect(next[1]).toBe(todos[0]);
  });

  it('changes nested values', () => {
    const next = produce(todos, (draft) => {
      draft[0]!.tags.push('z');
    });
    expect(next[0]!.tags).toEqual(['a', 'z']);
    expect(next[1]).toBe(todos[1]);
    expect(todos[0]!.tags).toEqual(['a']);
  });

  it('deletes keys', () => {
    const user = { name: 'Ada', nickname: 'A' };
    const next = produce(user, (draft: { name: string; nickname?: string }) => {
      delete draft.nickname;
    });
    expect(next).toEqual({ name: 'Ada' });
    expect(user.nickname).toBe('A');
  });

  it('uses a returned value', () => {
    const open = produce(todos, (draft) => draft.filter((todo) => !todo.done));
    expect(open).toEqual([todos[1]]);
    expect(open[0]).toBe(todos[1]);
    expect(produce(1, (value) => value + 1)).toBe(2);
  });
});
