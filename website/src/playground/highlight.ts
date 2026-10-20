// Highlights code in the playground, on the server and in the browser.
import { language as css } from '@twinkleplop/css';
import { language as typescript } from '@twinkleplop/typescript';
import { raw } from 'brumate/html';
import type { Raw } from 'brumate/html';
import { language as brm } from '../highlight/brm.ts';

const languages = { brm: brm(), ts: typescript(), css: css() };

export function highlight(code: string, language: keyof typeof languages): Raw {
  return raw(languages[language](code));
}
