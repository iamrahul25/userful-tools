const ALLOWED_HOSTS = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;

export async function GET(request) {
  const params = request.nextUrl.searchParams;

  let source;
  try {
    source = new URL(params.get("url") ?? "");
  } catch {
    return new Response("Invalid video link.", { status: 400 });
  }
  if (source.protocol !== "https:" || !ALLOWED_HOSTS.test(source.hostname)) {
    return new Response("Only Instagram videos can be downloaded.", { status: 400 });
  }

  const name = (params.get("name") ?? "instagram-video").replace(/[^\w.-]/g, "_").slice(0, 100);

  const upstream = await fetch(source, { redirect: "error", cache: "no-store" }).catch(() => null);
  if (!upstream?.ok || !upstream.body) {
    return new Response("This video link has expired. Look up the post again.", { status: 502 });
  }

  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
    "Content-Disposition": `attachment; filename="${name}.mp4"`,
    "Cache-Control": "no-store",
  });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);

  return new Response(upstream.body, { headers });
}
