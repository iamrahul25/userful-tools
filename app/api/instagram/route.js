const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const IG_APP_ID = "936619743392459";
const POST_QUERY_DOC_ID = "27128499623469141";
const MEDIA_VIDEO = 2;
const MEDIA_CAROUSEL = 8;

class LookupError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function instagramFetch(url, headers = {}) {
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT, ...headers },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
}

async function resolveShortcode(input) {
  const text = input.trim();
  if (/^[\w-]{5,}$/.test(text)) return text;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return null;

  if (url.pathname.startsWith("/share/")) {
    const response = await instagramFetch(url);
    await response.body?.cancel();
    url = new URL(response.url);
  }

  return url.pathname.match(/\/(?:p|reels?|tv)\/([\w-]+)/)?.[1] ?? null;
}

async function getCsrfToken() {
  const response = await instagramFetch("https://www.instagram.com/");
  await response.body?.cancel();
  const token = response.headers
    .getSetCookie()
    .map((cookie) => cookie.match(/^csrftoken=([^;]+)/)?.[1])
    .find(Boolean);
  if (!token) throw new LookupError("Instagram didn't respond as expected. Please try again.", 502);
  return token;
}

async function fetchPost(shortcode) {
  const csrfToken = await getCsrfToken();
  const params = new URLSearchParams({
    doc_id: POST_QUERY_DOC_ID,
    variables: JSON.stringify({
      shortcode,
      __relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider: false,
    }),
  });
  const response = await instagramFetch(`https://www.instagram.com/graphql/query/?${params}`, {
    Accept: "*/*",
    Cookie: `csrftoken=${csrfToken}`,
    "X-CSRFToken": csrfToken,
    "X-IG-App-ID": IG_APP_ID,
    Referer: `https://www.instagram.com/p/${shortcode}/`,
  });

  if (response.status === 429) {
    throw new LookupError("Instagram is limiting requests right now. Please wait a minute and try again.", 429);
  }
  if (!response.ok) {
    throw new LookupError("Instagram didn't respond as expected. Please try again.", 502);
  }

  const json = await response.json().catch(() => null);
  const post = json?.data?.xdt_api__v1__media__shortcode__web_info?.items?.[0];
  if (!post) {
    throw new LookupError("Couldn't find that post. It may be private, deleted, or age-restricted.", 404);
  }
  return post;
}

function toVideo(media) {
  const best = [...media.video_versions].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  return {
    url: best.url,
    width: best.width,
    height: best.height,
    thumbnail: media.image_versions2?.candidates?.[0]?.url ?? null,
  };
}

export async function GET(request) {
  const input = request.nextUrl.searchParams.get("url") ?? "";

  try {
    const shortcode = await resolveShortcode(input);
    if (!shortcode) {
      throw new LookupError("That doesn't look like an Instagram post or reel link.", 400);
    }

    const post = await fetchPost(shortcode);
    const items = post.media_type === MEDIA_CAROUSEL ? post.carousel_media ?? [] : [post];
    const videos = items
      .filter((media) => media.media_type === MEDIA_VIDEO && media.video_versions?.length)
      .map(toVideo);

    if (videos.length === 0) {
      throw new LookupError("This post doesn't contain a video.", 404);
    }

    return Response.json({
      shortcode,
      username: post.user?.username ?? null,
      caption: post.caption?.text ?? "",
      videos,
    });
  } catch (error) {
    if (error instanceof LookupError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Couldn't reach Instagram. Please try again." }, { status: 502 });
  }
}
