// An endpoint: answers GET /api/hello with JSON.
export function GET(request: Request): Response {
  const name = new URL(request.url).searchParams.get('name') ?? 'world';
  return Response.json({ hello: name });
}
