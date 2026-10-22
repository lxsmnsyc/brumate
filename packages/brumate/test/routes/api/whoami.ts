import { getEvent } from 'brumate/server';

export function GET(): Response {
  const event = getEvent();
  return Response.json({ kind: event.kind, user: (event.locals as { user?: string }).user });
}
