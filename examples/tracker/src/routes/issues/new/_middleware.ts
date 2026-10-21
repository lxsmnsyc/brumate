import { getEvent } from 'brumate/server';
import type { Middleware } from 'brumate/server';
import { session } from '../../../session.ts';

// Runs before /issues/new. A visitor who is not signed in goes to the sign-in page,
// which comes back here after.
export const middleware: Middleware = async (request, next) => {
  // Before the first await.
  const event = getEvent();
  if (!(await session.get(event))) {
    const back = encodeURIComponent(new URL(request.url).pathname);
    return Response.redirect(new URL(`/sign-in?next=${back}`, request.url), 303);
  }
  return next();
};
