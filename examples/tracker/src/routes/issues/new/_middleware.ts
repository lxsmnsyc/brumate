import { getEvent } from 'brumate/server';
import { session } from '../../../session.ts';

// Runs before /issues/new. A visitor who is not signed in goes to the sign-in page,
// which comes back here after.
export async function middleware(
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  // Before the first await.
  const event = getEvent();
  if (!(await session.get(event))) {
    const back = encodeURIComponent(new URL(request.url).pathname);
    return Response.redirect(new URL(`/sign-in?next=${back}`, request.url), 303);
  }
  return next();
}
