"use client";

import { useState } from "react";
import styles from "../instagram-downloader/instagram.module.css";
import own from "./account.module.css";

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  }
}

function VideoCard({ video }) {
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const link = `https://www.instagram.com/${video.isReel ? "reel" : "p"}/${video.shortcode}/`;

  async function copyLink() {
    if (await copyText(link)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      setError(`Couldn't copy automatically. The link is ${link}`);
    }
  }

  async function play() {
    setLoading(true);
    setError("");
    try {
      const post = await getJson(`/api/instagram?${new URLSearchParams({ url: video.shortcode })}`);
      setSource(post.videos[0]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.result}>
      <div className={styles.resultHeader}>
        <a className={own.link} href={link} target="_blank" rel="noreferrer">
          {video.isReel ? "Reel" : "Video"} · {video.shortcode}
        </a>
        <button type="button" className={styles.button} onClick={copyLink}>
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
      {source ? (
        <video
          className={styles.video}
          src={source.url}
          poster={source.thumbnail ?? video.thumbnail ?? undefined}
          controls
          autoPlay
          playsInline
        />
      ) : (
        <button type="button" className={own.thumb} onClick={play} disabled={loading}>
          {video.thumbnail && <img src={video.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />}
          <span className={own.play}>{loading ? "Loading…" : "▶ Play"}</span>
        </button>
      )}
      {error && <p className={styles.error}>{error}</p>}
      {video.caption ? (
        <p className={own.caption}>{video.caption}</p>
      ) : (
        <p className={own.noCaption}>No caption</p>
      )}
    </div>
  );
}

export default function InstagramAccountVideos() {
  const [input, setInput] = useState("");
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(username, cursor) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ username });
      if (cursor) params.set("cursor", cursor);
      const data = await getJson(`/api/instagram/account?${params}`);
      setAccount((previous) =>
        cursor && previous ? { ...data, videos: [...previous.videos, ...data.videos] } : data,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function lookup(event) {
    event.preventDefault();
    if (!input.trim() || loading) return;
    setAccount(null);
    load(input);
  }

  return (
    <div className={styles.tool}>
      <form className={styles.form} onSubmit={lookup}>
        <input
          className={styles.input}
          type="text"
          aria-label="Instagram username or profile link"
          placeholder="natgeo or https://www.instagram.com/natgeo/"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={loading}
          autoFocus
        />
        <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={loading || !input.trim()}>
          {loading && !account ? "Fetching…" : "Get videos"}
        </button>
      </form>

      {loading && (
        <div className={styles.bar}>
          <div className={styles.barIndeterminate} />
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {account && (
        <div className={styles.results}>
          <p className={styles.meta}>
            <strong>@{account.username}</strong>
            {account.fullName && ` · ${account.fullName}`}
            {` · ${account.videos.length} video${account.videos.length === 1 ? "" : "s"} loaded`}
          </p>
          {account.videos.length === 0 && !account.cursor && (
            <p className={styles.meta}>This account hasn&apos;t posted any videos.</p>
          )}
          <div className={styles.grid}>
            {account.videos.map((video) => (
              <VideoCard key={video.shortcode} video={video} />
            ))}
          </div>
          {account.cursor && (
            <button
              type="button"
              className={`${styles.button} ${own.more}`}
              onClick={() => load(account.username, account.cursor)}
              disabled={loading}
            >
              {loading ? "Loading…" : "Load more videos"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
