"use client";

import { useState } from "react";
import styles from "./instagram.module.css";

function downloadHref(video, name) {
  return `/api/instagram/download?${new URLSearchParams({ url: video.url, name })}`;
}

export default function InstagramDownloader() {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState(null);
  const [error, setError] = useState("");

  async function lookup(event) {
    event.preventDefault();
    if (!link.trim() || loading) return;
    setLoading(true);
    setError("");
    setPost(null);
    try {
      const response = await fetch(`/api/instagram?${new URLSearchParams({ url: link })}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPost(data);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function paste() {
    try {
      setLink((await navigator.clipboard.readText()).trim());
    } catch {
      setError("Couldn't read your clipboard. Paste the link into the box instead.");
    }
  }

  const baseName = post && [post.username, post.shortcode].filter(Boolean).join("-");

  return (
    <div className={styles.tool}>
      <form className={styles.form} onSubmit={lookup}>
        <input
          className={styles.input}
          type="text"
          inputMode="url"
          aria-label="Instagram post or reel link"
          placeholder="https://www.instagram.com/reel/..."
          value={link}
          onChange={(event) => setLink(event.target.value)}
          disabled={loading}
          autoFocus
        />
        <button type="button" className={styles.button} onClick={paste} disabled={loading}>
          Paste
        </button>
        <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={loading || !link.trim()}>
          {loading ? "Fetching…" : "Get video"}
        </button>
      </form>

      {loading && (
        <div className={styles.bar}>
          <div className={styles.barIndeterminate} />
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {post && (
        <div className={styles.results}>
          {post.username && (
            <p className={styles.meta}>
              From <strong>@{post.username}</strong>
              {post.videos.length > 1 && ` · ${post.videos.length} videos`}
            </p>
          )}
          {post.caption && <p className={styles.caption}>{post.caption}</p>}
          <div className={styles.grid}>
            {post.videos.map((video, index) => {
              const name = post.videos.length > 1 ? `${baseName}-${index + 1}` : baseName;
              return (
                <div key={video.url} className={styles.result}>
                  <div className={styles.resultHeader}>
                    <span>
                      {video.width}×{video.height} MP4
                    </span>
                    <a className={`${styles.button} ${styles.primary}`} href={downloadHref(video, name)}>
                      Download
                    </a>
                  </div>
                  <video
                    className={styles.video}
                    src={video.url}
                    poster={video.thumbnail ?? undefined}
                    controls
                    playsInline
                    preload="metadata"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
