export async function middleware(
  _request: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  const response = await next();
  response.headers.set('x-api', 'yes');
  return response;
}
