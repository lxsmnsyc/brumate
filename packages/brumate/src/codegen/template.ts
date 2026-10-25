// Cloned templates of the markup that the browser renders. A render whose markup is one string
// of static HTML, attributes, the content of elements, and anchors compiles to a `<template>`
// that it clones, and writes the elements that it marks. The rest renders HTML.
import type { Part } from './markup.ts';

/** What a render writes on an element of its clone. */
export type Write =
  | { kind: 'anchor'; scope: string; anchor: number }
  | { kind: 'attribute'; name: string; value: string }
  | { kind: 'content'; value: string };

export interface ClonedTemplate {
  /**
   * The static HTML of the template. Each element that the render writes has `b-x` with its
   * index, which the browser reads, and removes, when it parses the template.
   */
  html: string;
  /** The writes on the marked elements, by their index. */
  writes: Write[][];
}

const ATTRIBUTE = /^\$\$b\.attribute\(("(?:[^"\\]|\\.)*"), ([\s\S]*)\)$/;
// `$$b.insert(value)`. Children and templates, `$$b.insert(value, undefined, scope)`, render
// where they are inserted, so a body that has them renders HTML.
const INSERT = /^\$\$b\.insert\(([\s\S]*)\)$/;
const PLACED = /, undefined, [\w$.]+\)$/;
const SCOPE = /^\$\$s\d+$/;
const ANCHOR_START = ' b-b="';
const ANCHOR_END = /^:(\d+)"/;

/** Elements whose content is text that the parser keeps as it is, or that hold no markup. */
const RAW_TEXT = /^(?:script|style|textarea|title|template|noscript|xmp|iframe|noembed|noframes)$/;

/**
 * Follows HTML as it is written, so the template knows where each element starts and whether it
 * is in a start tag. Quoted attribute values and comments can hold `<` and `>`.
 */
class Reader {
  html = '';
  /** In the start tag of `element`, before its `>`. */
  inTag = false;
  /** The start tag of `element` ended last, with nothing after it yet. */
  justOpened = false;
  /** The number of the element that started last, in the order of the markup. */
  element = -1;
  /** Where its start tag can take another attribute: after its name. */
  nameEnd = -1;
  /** Whether the element that started last has a raw text content, such as a `<textarea>`. */
  raw = false;
  private state: 'text' | 'open' | 'name' | 'tag' | 'quote' | 'close' | 'comment' = 'text';
  private quote = '';
  private name = '';

  append(text: string): void {
    for (const char of text) {
      const at = this.html.length;
      this.html += char;
      switch (this.state) {
        case 'text':
          if (char === '<') {
            this.state = 'open';
          } else {
            this.justOpened = false;
          }
          break;
        case 'open':
          if (/[a-zA-Z]/.test(char)) {
            this.state = 'name';
            this.name = char;
            this.nameEnd = at + 1;
            this.raw = false;
            this.element++;
            this.inTag = true;
            this.justOpened = false;
          } else if (char === '/') {
            this.state = 'close';
            this.justOpened = false;
          } else if (char === '!') {
            this.state = 'comment';
            this.justOpened = false;
          } else {
            this.state = 'text';
          }
          break;
        case 'name':
          if (/[\w-]/.test(char)) {
            this.name += char;
            this.nameEnd = at + 1;
            break;
          }
          this.state = 'tag';
          this.tag(char);
          break;
        case 'tag':
          this.tag(char);
          break;
        case 'quote':
          if (char === this.quote) {
            this.state = 'tag';
          }
          break;
        case 'close':
          if (char === '>') {
            this.state = 'text';
          }
          break;
        case 'comment':
          if (this.html.endsWith('-->')) {
            this.state = 'text';
          }
          break;
      }
    }
  }

  private tag(char: string): void {
    if (char === '"' || char === "'") {
      this.quote = char;
      this.state = 'quote';
    } else if (char === '>') {
      this.state = 'text';
      this.inTag = false;
      this.justOpened = true;
      this.raw = RAW_TEXT.test(this.name.toLowerCase());
    }
  }

  /** Takes back the start of an attribute that the reader is in, such as `b-b="`. */
  takeBack(text: string): void {
    this.html = this.html.slice(0, -text.length);
    this.state = 'tag';
  }

  /** Writes text into the start tag of the element that started last, after its name. */
  insertIntoTag(text: string): void {
    this.html = this.html.slice(0, this.nameEnd) + text + this.html.slice(this.nameEnd);
    this.nameEnd += text.length;
  }
}

/** The template of a render's parts, or undefined when its markup needs HTML. */
export function clonedTemplate(parts: readonly Part[]): ClonedTemplate | undefined {
  const reader = new Reader();
  const writes: Write[][] = [];
  /** The index of each marked element, by its number in the order of the markup. */
  const marks = new Map<number, number>();
  const add = (write: Write): void => {
    let index = marks.get(reader.element);
    if (index === undefined) {
      index = writes.length;
      marks.set(reader.element, index);
      writes.push([]);
      reader.insertIntoTag(` b-x="${index}"`);
    }
    writes[index]!.push(write);
  };
  const list = [...parts];
  for (let index = 0; index < list.length; index++) {
    const part = list[index]!;
    if ('static' in part) {
      reader.append(part.static);
      continue;
    }
    const code = part.code;
    const next = list[index + 1];
    const nextStatic = next && 'static' in next ? next.static : undefined;
    const attribute = ATTRIBUTE.exec(code);
    if (attribute && reader.inTag) {
      add({ kind: 'attribute', name: attribute[1]!, value: attribute[2]! });
      continue;
    }
    const insert = PLACED.test(code) ? null : INSERT.exec(code);
    if (insert && reader.justOpened && !reader.raw && nextStatic?.startsWith('</')) {
      add({ kind: 'content', value: insert[1]! });
      continue;
    }
    const end = nextStatic === undefined ? null : ANCHOR_END.exec(nextStatic);
    if (SCOPE.test(code) && reader.inTag && reader.html.endsWith(ANCHOR_START) && end) {
      reader.takeBack(ANCHOR_START);
      add({ kind: 'anchor', scope: code, anchor: Number(end[1]) });
      list[index + 1] = { static: nextStatic!.slice(end[0].length) };
      continue;
    }
    return undefined;
  }
  // Markers of blocks and of text inserts need the HTML of a render, and so does a body that
  // writes nothing, which gains nothing from a clone. The loader starts each `<template>` of a
  // block once, such as of a `$client` callback, so a clone of one would start nothing.
  if (writes.length === 0 || reader.html.includes('<!--') || /<template\b/i.test(reader.html)) {
    return undefined;
  }
  return { html: reader.html, writes };
}
