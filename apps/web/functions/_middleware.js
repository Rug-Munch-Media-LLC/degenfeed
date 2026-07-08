export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const { pathname } = url;

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/.well-known/") ||
    /\.\w+$/.test(pathname)
  ) {
    return next();
  }

  try {
    const response = await next();
    if (response.status === 404) {
      const index = await context.env.ASSETS.fetch(
        new URL("/index.html", request.url)
      );
      if (index.ok) return index;
    }
    return response;
  } catch {
    const index = await context.env.ASSETS.fetch(
      new URL("/index.html", request.url)
    );
    if (index.ok) return index;
    return new Response("Not Found", { status: 404 });
  }
}
