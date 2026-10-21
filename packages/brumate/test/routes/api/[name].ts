export function GET(_request: Request, params: Record<string, string>): Response {
  return new Response(`hello ${params.name}`);
}
