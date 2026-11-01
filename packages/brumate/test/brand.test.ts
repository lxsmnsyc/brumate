import { describe, expect, it, vi } from 'vitest';

describe('a value of a runtime class from another copy of the runtime', () => {
  it('keeps the b- attribute of an Internal that the other copy made', async () => {
    const first = await import('../src/runtime/html.ts');
    vi.resetModules();
    const second = await import('../src/runtime/html.ts');
    expect(second.Internal).not.toBe(first.Internal);

    const made = first.internal('click');
    expect(second.ownValue('b-on', made)).toBe('click');
    expect(second.mergeAttributes([{ 'b-on': made }])).toEqual({ 'b-on': made });
    // A plain value from outside still does not write a b- attribute.
    expect(second.ownValue('b-on', 'click')).toBeUndefined();
    expect(second.mergeAttributes([{ 'b-on': 'click' }])).toEqual({});
  });

  it('serializes an Internal that the other copy made', async () => {
    const first = await import('../src/runtime/html.ts');
    vi.resetModules();
    const serial = await import('../src/runtime/serial.ts');
    const { toJSON } = await import('seroval');
    const node = toJSON({ a: first.internal(5) }, { plugins: serial.plugins });
    expect(JSON.stringify(node)).toContain('brumate/internal');
  });
});
