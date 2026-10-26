// The types of elements, markup and components of brumate, as `JSX.IntrinsicElements`,
// `JSX.Element` and the component types are in JSX. The names are as the markup writes them:
// `tabindex`, `for` and `viewBox`, not the fields of the DOM interfaces.

import type { BindableMark } from 'brumate/signals';

declare const MARKUP: unique symbol;

/**
 * What children, a `#template` and a render give. A value of this type has no string at runtime
 * that the code can read, so it is not a string and a string is not `Markup`.
 */
export interface Markup {
  readonly [MARKUP]: true;
}

/**
 * A component of a `.brm` file with the props `P`. It renders on the server, so it answers a
 * promise. The default `any` takes a component of any props, as a parameter or a constraint.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- Any props, so a component of props P is assignable.
export type Component<P = any> = (props: P, ...rest: any[]) => Promise<Markup>;

/** The props of a component. */
export type PropsOf<C> = C extends (props: infer P, ...rest: any[]) => unknown ? P : never;

/** A value of an attribute: the value, `null` or `undefined` to leave the attribute out. */
type Attr<T> = T | null | undefined;

/**
 * The events of an element, by the name of the event. An app that sends its own events from
 * an element adds them: `interface ElementEvents { itemaction: CustomEvent<string> }`.
 */
export interface ElementEvents extends HTMLElementEventMap {}

/** The element that an event handler reads as `event.currentTarget`. */
type Handler<Ev, E> = (event: Ev & { currentTarget: E }) => unknown;

// The events whose name has more than one word. The markup can write them in camel case, as
// `onKeyDown`, or as `onKeydown`. The compiler lower-cases the name.
type CamelEvent =
  | 'AnimationCancel'
  | 'AnimationEnd'
  | 'AnimationIteration'
  | 'AnimationStart'
  | 'AuxClick'
  | 'BeforeInput'
  | 'BeforeMatch'
  | 'BeforeToggle'
  | 'CanPlay'
  | 'CanPlayThrough'
  | 'CompositionEnd'
  | 'CompositionStart'
  | 'CompositionUpdate'
  | 'ContextMenu'
  | 'CueChange'
  | 'DblClick'
  | 'DragEnd'
  | 'DragEnter'
  | 'DragLeave'
  | 'DragOver'
  | 'DragStart'
  | 'DurationChange'
  | 'FocusIn'
  | 'FocusOut'
  | 'FormData'
  | 'FullscreenChange'
  | 'FullscreenError'
  | 'GotPointerCapture'
  | 'KeyDown'
  | 'KeyUp'
  | 'LoadedData'
  | 'LoadedMetadata'
  | 'LoadStart'
  | 'LostPointerCapture'
  | 'MouseDown'
  | 'MouseEnter'
  | 'MouseLeave'
  | 'MouseMove'
  | 'MouseOut'
  | 'MouseOver'
  | 'MouseUp'
  | 'PointerCancel'
  | 'PointerDown'
  | 'PointerEnter'
  | 'PointerLeave'
  | 'PointerMove'
  | 'PointerOut'
  | 'PointerOver'
  | 'PointerUp'
  | 'RateChange'
  | 'ScrollEnd'
  | 'SecurityPolicyViolation'
  | 'SelectionChange'
  | 'SelectStart'
  | 'SlotChange'
  | 'TimeUpdate'
  | 'ToggleEnd'
  | 'TouchCancel'
  | 'TouchEnd'
  | 'TouchMove'
  | 'TouchStart'
  | 'TransitionCancel'
  | 'TransitionEnd'
  | 'TransitionRun'
  | 'TransitionStart'
  | 'VolumeChange';

/** The handlers of an element: `onClick` for `click`, and the name of each event. */
export type Handlers<E> = {
  [K in keyof ElementEvents & string as `on${Capitalize<K>}`]?: Handler<ElementEvents[K], E>;
} & {
  [N in CamelEvent as `on${N}`]?: Lowercase<N> extends keyof ElementEvents
    ? Handler<ElementEvents[Lowercase<N>], E>
    : never;
};

/**
 * The attributes that every element takes: `class`, `style`, the handlers, `ref`, `data-*` and
 * `aria-*`. `E` is the element, for the handlers and `ref`.
 */
export type GlobalAttributes<E> = Handlers<E> & {
  /** Binds the element to a name: `ref=$bind(name)`. */
  ref?: BindableMark<E | null>;
  class?: Attr<string>;
  style?: Attr<string>;
  id?: Attr<string>;
  slot?: Attr<string>;
  part?: Attr<string>;
  is?: Attr<string>;
  role?: Attr<string>;
  title?: Attr<string>;
  lang?: Attr<string>;
  dir?: Attr<'ltr' | 'rtl' | 'auto'>;
  nonce?: Attr<string>;
  accesskey?: Attr<string>;
  autocapitalize?: Attr<'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters'>;
  autofocus?: Attr<boolean>;
  contenteditable?: Attr<boolean | 'true' | 'false' | 'plaintext-only'>;
  draggable?: Attr<boolean | 'true' | 'false'>;
  enterkeyhint?: Attr<'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send'>;
  hidden?: Attr<boolean | 'hidden' | 'until-found'>;
  inert?: Attr<boolean>;
  inputmode?: Attr<'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search'>;
  popover?: Attr<boolean | 'auto' | 'manual' | 'hint'>;
  spellcheck?: Attr<boolean | 'true' | 'false'>;
  tabindex?: Attr<number>;
  translate?: Attr<'yes' | 'no'>;
  writingsuggestions?: Attr<boolean | 'true' | 'false'>;
  [attribute: `data-${string}`]: unknown;
  [attribute: `aria-${string}`]: Attr<string | number | boolean>;
};

type Referrer =
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url';
type CrossOrigin = boolean | 'anonymous' | 'use-credentials';
type Size = number | string;

/** An HTML element `E` with the attributes of its own. */
type Html<E extends keyof HTMLElementTagNameMap, Own = {}> = GlobalAttributes<
  HTMLElementTagNameMap[E]
> &
  Own;

// The attributes of the tags that have some besides the global ones.

interface AnchorOwn {
  href?: Attr<string>;
  target?: Attr<'_self' | '_blank' | '_parent' | '_top' | (string & {})>;
  download?: Attr<boolean | string>;
  rel?: Attr<string>;
  hreflang?: Attr<string>;
  type?: Attr<string>;
  ping?: Attr<string>;
  referrerpolicy?: Attr<Referrer>;
}

interface MediaOwn {
  src?: Attr<string>;
  controls?: Attr<boolean>;
  autoplay?: Attr<boolean>;
  loop?: Attr<boolean>;
  muted?: Attr<boolean>;
  preload?: Attr<'none' | 'metadata' | 'auto' | ''>;
  crossorigin?: Attr<CrossOrigin>;
  controlslist?: Attr<string>;
  disableremoteplayback?: Attr<boolean>;
}

interface FormControlOwn {
  name?: Attr<string>;
  form?: Attr<string>;
  disabled?: Attr<boolean>;
}

interface ButtonOwn extends FormControlOwn {
  type?: Attr<'button' | 'submit' | 'reset'>;
  value?: Attr<string | number>;
  formaction?: Attr<string>;
  formenctype?: Attr<'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain'>;
  formmethod?: Attr<'get' | 'post' | 'dialog'>;
  formnovalidate?: Attr<boolean>;
  formtarget?: Attr<string>;
  popovertarget?: Attr<string>;
  popovertargetaction?: Attr<'show' | 'hide' | 'toggle'>;
  command?: Attr<string>;
  commandfor?: Attr<string>;
}

interface InputOwn extends FormControlOwn {
  type?: Attr<
    | 'button'
    | 'checkbox'
    | 'color'
    | 'date'
    | 'datetime-local'
    | 'email'
    | 'file'
    | 'hidden'
    | 'image'
    | 'month'
    | 'number'
    | 'password'
    | 'radio'
    | 'range'
    | 'reset'
    | 'search'
    | 'submit'
    | 'tel'
    | 'text'
    | 'time'
    | 'url'
    | 'week'
  >;
  value?: Attr<string | number>;
  checked?: Attr<boolean>;
  accept?: Attr<string>;
  alt?: Attr<string>;
  autocomplete?: Attr<string>;
  capture?: Attr<boolean | 'user' | 'environment'>;
  dirname?: Attr<string>;
  list?: Attr<string>;
  max?: Attr<number | string>;
  maxlength?: Attr<number>;
  min?: Attr<number | string>;
  minlength?: Attr<number>;
  multiple?: Attr<boolean>;
  pattern?: Attr<string>;
  placeholder?: Attr<string>;
  readonly?: Attr<boolean>;
  required?: Attr<boolean>;
  size?: Attr<number>;
  src?: Attr<string>;
  step?: Attr<number | string>;
  width?: Attr<Size>;
  height?: Attr<Size>;
  formaction?: Attr<string>;
  formenctype?: Attr<'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain'>;
  formmethod?: Attr<'get' | 'post' | 'dialog'>;
  formnovalidate?: Attr<boolean>;
  formtarget?: Attr<string>;
  popovertarget?: Attr<string>;
  popovertargetaction?: Attr<'show' | 'hide' | 'toggle'>;
}

interface TextareaOwn extends FormControlOwn {
  autocomplete?: Attr<string>;
  cols?: Attr<number>;
  dirname?: Attr<string>;
  maxlength?: Attr<number>;
  minlength?: Attr<number>;
  placeholder?: Attr<string>;
  readonly?: Attr<boolean>;
  required?: Attr<boolean>;
  rows?: Attr<number>;
  wrap?: Attr<'hard' | 'soft' | 'off'>;
  value?: Attr<string>;
}

interface TableCellOwn {
  colspan?: Attr<number>;
  rowspan?: Attr<number>;
  headers?: Attr<string>;
}

// The attributes of every SVG element. The elements share them: the SVG attributes are many, and
// most apply to most elements. Their values are a string or a number.
type SvgValue = Attr<string | number>;
type SvgAttributeNames =
  | 'viewBox'
  | 'preserveAspectRatio'
  | 'xmlns'
  | 'x'
  | 'y'
  | 'x1'
  | 'x2'
  | 'y1'
  | 'y2'
  | 'cx'
  | 'cy'
  | 'r'
  | 'rx'
  | 'ry'
  | 'fx'
  | 'fy'
  | 'dx'
  | 'dy'
  | 'width'
  | 'height'
  | 'd'
  | 'points'
  | 'pathLength'
  | 'transform'
  | 'href'
  | 'fill'
  | 'fill-opacity'
  | 'fill-rule'
  | 'stroke'
  | 'stroke-width'
  | 'stroke-opacity'
  | 'stroke-linecap'
  | 'stroke-linejoin'
  | 'stroke-dasharray'
  | 'stroke-dashoffset'
  | 'stroke-miterlimit'
  | 'opacity'
  | 'color'
  | 'display'
  | 'visibility'
  | 'overflow'
  | 'clip-path'
  | 'clip-rule'
  | 'mask'
  | 'filter'
  | 'flood-color'
  | 'flood-opacity'
  | 'lighting-color'
  | 'stop-color'
  | 'stop-opacity'
  | 'offset'
  | 'gradientUnits'
  | 'gradientTransform'
  | 'spreadMethod'
  | 'clipPathUnits'
  | 'maskUnits'
  | 'maskContentUnits'
  | 'patternUnits'
  | 'patternContentUnits'
  | 'patternTransform'
  | 'markerUnits'
  | 'markerWidth'
  | 'markerHeight'
  | 'refX'
  | 'refY'
  | 'orient'
  | 'marker-start'
  | 'marker-mid'
  | 'marker-end'
  | 'font-family'
  | 'font-size'
  | 'font-style'
  | 'font-weight'
  | 'text-anchor'
  | 'text-decoration'
  | 'dominant-baseline'
  | 'alignment-baseline'
  | 'letter-spacing'
  | 'word-spacing'
  | 'startOffset'
  | 'textLength'
  | 'lengthAdjust'
  | 'rotate'
  | 'vector-effect'
  | 'shape-rendering'
  | 'paint-order'
  | 'pointer-events'
  | 'cursor'
  | 'preserveAlpha'
  | 'in'
  | 'in2'
  | 'result'
  | 'mode'
  | 'type'
  | 'values'
  | 'operator'
  | 'k1'
  | 'k2'
  | 'k3'
  | 'k4'
  | 'stdDeviation'
  | 'radius'
  | 'order'
  | 'kernelMatrix'
  | 'divisor'
  | 'bias'
  | 'targetX'
  | 'targetY'
  | 'edgeMode'
  | 'tableValues'
  | 'slope'
  | 'intercept'
  | 'amplitude'
  | 'exponent'
  | 'azimuth'
  | 'elevation'
  | 'surfaceScale'
  | 'diffuseConstant'
  | 'specularConstant'
  | 'specularExponent'
  | 'baseFrequency'
  | 'numOctaves'
  | 'seed'
  | 'stitchTiles'
  | 'scale'
  | 'xChannelSelector'
  | 'yChannelSelector'
  | 'attributeName'
  | 'from'
  | 'to'
  | 'by'
  | 'begin'
  | 'dur'
  | 'end'
  | 'repeatCount'
  | 'repeatDur'
  | 'calcMode'
  | 'keyTimes'
  | 'keySplines'
  | 'keyPoints'
  | 'path'
  | 'additive'
  | 'accumulate'
  | 'restart'
  | 'crossorigin';
type SvgPresentation = { [K in SvgAttributeNames]?: SvgValue };
type Svg<E extends keyof SVGElementTagNameMap> = GlobalAttributes<SVGElementTagNameMap[E]> &
  SvgPresentation;

/**
 * The attributes of each element, by tag. HTML elements have the attributes of HTML, and SVG
 * elements the shared attributes of SVG. An app adds the tag of a custom element by merging into
 * this interface.
 */
export interface Elements {
  a: Html<'a', AnchorOwn>;
  abbr: Html<'abbr'>;
  address: Html<'address'>;
  area: Html<
    'area',
    Omit<AnchorOwn, 'type' | 'hreflang'> & {
      alt?: Attr<string>;
      coords?: Attr<string>;
      shape?: Attr<string>;
    }
  >;
  article: Html<'article'>;
  aside: Html<'aside'>;
  audio: Html<'audio', MediaOwn>;
  b: Html<'b'>;
  base: Html<'base', { href?: Attr<string>; target?: Attr<string> }>;
  bdi: Html<'bdi'>;
  bdo: Html<'bdo'>;
  blockquote: Html<'blockquote', { cite?: Attr<string> }>;
  body: Html<'body'>;
  br: Html<'br'>;
  button: Html<'button', ButtonOwn>;
  canvas: Html<'canvas', { width?: Attr<Size>; height?: Attr<Size> }>;
  caption: Html<'caption'>;
  cite: Html<'cite'>;
  code: Html<'code'>;
  col: Html<'col', { span?: Attr<number> }>;
  colgroup: Html<'colgroup', { span?: Attr<number> }>;
  data: Html<'data', { value?: Attr<string> }>;
  datalist: Html<'datalist'>;
  dd: Html<'dd'>;
  del: Html<'del', { cite?: Attr<string>; datetime?: Attr<string> }>;
  details: Html<'details', { open?: Attr<boolean>; name?: Attr<string> }>;
  dfn: Html<'dfn'>;
  dialog: Html<'dialog', { open?: Attr<boolean> }>;
  div: Html<'div'>;
  dl: Html<'dl'>;
  dt: Html<'dt'>;
  em: Html<'em'>;
  embed: Html<
    'embed',
    { src?: Attr<string>; type?: Attr<string>; width?: Attr<Size>; height?: Attr<Size> }
  >;
  fieldset: Html<'fieldset', FormControlOwn>;
  figcaption: Html<'figcaption'>;
  figure: Html<'figure'>;
  footer: Html<'footer'>;
  form: Html<
    'form',
    {
      action?: Attr<string>;
      method?: Attr<'get' | 'post' | 'dialog'>;
      enctype?: Attr<'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain'>;
      target?: Attr<string>;
      novalidate?: Attr<boolean>;
      autocomplete?: Attr<'on' | 'off'>;
      name?: Attr<string>;
      rel?: Attr<string>;
      'accept-charset'?: Attr<string>;
    }
  >;
  h1: Html<'h1'>;
  h2: Html<'h2'>;
  h3: Html<'h3'>;
  h4: Html<'h4'>;
  h5: Html<'h5'>;
  h6: Html<'h6'>;
  head: Html<'head'>;
  header: Html<'header'>;
  hgroup: Html<'hgroup'>;
  hr: Html<'hr'>;
  html: Html<'html', { xmlns?: Attr<string> }>;
  i: Html<'i'>;
  iframe: Html<
    'iframe',
    {
      src?: Attr<string>;
      srcdoc?: Attr<string>;
      name?: Attr<string>;
      width?: Attr<Size>;
      height?: Attr<Size>;
      allow?: Attr<string>;
      allowfullscreen?: Attr<boolean>;
      loading?: Attr<'eager' | 'lazy'>;
      referrerpolicy?: Attr<Referrer>;
      sandbox?: Attr<string>;
    }
  >;
  img: Html<
    'img',
    {
      src?: Attr<string>;
      alt?: Attr<string>;
      srcset?: Attr<string>;
      sizes?: Attr<string>;
      width?: Attr<Size>;
      height?: Attr<Size>;
      loading?: Attr<'eager' | 'lazy'>;
      decoding?: Attr<'sync' | 'async' | 'auto'>;
      crossorigin?: Attr<CrossOrigin>;
      usemap?: Attr<string>;
      ismap?: Attr<boolean>;
      referrerpolicy?: Attr<Referrer>;
      fetchpriority?: Attr<'high' | 'low' | 'auto'>;
    }
  >;
  input: Html<'input', InputOwn>;
  ins: Html<'ins', { cite?: Attr<string>; datetime?: Attr<string> }>;
  kbd: Html<'kbd'>;
  label: Html<'label', { for?: Attr<string>; form?: Attr<string> }>;
  legend: Html<'legend'>;
  li: Html<'li', { value?: Attr<number> }>;
  link: Html<
    'link',
    {
      href?: Attr<string>;
      rel?: Attr<string>;
      as?: Attr<string>;
      type?: Attr<string>;
      media?: Attr<string>;
      crossorigin?: Attr<CrossOrigin>;
      integrity?: Attr<string>;
      sizes?: Attr<string>;
      hreflang?: Attr<string>;
      imagesrcset?: Attr<string>;
      imagesizes?: Attr<string>;
      referrerpolicy?: Attr<Referrer>;
      fetchpriority?: Attr<'high' | 'low' | 'auto'>;
      disabled?: Attr<boolean>;
      blocking?: Attr<string>;
    }
  >;
  main: Html<'main'>;
  map: Html<'map', { name?: Attr<string> }>;
  mark: Html<'mark'>;
  menu: Html<'menu'>;
  meta: Html<
    'meta',
    {
      name?: Attr<string>;
      content?: Attr<string>;
      charset?: Attr<string>;
      property?: Attr<string>;
      media?: Attr<string>;
      'http-equiv'?: Attr<string>;
    }
  >;
  meter: Html<
    'meter',
    {
      value?: Attr<number>;
      min?: Attr<number>;
      max?: Attr<number>;
      low?: Attr<number>;
      high?: Attr<number>;
      optimum?: Attr<number>;
    }
  >;
  nav: Html<'nav'>;
  noscript: Html<'noscript'>;
  object: Html<
    'object',
    {
      data?: Attr<string>;
      type?: Attr<string>;
      name?: Attr<string>;
      form?: Attr<string>;
      width?: Attr<Size>;
      height?: Attr<Size>;
    }
  >;
  ol: Html<
    'ol',
    { reversed?: Attr<boolean>; start?: Attr<number>; type?: Attr<'1' | 'a' | 'A' | 'i' | 'I'> }
  >;
  optgroup: Html<'optgroup', { disabled?: Attr<boolean>; label?: Attr<string> }>;
  option: Html<
    'option',
    {
      disabled?: Attr<boolean>;
      label?: Attr<string>;
      selected?: Attr<boolean>;
      value?: Attr<string | number>;
    }
  >;
  output: Html<'output', { for?: Attr<string>; form?: Attr<string>; name?: Attr<string> }>;
  p: Html<'p'>;
  picture: Html<'picture'>;
  pre: Html<'pre'>;
  progress: Html<'progress', { value?: Attr<number>; max?: Attr<number> }>;
  q: Html<'q', { cite?: Attr<string> }>;
  rp: Html<'rp'>;
  rt: Html<'rt'>;
  ruby: Html<'ruby'>;
  s: Html<'s'>;
  samp: Html<'samp'>;
  script: Html<
    'script',
    {
      src?: Attr<string>;
      type?: Attr<string>;
      async?: Attr<boolean>;
      defer?: Attr<boolean>;
      nomodule?: Attr<boolean>;
      crossorigin?: Attr<CrossOrigin>;
      integrity?: Attr<string>;
      referrerpolicy?: Attr<Referrer>;
      fetchpriority?: Attr<'high' | 'low' | 'auto'>;
      blocking?: Attr<string>;
    }
  >;
  search: Html<'search'>;
  section: Html<'section'>;
  select: Html<
    'select',
    FormControlOwn & {
      autocomplete?: Attr<string>;
      multiple?: Attr<boolean>;
      required?: Attr<boolean>;
      size?: Attr<number>;
    }
  >;
  slot: Html<'slot', { name?: Attr<string> }>;
  small: Html<'small'>;
  source: Html<
    'source',
    {
      src?: Attr<string>;
      srcset?: Attr<string>;
      sizes?: Attr<string>;
      type?: Attr<string>;
      media?: Attr<string>;
      width?: Attr<Size>;
      height?: Attr<Size>;
    }
  >;
  span: Html<'span'>;
  strong: Html<'strong'>;
  style: Html<'style', { media?: Attr<string>; blocking?: Attr<string> }>;
  sub: Html<'sub'>;
  summary: Html<'summary'>;
  sup: Html<'sup'>;
  table: Html<'table'>;
  tbody: Html<'tbody'>;
  td: Html<'td', TableCellOwn>;
  template: Html<'template', { shadowrootmode?: Attr<'open' | 'closed'> }>;
  textarea: Html<'textarea', TextareaOwn>;
  tfoot: Html<'tfoot'>;
  th: Html<
    'th',
    TableCellOwn & { scope?: Attr<'row' | 'col' | 'rowgroup' | 'colgroup'>; abbr?: Attr<string> }
  >;
  thead: Html<'thead'>;
  time: Html<'time', { datetime?: Attr<string> }>;
  title: Html<'title'>;
  tr: Html<'tr'>;
  track: Html<
    'track',
    {
      default?: Attr<boolean>;
      kind?: Attr<'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata'>;
      label?: Attr<string>;
      src?: Attr<string>;
      srclang?: Attr<string>;
    }
  >;
  u: Html<'u'>;
  ul: Html<'ul'>;
  var: Html<'var'>;
  video: Html<
    'video',
    MediaOwn & {
      poster?: Attr<string>;
      width?: Attr<Size>;
      height?: Attr<Size>;
      playsinline?: Attr<boolean>;
    }
  >;
  wbr: Html<'wbr'>;

  // SVG elements. `a`, `script`, `style` and `title` are the HTML ones, which SVG shares.
  animate: Svg<'animate'>;
  animateMotion: Svg<'animateMotion'>;
  animateTransform: Svg<'animateTransform'>;
  circle: Svg<'circle'>;
  clipPath: Svg<'clipPath'>;
  defs: Svg<'defs'>;
  desc: Svg<'desc'>;
  ellipse: Svg<'ellipse'>;
  feBlend: Svg<'feBlend'>;
  feColorMatrix: Svg<'feColorMatrix'>;
  feComponentTransfer: Svg<'feComponentTransfer'>;
  feComposite: Svg<'feComposite'>;
  feConvolveMatrix: Svg<'feConvolveMatrix'>;
  feDiffuseLighting: Svg<'feDiffuseLighting'>;
  feDisplacementMap: Svg<'feDisplacementMap'>;
  feDistantLight: Svg<'feDistantLight'>;
  feDropShadow: Svg<'feDropShadow'>;
  feFlood: Svg<'feFlood'>;
  feFuncA: Svg<'feFuncA'>;
  feFuncB: Svg<'feFuncB'>;
  feFuncG: Svg<'feFuncG'>;
  feFuncR: Svg<'feFuncR'>;
  feGaussianBlur: Svg<'feGaussianBlur'>;
  feImage: Svg<'feImage'>;
  feMerge: Svg<'feMerge'>;
  feMergeNode: Svg<'feMergeNode'>;
  feMorphology: Svg<'feMorphology'>;
  feOffset: Svg<'feOffset'>;
  fePointLight: Svg<'fePointLight'>;
  feSpecularLighting: Svg<'feSpecularLighting'>;
  feSpotLight: Svg<'feSpotLight'>;
  feTile: Svg<'feTile'>;
  feTurbulence: Svg<'feTurbulence'>;
  filter: Svg<'filter'>;
  foreignObject: Svg<'foreignObject'>;
  g: Svg<'g'>;
  image: Svg<'image'>;
  line: Svg<'line'>;
  linearGradient: Svg<'linearGradient'>;
  marker: Svg<'marker'>;
  mask: Svg<'mask'>;
  metadata: Svg<'metadata'>;
  mpath: Svg<'mpath'>;
  path: Svg<'path'>;
  pattern: Svg<'pattern'>;
  polygon: Svg<'polygon'>;
  polyline: Svg<'polyline'>;
  radialGradient: Svg<'radialGradient'>;
  rect: Svg<'rect'>;
  set: Svg<'set'>;
  stop: Svg<'stop'>;
  svg: Svg<'svg'>;
  switch: Svg<'switch'>;
  symbol: Svg<'symbol'>;
  text: Svg<'text'>;
  textPath: Svg<'textPath'>;
  tspan: Svg<'tspan'>;
  use: Svg<'use'>;
  view: Svg<'view'>;
}

/** The attributes of an element by its tag. */
export type ElementProps<T extends keyof Elements> = Elements[T];

/** The element object of a tag, as a handler reads it from `event.currentTarget`. */
export type ElementOf<T extends keyof Elements> = T extends keyof HTMLElementTagNameMap
  ? HTMLElementTagNameMap[T]
  : T extends keyof SVGElementTagNameMap
    ? SVGElementTagNameMap[T]
    : HTMLElement;
