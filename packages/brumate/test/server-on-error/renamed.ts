import type { EntryMiddleware } from '../../src/runtime/request.ts';

export const seen: unknown[] = [];

function report(error: unknown): void {
  seen.push(error);
}

const middleware: EntryMiddleware = (_event, next) => next();

export default middleware;

export { report as onError };
