// The color of the color parts, after the Color of React Stately. A color goes in the state of the
// page as a string of CSS, such as `#e2445a` or `hsl(355, 74%, 58%)`, since the page state cannot
// hold an instance of a class. The parts parse it with `parseColor`, and give back a string.

import { clamp } from './numbers.ts';

/** The space of a color: the channels that it keeps. */
export type ColorSpace = 'rgb' | 'hsl' | 'hsb';

/** A channel of a color. */
export type ColorChannel =
  | 'red'
  | 'green'
  | 'blue'
  | 'hue'
  | 'saturation'
  | 'lightness'
  | 'brightness'
  | 'alpha';

/** The formats of `formatColor`. `css` is the format of the space of the color, with its alpha. */
export type ColorFormat = 'hex' | 'hexa' | 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'hsb' | 'hsba' | 'css';

/**
 * A color. `values` are the channels of its space: red, green and blue from 0 to 255, or hue from
 * 0 to 360 and two percents from 0 to 100. `alpha` is from 0 to 1.
 */
export interface Color {
  space: ColorSpace;
  values: [number, number, number];
  alpha: number;
}

/** The channels of each space, in order. */
export const SPACE_CHANNELS: Record<ColorSpace, [ColorChannel, ColorChannel, ColorChannel]> = {
  rgb: ['red', 'green', 'blue'],
  hsl: ['hue', 'saturation', 'lightness'],
  hsb: ['hue', 'saturation', 'brightness'],
};

/** The range of a channel, its step, and the step of PageUp and PageDown, as in React Stately. */
export interface ChannelRange {
  minValue: number;
  maxValue: number;
  step: number;
  pageSize: number;
}

const RANGES: Record<ColorChannel, ChannelRange> = {
  red: { minValue: 0, maxValue: 255, step: 1, pageSize: 17 },
  green: { minValue: 0, maxValue: 255, step: 1, pageSize: 17 },
  blue: { minValue: 0, maxValue: 255, step: 1, pageSize: 17 },
  hue: { minValue: 0, maxValue: 360, step: 1, pageSize: 15 },
  saturation: { minValue: 0, maxValue: 100, step: 1, pageSize: 10 },
  lightness: { minValue: 0, maxValue: 100, step: 1, pageSize: 10 },
  brightness: { minValue: 0, maxValue: 100, step: 1, pageSize: 10 },
  alpha: { minValue: 0, maxValue: 1, step: 0.01, pageSize: 0.1 },
};

/** The range of a channel. */
export function channelRange(channel: ColorChannel): ChannelRange {
  return RANGES[channel];
}

const NAMES: Record<ColorChannel, string> = {
  red: 'Red',
  green: 'Green',
  blue: 'Blue',
  hue: 'Hue',
  saturation: 'Saturation',
  lightness: 'Lightness',
  brightness: 'Brightness',
  alpha: 'Alpha',
};

/** The name of a channel, such as `Hue`, for a label that the caller does not give. */
export function channelName(channel: ColorChannel): string {
  return NAMES[channel];
}

// Parsing.

const NUMBER = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?`;
const FUNCTION = new RegExp(
  String.raw`^(rgba?|hsla?|hsba?)\(\s*(${NUMBER})(deg|%)?\s*[,\s]\s*(${NUMBER})(%)?\s*[,\s]\s*(${NUMBER})(%)?\s*(?:[,/]\s*(${NUMBER})(%)?\s*)?\)$`,
  'i',
);

/** Parses a color of CSS: hex, `rgb()`, `hsl()` or `hsb()`, with or without alpha. */
export function parseColor(value: string): Color {
  const color = tryParseColor(value);
  if (!color) {
    throw new Error(`Invalid color: ${value}`);
  }
  return color;
}

/** Parses a color, or gives undefined for text that is not one. */
export function tryParseColor(value: string): Color | undefined {
  const text = value.trim();
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text);
  if (hex) {
    let digits = hex[1]!;
    if (digits.length <= 4) {
      digits = [...digits].map((digit) => digit + digit).join('');
    }
    const at = (index: number) => parseInt(digits.slice(index, index + 2), 16);
    return {
      space: 'rgb',
      values: [at(0), at(2), at(4)],
      alpha: digits.length === 8 ? round(at(6) / 255, 2) : 1,
    };
  }
  const match = FUNCTION.exec(text);
  if (!match) {
    return undefined;
  }
  const kind = match[1]!.toLowerCase();
  const first = Number(match[2]);
  const second = Number(match[4]);
  const third = Number(match[6]);
  const alpha = match[8] === undefined ? 1 : clamp(Number(match[8]) / (match[9] ? 100 : 1), 0, 1);
  if (kind.startsWith('rgb')) {
    return {
      space: 'rgb',
      values: [
        rgbChannel(first, match[3]),
        rgbChannel(second, match[5]),
        rgbChannel(third, match[7]),
      ],
      alpha,
    };
  }
  return {
    space: kind.startsWith('hsl') ? 'hsl' : 'hsb',
    values: [normalizeHue(first), clamp(second, 0, 100), clamp(third, 0, 100)],
    alpha,
  };
}

/** A channel of `rgb()`, a number to 255 or a percent. */
function rgbChannel(number: number, percent: string | undefined): number {
  return clamp(percent ? (number / 100) * 255 : number, 0, 255);
}

function normalizeHue(hue: number): number {
  return hue === 360 ? 360 : ((hue % 360) + 360) % 360;
}

function round(value: number, digits: number): number {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

// Spaces.

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const s = saturation / 100;
  const l = lightness / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    return (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return [f(0), f(8), f(4)];
}

function hsbToRgb(hue: number, saturation: number, brightness: number): [number, number, number] {
  const s = saturation / 100;
  const v = brightness / 100;
  const f = (n: number) => {
    const k = (n + hue / 60) % 6;
    return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return [f(5), f(3), f(1)];
}

/** The hue, the chroma, and the largest and the smallest channel, from 0 to 1. */
function rgbParts(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  let hue = 0;
  if (chroma > 0) {
    if (max === r) {
      hue = ((g - b) / chroma) % 6;
    } else if (max === g) {
      hue = (b - r) / chroma + 2;
    } else {
      hue = (r - g) / chroma + 4;
    }
    hue = normalizeHue(hue * 60);
  }
  return { hue, max, min, chroma };
}

function rgbToHsl(red: number, green: number, blue: number): [number, number, number] {
  const { hue, max, min, chroma } = rgbParts(red, green, blue);
  const lightness = (max + min) / 2;
  const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1));
  return [hue, saturation * 100, lightness * 100];
}

function rgbToHsb(red: number, green: number, blue: number): [number, number, number] {
  const { hue, max, chroma } = rgbParts(red, green, blue);
  return [hue, max === 0 ? 0 : (chroma / max) * 100, max * 100];
}

/** The color in another space. Its hue stays when the other space has one too. */
export function toSpace(color: Color, space: ColorSpace): Color {
  if (color.space === space) {
    return color;
  }
  const [a, b, c] = color.values;
  if (color.space !== 'rgb' && space !== 'rgb') {
    // HSL and HSB keep the hue, so a gray keeps the hue that a slider of hue moved it to.
    if (space === 'hsb') {
      const s = b / 100;
      const l = c / 100;
      const brightness = l + s * Math.min(l, 1 - l);
      const saturation = brightness === 0 ? 0 : 2 * (1 - l / brightness);
      return { space, values: [a, saturation * 100, brightness * 100], alpha: color.alpha };
    }
    const s = b / 100;
    const v = c / 100;
    const lightness = v * (1 - s / 2);
    const saturation =
      lightness === 0 || lightness === 1 ? 0 : (v - lightness) / Math.min(lightness, 1 - lightness);
    return { space, values: [a, saturation * 100, lightness * 100], alpha: color.alpha };
  }
  let rgb = color.values;
  if (color.space === 'hsl') {
    rgb = hslToRgb(a, b, c);
  } else if (color.space === 'hsb') {
    rgb = hsbToRgb(a, b, c);
  }
  if (space === 'rgb') {
    return { space, values: rgb, alpha: color.alpha };
  }
  return {
    space,
    values: space === 'hsl' ? rgbToHsl(...rgb) : rgbToHsb(...rgb),
    alpha: color.alpha,
  };
}

// Channels.

/** The value of a channel. A channel of another space reads the color in that space. */
export function channelValue(color: Color, channel: ColorChannel): number {
  if (channel === 'alpha') {
    return color.alpha;
  }
  const own = SPACE_CHANNELS[color.space].indexOf(channel);
  if (own >= 0) {
    return color.values[own]!;
  }
  const space = spaceOf(channel);
  return toSpace(color, space).values[SPACE_CHANNELS[space].indexOf(channel)]!;
}

/** A space that has the channel: the space of the color when it has it, or the first one. */
function spaceOf(channel: ColorChannel, preferred?: ColorSpace): ColorSpace {
  if (preferred && SPACE_CHANNELS[preferred].includes(channel)) {
    return preferred;
  }
  if (channel === 'lightness') {
    return 'hsl';
  }
  if (channel === 'brightness' || channel === 'hue' || channel === 'saturation') {
    return 'hsb';
  }
  return 'rgb';
}

/**
 * The color with a channel at a value, kept in its range. The color keeps its space, unless the
 * space has no such channel, and then it moves to one that has it, as React Stately does.
 */
export function withChannelValue(color: Color, channel: ColorChannel, value: number): Color {
  const range = RANGES[channel];
  const next = clamp(value, range.minValue, range.maxValue);
  if (channel === 'alpha') {
    return { ...color, alpha: next };
  }
  const space = spaceOf(channel, color.space);
  const moved = toSpace(color, space);
  const values = [...moved.values] as [number, number, number];
  values[SPACE_CHANNELS[space].indexOf(channel)] = next;
  return { space, values, alpha: moved.alpha };
}

/** The value of a channel in the format of the locale: `120°`, `50%`, `128`, or alpha as `80%`. */
export function formatChannelValue(color: Color, channel: ColorChannel, locale: string): string {
  const value = channelValue(color, channel);
  switch (channel) {
    case 'hue':
      return new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: 'degree',
        unitDisplay: 'narrow',
        maximumFractionDigits: 0,
      }).format(value);
    case 'saturation':
    case 'lightness':
    case 'brightness':
      return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
        value / 100,
      );
    case 'alpha':
      return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
        value,
      );
    default:
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  }
}

// Formatting.

function hexOf(value: number): string {
  return Math.round(clamp(value, 0, 255))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
}

/** The color as a string: hex, a function of CSS, or `css`, the format of its own space. */
export function formatColor(color: Color, format: ColorFormat = 'css'): string {
  switch (format) {
    case 'hex':
    case 'hexa': {
      const [red, green, blue] = toSpace(color, 'rgb').values;
      const alpha = format === 'hexa' ? hexOf(color.alpha * 255) : '';
      return `#${hexOf(red)}${hexOf(green)}${hexOf(blue)}${alpha}`;
    }
    case 'rgb':
    case 'rgba': {
      const [red, green, blue] = toSpace(color, 'rgb').values.map((value) => Math.round(value));
      return format === 'rgb'
        ? `rgb(${red}, ${green}, ${blue})`
        : `rgba(${red}, ${green}, ${blue}, ${round(color.alpha, 2)})`;
    }
    case 'hsl':
    case 'hsla':
    case 'hsb':
    case 'hsba': {
      const space = format.startsWith('hsl') ? 'hsl' : 'hsb';
      const [hue, first, second] = toSpace(color, space).values.map((value) => round(value, 2));
      const body = `${hue}, ${first}%, ${second}%`;
      return format.endsWith('a')
        ? `${space}a(${body}, ${round(color.alpha, 2)})`
        : `${space}(${body})`;
    }
    default:
      // HSB is not a color of CSS, so it shows as HSL.
      return formatColor(color, color.space === 'rgb' ? 'rgba' : 'hsla');
  }
}

/** A color string in the space of `like`, for a part that gives back the format it was given. */
export function formatLike(color: Color, like: string): string {
  const text = like.trim().toLowerCase();
  if (text.startsWith('#')) {
    return formatColor(
      color,
      color.alpha < 1 || text.length === 5 || text.length === 9 ? 'hexa' : 'hex',
    );
  }
  const kind = /^(rgb|hsl|hsb)a?\(/.exec(text)?.[1] as 'rgb' | 'hsl' | 'hsb' | undefined;
  if (!kind) {
    return formatColor(color);
  }
  const alpha = text.startsWith(`${kind}a(`) || color.alpha < 1;
  return formatColor(color, `${kind}${alpha ? 'a' : ''}` as ColorFormat);
}

// Names.

const HUES: [number, string][] = [
  [15, 'red'],
  [45, 'orange'],
  [70, 'yellow'],
  [150, 'green'],
  [190, 'cyan'],
  [250, 'blue'],
  [290, 'purple'],
  [335, 'magenta'],
  [360, 'red'],
];

/**
 * A short name of a color in English, such as `dark blue` or `light gray, 50% transparent`, for a
 * swatch that its caller does not name. React Aria names colors in the language of the locale.
 */
export function colorName(color: Color): string {
  const [hue, saturation, lightness] = toSpace(color, 'hsl').values;
  let name: string;
  if (lightness >= 97) {
    name = 'white';
  } else if (lightness <= 3) {
    name = 'black';
  } else {
    // A hue of 360 is past the last end, and it is red, as 0 is.
    const base = saturation < 12 ? 'gray' : (HUES.find(([end]) => hue < end)?.[1] ?? 'red');
    let shade = '';
    if (lightness < 30) {
      shade = 'dark ';
    } else if (lightness > 75) {
      shade = 'light ';
    }
    const tone = saturation >= 12 && saturation < 40 ? 'grayish ' : '';
    name = `${shade}${tone}${base}`;
  }
  if (color.alpha < 1) {
    name += `, ${Math.round((1 - color.alpha) * 100)}% transparent`;
  }
  return name;
}

const CHECKERBOARD = 'repeating-conic-gradient(#e6e6e6 0% 25%, #fff 0% 50%) 50% / 16px 16px';

/** The background of a swatch: the color over a checkerboard, which shows its alpha. */
export function swatchBackground(color: string): string {
  return `linear-gradient(${color}, ${color}), ${CHECKERBOARD}`;
}

/**
 * The color that a slider of a channel shows on its thumb, as React Stately does: a hue at full
 * saturation, and the color without its alpha for the other channels, except alpha.
 */
export function displayColor(color: Color, channel: ColorChannel): Color {
  if (channel === 'hue') {
    return { space: 'hsl', values: [channelValue(color, 'hue'), 100, 50], alpha: 1 };
  }
  return channel === 'alpha' ? color : { ...color, alpha: 1 };
}

/**
 * The background of the track of a slider of a channel: a `linear-gradient` that goes `to` a side,
 * through the values of the channel, with the other channels of the color as they are.
 */
export function channelGradient(
  color: Color,
  channel: ColorChannel,
  to: 'top' | 'right' | 'left',
): string {
  const base = displayColor(color, channel);
  const { minValue, maxValue } = RANGES[channel];
  // Hue passes through each sixth of the wheel. Lightness needs the middle, or the hue would not
  // show. The other channels change in a straight line.
  let values = [minValue, maxValue];
  if (channel === 'hue') {
    values = [0, 60, 120, 180, 240, 300, 360];
  } else if (channel === 'lightness') {
    values = [minValue, (maxValue - minValue) / 2, maxValue];
  }
  const stops = values
    .map((value) => formatColor(withChannelValue(base, channel, value)))
    .join(', ');
  const gradient = `linear-gradient(to ${to}, ${stops})`;
  return channel === 'alpha' ? `${gradient}, ${CHECKERBOARD}` : gradient;
}
