import { IG_APP_ID, LookupError, MEDIA_VIDEO, errorResponse, instagramFetch } from "../instagram";

const POSTS_PAGE_DOC_ID = "27389614800735091";
const POSTS_PAGE_QUERY_NAME = "PolarisLoggedOutDesktopWWWProfilePostsTabContentQuery_connection";
const PAGE_SIZE = 12;
const MIN_VIDEOS_PER_REQUEST = 12;
const MAX_PAGES_PER_REQUEST = 5;

function parseUsername(input) {
  const text = input.trim().replace(/^@/, "");
  if (/^[\w.]{1,30}$/.test(text)) return text;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return null;
  const name = url.pathname.split("/").filter(Boolean)[0];
  return name && /^[\w.]{1,30}$/.test(name) ? name : null;
}

function readJsonObject(text, start) {
  if (text[start] !== "{") return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === "{" || ch === "[") {
      depth++;
    } else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// The logged-out profile page embeds the profile and its first page of posts as preloaded query results.
function extractUser(html) {
  const key = '"xig_user_by_username":';
  let user = null;
  for (let i = html.indexOf(key); i !== -1; i = html.indexOf(key, i + key.length)) {
    const part = readJsonObject(html, i + key.length);
    if (part) user = { ...user, ...part };
  }
  return user;
}

async function loadProfile(username) {
  const response = await instagramFetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
    headers: {
      Accept: "text/html",
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Dest": "document",
    },
  });
  if (response.status === 404) {
    throw new LookupError(`Couldn't find an account named @${username}.`, 404);
  }
  if (response.status === 429) {
    throw new LookupError("Instagram is limiting requests right now. Please wait a minute and try again.", 429);
  }
  if (!response.ok) {
    throw new LookupError("Instagram didn't respond as expected. Please try again.", 502);
  }

  const html = await response.text();
  const csrfToken = response.headers
    .getSetCookie()
    .map((cookie) => cookie.match(/^csrftoken=([^;]+)/)?.[1])
    .find(Boolean);
  const lsd = html.match(/"LSD",\[\],\{"token":"([^"]+)"/)?.[1];
  const user = extractUser(html);

  if (!user?.id) {
    throw new LookupError(`Couldn't find an account named @${username}.`, 404);
  }
  if (!csrfToken || !lsd) {
    throw new LookupError("Instagram didn't respond as expected. Please try again.", 502);
  }
  return { user, session: { csrfToken, lsd, username } };
}

async function fetchPostsPage({ csrfToken, lsd, username }, userId, cursor) {
  const response = await instagramFetch("https://www.instagram.com/api/graphql", {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: `csrftoken=${csrfToken}`,
      "X-CSRFToken": csrfToken,
      "X-IG-App-ID": IG_APP_ID,
      "X-FB-LSD": lsd,
      "X-ASBD-ID": "359341",
      "X-FB-Friendly-Name": POSTS_PAGE_QUERY_NAME,
      Origin: "https://www.instagram.com",
      Referer: `https://www.instagram.com/${username}/`,
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
    },
    body: new URLSearchParams({
      av: "0",
      __user: "0",
      __a: "1",
      __comet_req: "7",
      lsd,
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: POSTS_PAGE_QUERY_NAME,
      variables: JSON.stringify({ after: cursor, first: PAGE_SIZE, id: userId }),
      server_timestamps: "true",
      doc_id: POSTS_PAGE_DOC_ID,
    }),
  });

  if (response.status === 429) {
    throw new LookupError("Instagram is limiting requests right now. Please wait a minute and try again.", 429);
  }
  const json = response.ok ? await response.json().catch(() => null) : null;
  const connection = json?.data?.node?.polaris_ordered_timeline_connection;
  if (!connection) {
    throw new LookupError("Instagram stopped returning posts. Please wait a minute and try again.", 502);
  }
  return connection;
}

function toVideo(media) {
  return {
    shortcode: media.code,
    caption: media.caption?.text ?? "",
    thumbnail: media.display_uri ?? null,
    isReel: media.product_type === "clips",
  };
}

export async function GET(request) {
  const params = request.nextUrl.searchParams;
  const username = parseUsername(params.get("username") ?? "");
  const cursor = params.get("cursor");

  try {
    if (!username) {
      throw new LookupError("That doesn't look like an Instagram username or profile link.", 400);
    }

    const { user, session } = await loadProfile(username);
    let connection = cursor
      ? await fetchPostsPage(session, user.id, cursor)
      : user.polaris_ordered_timeline_connection;

    if (!connection) {
      if (user.is_private) throw new LookupError(`@${user.username} is a private account.`, 403);
      throw new LookupError("Instagram didn't return this account's posts. Please try again.", 502);
    }

    const videos = [];
    for (let page = 1; ; page++) {
      for (const { node } of connection.edges ?? []) {
        if (node?.media_type === MEDIA_VIDEO && node.code) videos.push(toVideo(node));
      }
      const { has_next_page: hasNext, end_cursor: next } = connection.page_info ?? {};
      if (!hasNext || !next || videos.length >= MIN_VIDEOS_PER_REQUEST || page >= MAX_PAGES_PER_REQUEST) break;
      connection = await fetchPostsPage(session, user.id, next);
    }

    const { has_next_page: hasMore, end_cursor: nextCursor } = connection.page_info ?? {};
    return Response.json({
      username: user.username ?? username,
      fullName: user.full_name ?? "",
      isPrivate: Boolean(user.is_private),
      videos,
      cursor: hasMore ? nextCursor : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
