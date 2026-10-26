// The tests of the color model follow the tests of Color in React Stately.
import { describe, expect, it } from 'vitest';
import {
  areaChannels,
  areaGradient,
  channelGradient,
  channelRange,
  channelValue,
  colorName,
  displayColor,
  formatChannelValue,
  formatColor,
  formatLike,
  parseColor,
  sameColor,
  toSpace,
  tryParseColor,
  withChannelValue,
} from '../src/color.ts';

describe('parseColor', () => {
  it('reads hex with 3, 4, 6 and 8 digits', () => {
    expect(parseColor('#abc')).toEqual({ space: 'rgb', values: [170, 187, 204], alpha: 1 });
    expect(parseColor('#AABBCC')).toEqual({ space: 'rgb', values: [170, 187, 204], alpha: 1 });
    expect(parseColor('#abc8').alpha).toBeCloseTo(0.53, 2);
    expect(parseColor('#aabbcc80').alpha).toBeCloseTo(0.5, 2);
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

describe('precision', () => {
  it('keeps the alpha of hexa, and rounds it only when it formats', () => {
    expect(parseColor('#AABBCCDD').alpha).toBe(221 / 255);
    expect(formatColor(parseColor('#AABBCCDD'), 'hexa')).toBe('#AABBCCDD');
    expect(formatColor(parseColor('#00000001'), 'hexa')).toBe('#00000001');
    expect(formatLike(parseColor('#00000001'), '#000000')).toBe('#00000001');
  });

  it('gives undefined for a value that is not text', () => {
    expect(tryParseColor(null)).toBeUndefined();
    expect(tryParseColor(undefined)).toBeUndefined();
    expect(tryParseColor(12 as never)).toBeUndefined();
  });

  it('compares colors, not text', () => {
    expect(sameColor('#887f7f', '#887F7F')).toBe(true);
    expect(sameColor('#e2445a', 'rgb(226, 68, 90)')).toBe(true);
    expect(sameColor('#e2445a', parseColor('#E2445A'))).toBe(true);
    expect(sameColor('#e2445a', '#e2445b')).toBe(false);
    expect(sameColor('#AABBCCDD', '#AABBCCDE')).toBe(false);
    expect(sameColor('#aabbcc', '#aabbccff')).toBe(true);
    expect(sameColor('#aabbcc', '#aabbcc80')).toBe(false);
    expect(sameColor('nope', 'nope')).toBe(true);
    expect(sameColor('nope', '#000000')).toBe(false);
    expect(sameColor(null, null)).toBe(true);
    expect(sameColor(null, '#000000')).toBe(false);
  });
});

describe('colorName', () => {
  it('names the transparency only when its percent is above 0', () => {
    expect(colorName(parseColor('rgba(255, 0, 0, 0.999)'))).toBe('red');
    expect(colorName(parseColor('rgba(255, 0, 0, 0.99)'))).toBe('red, 1% transparent');
  });

  it('names a color by its hue, its shade and its alpha', () => {
    expect(colorName(parseColor('#ff0000'))).toBe('red');
    expect(colorName(parseColor('hsl(360, 100%, 50%)'))).toBe('red');
    expect(colorName(parseColor('#00008b'))).toBe('dark blue');
    expect(colorName(parseColor('#d3d3d3'))).toBe('light gray');
    expect(colorName(parseColor('#ffffff'))).toBe('white');
    expect(colorName(parseColor('rgba(0, 128, 0, 0.25)'))).toBe('dark green, 75% transparent');
    expect(colorName(parseColor('rgba(0, 200, 0, 0.25)'))).toBe('green, 75% transparent');
  });
});

describe('displayColor', () => {
  it('shows a hue at full color, and a channel without its alpha', () => {
    expect(displayColor(parseColor('#336699'), 'hue')).toEqual({
      space: 'hsl',
      values: [210, 100, 50],
      alpha: 1,
    });
    expect(displayColor(parseColor('rgba(10, 20, 30, 0.5)'), 'red').alpha).toBe(1);
    expect(displayColor(parseColor('rgba(10, 20, 30, 0.5)'), 'alpha').alpha).toBe(0.5);
  });
});

describe('channelGradient', () => {
  it('goes through the hues of the wheel', () => {
    const gradient = channelGradient(parseColor('#336699'), 'hue', 'right');
    expect(gradient).toBe(
      'linear-gradient(to right, hsla(0, 100%, 50%, 1), hsla(60, 100%, 50%, 1), hsla(120, 100%, 50%, 1), hsla(180, 100%, 50%, 1), hsla(240, 100%, 50%, 1), hsla(300, 100%, 50%, 1), hsla(360, 100%, 50%, 1))',
    );
  });

  it('goes from the lowest to the highest value, and through the middle for lightness', () => {
    expect(channelGradient(parseColor('rgb(10, 20, 30)'), 'red', 'top')).toBe(
      'linear-gradient(to top, rgba(0, 20, 30, 1), rgba(255, 20, 30, 1))',
    );
    expect(channelGradient(parseColor('hsl(120, 100%, 40%)'), 'lightness', 'left')).toBe(
      'linear-gradient(to left, hsla(120, 100%, 0%, 1), hsla(120, 100%, 50%, 1), hsla(120, 100%, 100%, 1))',
    );
  });

  it('shows alpha over a checkerboard', () => {
    const gradient = channelGradient(parseColor('rgb(10, 20, 30)'), 'alpha', 'right');
    expect(gradient).toMatch(
      /^linear-gradient\(to right, rgba\(10, 20, 30, 0\), rgba\(10, 20, 30, 1\)\), repeating-conic-gradient/,
    );
  });

  describe('areaGradient', () => {
    it('lays brightness over saturation at the hue, for hsb', () => {
      const { background, blendMode } = areaGradient(
        parseColor('hsb(210, 50%, 80%)'),
        'saturation',
        'brightness',
        'right',
      );
      expect(blendMode).toBe('normal');
      expect(background).toBe(
        'linear-gradient(to top, hsla(210, 0%, 0%, 1), hsla(210, 0%, 0%, 0)), linear-gradient(to right, hsla(210, 0%, 100%, 1), hsla(210, 100%, 50%, 1))',
      );
    });

    it('goes left for x right to left, and swaps the axes', () => {
      const { background } = areaGradient(
        parseColor('hsb(210, 50%, 80%)'),
        'brightness',
        'saturation',
        'left',
      );
      expect(background).toBe(
        'linear-gradient(to left, hsla(210, 0%, 0%, 1), hsla(210, 0%, 0%, 0)), linear-gradient(to top, hsla(210, 0%, 100%, 1), hsla(210, 100%, 50%, 1))',
      );
    });

    it('runs the hue along an axis, with the other channel as it is', () => {
      const { background } = areaGradient(
        parseColor('hsb(210, 50%, 80%)'),
        'hue',
        'brightness',
        'right',
      );
      expect(background).toMatch(
        /^linear-gradient\(to top, hsla\(210, 0%, 0%, 1\), hsla\(210, 0%, 0%, 0\)\), linear-gradient\(to right, hsla\(0, 100%, 75%, 1\)/,
      );
      const saturation = areaGradient(
        parseColor('hsb(210, 50%, 80%)'),
        'hue',
        'saturation',
        'right',
      );
      // A gray of the brightness fades out as saturation grows.
      expect(saturation.background).toMatch(
        /^linear-gradient\(to top, hsla\(210, 0%, 80%, 1\), hsla\(210, 0%, 80%, 0\)\), linear-gradient\(to right, hsla\(0, 100%, 40%, 1\)/,
      );
    });

    it('puts the middle of lightness at the pure color, for hsl', () => {
      const { background } = areaGradient(
        parseColor('hsl(120, 50%, 50%)'),
        'saturation',
        'lightness',
        'right',
      );
      expect(background).toBe(
        'linear-gradient(to top, hsla(120, 0%, 0%, 1), hsla(120, 0%, 0%, 0) 50%, hsla(120, 0%, 100%, 0) 50%, hsla(120, 0%, 100%, 1)), linear-gradient(to right, hsla(120, 0%, 50%, 1), hsla(120, 100%, 50%, 1))',
      );
    });

    it('adds the channels of rgb with screen, and holds the other one', () => {
      const { background, blendMode } = areaGradient(
        parseColor('#336699'),
        'red',
        'green',
        'right',
      );
      expect(blendMode).toBe('screen');
      expect(background).toBe(
        'linear-gradient(to right, rgba(0, 0, 0, 1), rgba(255, 0, 0, 1)), linear-gradient(to top, rgba(0, 0, 0, 1), rgba(0, 255, 0, 1)), linear-gradient(rgba(0, 0, 153, 1), rgba(0, 0, 153, 1))',
      );
    });
  });

  describe('areaChannels', () => {
    it('is saturation and brightness in hsb without channels', () => {
      expect(areaChannels()).toEqual({ space: 'hsb', x: 'saturation', y: 'brightness' });
      expect(areaChannels(undefined, undefined, 'hsl')).toEqual({
        space: 'hsl',
        x: 'saturation',
        y: 'lightness',
      });
      expect(areaChannels(undefined, undefined, 'rgb')).toEqual({
        space: 'rgb',
        x: 'green',
        y: 'blue',
      });
    });

    it('finds the space of the channels, and fills in the one that is missing', () => {
      expect(areaChannels('red', 'green').space).toBe('rgb');
      expect(areaChannels('saturation', 'lightness').space).toBe('hsl');
      expect(areaChannels('hue', 'brightness').space).toBe('hsb');
      expect(areaChannels('brightness')).toMatchObject({ x: 'brightness', y: 'saturation' });
      expect(areaChannels(undefined, 'saturation')).toMatchObject({
        x: 'brightness',
        y: 'saturation',
      });
    });
  });
});
