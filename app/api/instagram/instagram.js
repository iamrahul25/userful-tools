export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
export const IG_APP_ID = "936619743392459";
export const MEDIA_VIDEO = 2;
export const MEDIA_CAROUSEL = 8;

export class LookupError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function instagramFetch(url, { headers = {}, ...init } = {}) {
  return fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...headers },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
}

export function errorResponse(error) {
  if (error instanceof LookupError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json({ error: "Couldn't reach Instagram. Please try again." }, { status: 502 });
}
