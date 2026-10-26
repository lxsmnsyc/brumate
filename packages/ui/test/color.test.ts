// The tests of the color model follow the tests of Color in React Stately.
import { describe, expect, it } from 'vitest';
import {
  channelRange,
  channelValue,
  colorName,
  formatChannelValue,
  formatColor,
  formatLike,
  parseColor,
  toSpace,
  tryParseColor,
  withChannelValue,
} from '../src/color.ts';

describe('parseColor', () => {
  it('reads hex with 3, 4, 6 and 8 digits', () => {
    expect(parseColor('#abc')).toEqual({ space: 'rgb', values: [170, 187, 204], alpha: 1 });
    expect(parseColor('#AABBCC')).toEqual({ space: 'rgb', values: [170, 187, 204], alpha: 1 });
    expect(parseColor('#abc8').alpha).toBe(0.53);
    expect(parseColor('#aabbcc80').alpha).toBe(0.5);
  });

  it('reads rgb, hsl and hsb, with alpha, commas or spaces, and percents', () => {
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ space: 'rgb', values: [255, 0, 0], alpha: 1 });
    expect(parseColor('rgba(255 0 0 / 50%)').alpha).toBe(0.5);
    expect(parseColor('rgb(100%, 0%, 0%)').values).toEqual([255, 0, 0]);
    expect(parseColor('hsl(120deg, 100%, 50%)')).toEqual({
      space: 'hsl',
      values: [120, 100, 50],
      alpha: 1,
    });
    expect(parseColor('hsba(240, 50%, 100%, 0.3)')).toEqual({
      space: 'hsb',
      values: [240, 50, 100],
      alpha: 0.3,
    });
  });

  it('keeps channels in their ranges, and wraps the hue', () => {
    expect(parseColor('rgb(300, -5, 0)').values).toEqual([255, 0, 0]);
    expect(parseColor('hsl(-30, 150%, 50%)').values).toEqual([330, 100, 50]);
    expect(parseColor('hsl(360, 100%, 50%)').values[0]).toBe(360);
  });

  it('throws on text that is not a color, which tryParseColor gives as undefined', () => {
    expect(() => parseColor('red')).toThrow('Invalid color: red');
    expect(tryParseColor('#12')).toBeUndefined();
    expect(tryParseColor('rgb(1, 2)')).toBeUndefined();
  });
});

describe('spaces', () => {
  it('converts between rgb, hsl and hsb', () => {
    const red = parseColor('#ff0000');
    expect(toSpace(red, 'hsl').values).toEqual([0, 100, 50]);
    expect(toSpace(red, 'hsb').values).toEqual([0, 100, 100]);
    expect(formatColor(parseColor('hsl(210, 50%, 40%)'), 'hex')).toBe('#336699');
    expect(formatColor(parseColor('hsb(210, 66.67%, 60%)'), 'hex')).toBe('#336699');
  });

  it('keeps the hue between hsl and hsb, also for a gray', () => {
    const gray = parseColor('hsl(200, 0%, 50%)');
    expect(toSpace(gray, 'hsb').values).toEqual([200, 0, 50]);
    expect(toSpace(toSpace(gray, 'hsb'), 'hsl').values).toEqual([200, 0, 50]);
  });
});

describe('formatColor', () => {
  const color = parseColor('hsla(210, 50%, 40%, 0.5)');

  it('writes each format', () => {
    expect(formatColor(color, 'hex')).toBe('#336699');
    expect(formatColor(color, 'hexa')).toBe('#33669980');
    expect(formatColor(color, 'rgb')).toBe('rgb(51, 102, 153)');
    expect(formatColor(color, 'rgba')).toBe('rgba(51, 102, 153, 0.5)');
    expect(formatColor(color, 'hsl')).toBe('hsl(210, 50%, 40%)');
    expect(formatColor(color, 'hsba')).toBe('hsba(210, 66.67%, 60%, 0.5)');
  });

  it('writes css in the space of the color, and hsb as hsl, which CSS reads', () => {
    expect(formatColor(parseColor('#336699'))).toBe('rgba(51, 102, 153, 1)');
    expect(formatColor(color)).toBe('hsla(210, 50%, 40%, 0.5)');
    expect(formatColor(parseColor('hsb(210, 66.67%, 60%)'))).toBe('hsla(210, 50%, 40%, 1)');
  });

  it('gives back the format that it was given, with formatLike', () => {
    const next = withChannelValue(parseColor('#336699'), 'red', 255);
    expect(formatLike(next, '#336699')).toBe('#FF6699');
    expect(formatLike(withChannelValue(next, 'alpha', 0.5), '#336699')).toBe('#FF669980');
    expect(formatLike(parseColor('hsl(10, 20%, 30%)'), 'hsl(0, 0%, 0%)')).toBe('hsl(10, 20%, 30%)');
  });
});

describe('channels', () => {
  it('has the ranges of React Stately', () => {
    expect(channelRange('hue')).toEqual({ minValue: 0, maxValue: 360, step: 1, pageSize: 15 });
    expect(channelRange('red')).toEqual({ minValue: 0, maxValue: 255, step: 1, pageSize: 17 });
    expect(channelRange('alpha')).toEqual({ minValue: 0, maxValue: 1, step: 0.01, pageSize: 0.1 });
  });

  it('reads a channel of another space', () => {
    const color = parseColor('#ff0000');
    expect(channelValue(color, 'hue')).toBe(0);
    expect(channelValue(color, 'lightness')).toBe(50);
    expect(channelValue(color, 'alpha')).toBe(1);
  });

  it('writes a channel in the space of the color, or moves to a space that has it', () => {
    const color = parseColor('hsl(0, 100%, 50%)');
    expect(withChannelValue(color, 'hue', 120)).toEqual({
      space: 'hsl',
      values: [120, 100, 50],
      alpha: 1,
    });
    expect(withChannelValue(color, 'brightness', 50).space).toBe('hsb');
    expect(withChannelValue(parseColor('#ff0000'), 'hue', 400).values[0]).toBe(360);
  });

  it('formats a value for the locale', () => {
    const color = parseColor('hsla(120, 50%, 25%, 0.8)');
    expect(formatChannelValue(color, 'hue', 'en-US')).toBe('120°');
    expect(formatChannelValue(color, 'saturation', 'en-US')).toBe('50%');
    expect(formatChannelValue(color, 'alpha', 'en-US')).toBe('80%');
    expect(formatChannelValue(color, 'red', 'en-US')).toBe('32');
  });
});

describe('colorName', () => {
  it('names a color by its hue, its shade and its alpha', () => {
    expect(colorName(parseColor('#ff0000'))).toBe('red');
    expect(colorName(parseColor('#00008b'))).toBe('dark blue');
    expect(colorName(parseColor('#d3d3d3'))).toBe('light gray');
    expect(colorName(parseColor('#ffffff'))).toBe('white');
    expect(colorName(parseColor('rgba(0, 128, 0, 0.25)'))).toBe('dark green, 75% transparent');
    expect(colorName(parseColor('rgba(0, 200, 0, 0.25)'))).toBe('green, 75% transparent');
  });
});
