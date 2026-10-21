export function GET(): Response {
  return Response.json({ time: 42 });
}

export function POST(request: Request): Response {
  return new Response(`posted from ${new URL(request.url).pathname}`);
}
