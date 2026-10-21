export async function middleware(
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  if (new URL(request.url).pathname.startsWith('/private')) {
    return new Response('Sign in first', { status: 401 });
  }
  return next();
}
