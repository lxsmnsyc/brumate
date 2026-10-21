import { createSession } from 'brumate/server';

// Who is signed in, in a signed cookie. Set SESSION_SECRET in production:
// the fallback is only for trying the example.
export const session = createSession<{ name: string }>({
  secret: process.env.SESSION_SECRET ?? 'example-tracker-only-secret-do-not-use',
});
