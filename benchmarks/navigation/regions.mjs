import { gzipSync } from 'node:zlib';

// The route slots of a server response, found by the comments that the server writes around them:
// `<!--R<layout scope>:<slot>:<route scope>:<key>-->` and `<!--/R-->`. The client pairs them the
// same way in `plan` (packages/brumate/src/runtime/navigate.ts).
const COMMENT = /<!--(R(-?[\d.]+):([^:]+):([\d.]+):([^>]*?)|\/R)-->/g;

/** The bytes of a string as the server sends it (UTF-8). */
export function size(text) {
  return Buffer.byteLength(text);
}

/** The bytes of a string after gzip, at the highest level, so the number does not depend on a server. */
export function gzip(text) {
  return gzipSync(Buffer.from(text), { level: 9 }).length;
}

/**
 * The slots of the first render, nested as the routes are. The first render ends with `</html>`;
 * what streams after it is not a slot of the page.
 */
export function findRegions(html) {
  const end = html.lastIndexOf('</html>');
  const text = end === -1 ? html : html.slice(0, end + '</html>'.length);
  const top = [];
  const stack = [];
  for (const match of text.matchAll(COMMENT)) {
    if (match[1] === '/R') {
      const region = stack.pop();
      if (region) {
        region.stop = match.index + match[0].length;
        region.html = text.slice(region.begin, region.stop);
      }
    } else {
      const region = {
        layout: match[2],
        name: match[3],
        root: match[4],
        key: decodeURIComponent(match[5]),
        begin: match.index,
        stop: -1,
        html: '',
        children: [],
      };
      (stack.at(-1)?.children ?? top).push(region);
      stack.push(region);
    }
  }
  return top;
}

/**
 * The slots of the new page that the client replaces when it comes from the old page, with the
 * same pairing as `plan`: a slot with the same key stays and its children are compared, any other
 * is replaced. Returns undefined when the pages do not line up (the client then swaps the body).
 */
export function replacedRegions(oldHtml, newHtml) {
  const replaced = [];
  function walk(before, next) {
    for (const region of next) {
      let match;
      for (const item of before) {
        if (item.name === region.name) {
          match = item;
          break;
        }
      }
      if (!match) {
        return false;
      }
      if (match.key === region.key && region.children.length > 0) {
        if (!walk(match.children, region.children)) {
          return false;
        }
      } else {
        replaced.push(region);
      }
    }
    return true;
  }
  return walk(findRegions(oldHtml), findRegions(newHtml)) ? replaced : undefined;
}

/**
 * What a partial response could save, at most: the bytes of the whole response against the HTML of
 * the replaced regions. The head, the state records outside the regions and the closing markup would
 * still be sent, so the real saving is smaller.
 */
export function regionBytes(oldHtml, newHtml) {
  const replaced = replacedRegions(oldHtml, newHtml);
  if (!replaced) {
    return undefined;
  }
  let html = '';
  const names = [];
  for (const region of replaced) {
    html += region.html;
    names.push(`${region.name}:${region.key}`);
  }
  return {
    count: replaced.length,
    names,
    raw: size(html),
    gzip: gzip(html),
  };
}
