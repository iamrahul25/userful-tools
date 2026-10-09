"use client";

import { useEffect, useRef, useState } from "react";
import Timeline from "./Timeline";
import { cancelFFmpeg, loadFFmpeg, transcodeToMp4 } from "./ffmpeg";
import { formatBytes, formatTime, parseTime } from "./time";
import styles from "./trim.module.css";

const MIN_CLIP = 0.1;
const THUMBNAIL_COUNT = 12;

function once(element, event) {
  return new Promise((resolve, reject) => {
    element.addEventListener(event, resolve, { once: true });
    element.addEventListener("error", reject, { once: true });
  });
}

function TimeField({ label, value, onCommit }) {
  const [draft, setDraft] = useState(null);

  function commit() {
    const time = parseTime(draft ?? "");
    if (time !== null) onCommit(time);
    setDraft(null);
  }

  return (
    <label className={styles.field}>
      {label}
      <input
        value={draft ?? formatTime(value)}
        onFocus={() => setDraft(formatTime(value))}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === "Enter" && commit()}
      />
    </label>
  );
}

export default function VideoTrimmer() {
  const videoRef = useRef(null);
  const cancelledRef = useRef(false);
  const previewFallbackRef = useRef(null);

  const [file, setFile] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [thumbnails, setThumbnails] = useState([]);
  const [task, setTask] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => videoURL && URL.revokeObjectURL(videoURL), [videoURL]);
  useEffect(() => () => result && URL.revokeObjectURL(result.url), [result]);

  useEffect(() => {
    if (!videoURL || !duration) return;
    let cancelled = false;
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.src = videoURL;

    (async () => {
      await once(video, "loadeddata");
      const canvas = document.createElement("canvas");
      canvas.height = 90;
      canvas.width = Math.round((90 * video.videoWidth) / video.videoHeight);
      const context = canvas.getContext("2d");
      const frames = [];
      for (let i = 0; i < THUMBNAIL_COUNT && !cancelled; i++) {
        video.currentTime = ((i + 0.5) / THUMBNAIL_COUNT) * duration;
        await once(video, "seeked");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.7));
        if (!cancelled) setThumbnails([...frames]);
      }
    })().catch(() => {});

    return () => {
      cancelled = true;
      video.removeAttribute("src");
      video.load();
    };
  }, [videoURL, duration]);

  useEffect(() => {
    if (!playing) return;
    let frame;
    const tick = () => {
      const video = videoRef.current;
      if (video.currentTime >= range.end) {
        video.pause();
        video.currentTime = range.end;
        setCurrentTime(range.end);
        return;
      }
      setCurrentTime(video.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, range.end]);

  function selectFile(selected) {
    if (!selected) return;
    if (selected.type && !selected.type.startsWith("video/")) {
      setError("That file isn't a video. Please choose a video file.");
      return;
    }
    setError("");
    setResult(null);
    setThumbnails([]);
    setDuration(0);
    setRange({ start: 0, end: 0 });
    setCurrentTime(0);
    setPlaying(false);
    setFile(selected);
    setVideoURL(URL.createObjectURL(selected));
  }

  async function runTask(label, work) {
    cancelledRef.current = false;
    setError("");
    try {
      setTask({ label: "Loading the video engine (first time only, about 30 MB)", progress: null });
      await loadFFmpeg();
      setTask({ label, progress: 0 });
      await work((progress) => setTask((current) => current && { ...current, progress }));
    } catch (err) {
      if (!cancelledRef.current) throw err;
    } finally {
      setTask(null);
    }
  }

  async function convertForPreview() {
    if (previewFallbackRef.current === file) {
      setError("This video format isn't supported.");
      return;
    }
    previewFallbackRef.current = file;
    try {
      await runTask("Converting so your browser can preview it", async (onProgress) => {
        const blob = await transcodeToMp4(file, {}, onProgress);
        setVideoURL(URL.createObjectURL(blob));
      });
    } catch {
      setError("This video format isn't supported.");
    }
  }

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video.videoWidth || !Number.isFinite(video.duration)) {
      convertForPreview();
      return;
    }
    setDuration(video.duration);
    setRange({ start: 0, end: video.duration });
    setCurrentTime(0);
  }

  function seek(time) {
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video.paused) {
      video.pause();
      return;
    }
    if (video.currentTime < range.start || video.currentTime >= range.end - 0.05) {
      seek(range.start);
    }
    video.play();
  }

  function changeRange(start, end, moved) {
    videoRef.current.pause();
    setRange({ start, end });
    seek(moved === "start" ? start : end);
  }

  function setStart(time) {
    changeRange(Math.min(Math.max(time, 0), range.end - MIN_CLIP), range.end, "start");
  }

  function setEnd(time) {
    changeRange(range.start, Math.max(Math.min(time, duration), range.start + MIN_CLIP), "end");
  }

  async function trim() {
    setResult(null);
    try {
      await runTask("Trimming your video", async (onProgress) => {
        const blob = await transcodeToMp4(
          file,
          { start: range.start, duration: range.end - range.start },
          onProgress
        );
        setResult({
          url: URL.createObjectURL(blob),
          name: `${file.name.replace(/\.[^.]+$/, "")}-trimmed.mp4`,
          size: blob.size,
        });
      });
    } catch {
      setError("Something went wrong while trimming. The video may be too large to process in the browser.");
    }
  }

  function cancelTask() {
    cancelledRef.current = true;
    cancelFFmpeg();
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files[0]);
  }

  const busy = task !== null;

  if (!file) {
    return (
      <>
        <label
          className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="video/*,.mkv,.avi,.flv,.wmv,.ts,.3gp"
            hidden
            onChange={(event) => selectFile(event.target.files[0])}
          />
          <strong>Drop a video here or click to choose</strong>
          <span>MP4, MOV, WebM, MKV, AVI and more</span>
        </label>
        {error && <p className={styles.error}>{error}</p>}
      </>
    );
  }

  return (
    <div className={styles.editor}>
      <div className={styles.fileBar}>
        <span className={styles.fileName}>{file.name}</span>
        <label className={`${styles.button} ${busy ? styles.disabled : ""}`}>
          <input
            type="file"
            accept="video/*,.mkv,.avi,.flv,.wmv,.ts,.3gp"
            hidden
            disabled={busy}
            onChange={(event) => selectFile(event.target.files[0])}
          />
          Choose another video
        </label>
      </div>

      <video
        ref={videoRef}
        className={styles.video}
        src={videoURL}
        playsInline
        onClick={togglePlay}
        onLoadedMetadata={handleLoadedMetadata}
        onError={convertForPreview}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {duration > 0 && (
        <>
          <Timeline
            duration={duration}
            start={range.start}
            end={range.end}
            currentTime={currentTime}
            thumbnails={thumbnails}
            thumbnailCount={THUMBNAIL_COUNT}
            minGap={MIN_CLIP}
            onRangeChange={changeRange}
            onSeek={seek}
          />
          <p className={styles.hint}>
            Drag the dark handles to choose the part to keep. Click the strip to move the playhead.
          </p>

          <div className={styles.controls}>
            <button className={styles.button} onClick={togglePlay}>
              {playing ? "Pause" : "Play selection"}
            </button>
            <span className={styles.clock}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className={styles.controls}>
            <TimeField label="Start" value={range.start} onCommit={setStart} />
            <button className={styles.button} onClick={() => setStart(currentTime)}>
              Set to playhead
            </button>
            <TimeField label="End" value={range.end} onCommit={setEnd} />
            <button className={styles.button} onClick={() => setEnd(currentTime)}>
              Set to playhead
            </button>
            <div className={styles.field}>
              Length
              <span className={styles.length}>{formatTime(range.end - range.start)}</span>
            </div>
            <div className={styles.spacer} />
            <button className={`${styles.button} ${styles.primary}`} onClick={trim} disabled={busy}>
              Trim video
            </button>
          </div>
        </>
      )}

      {task && (
        <div className={styles.progress}>
          <div className={styles.progressRow}>
            <span>
              {task.label}
              {task.progress !== null && ` · ${Math.round(task.progress * 100)}%`}
            </span>
            <button className={styles.button} onClick={cancelTask}>
              Cancel
            </button>
          </div>
          <div className={styles.bar}>
            <div
              className={`${styles.barFill} ${task.progress === null ? styles.barIndeterminate : ""}`}
              style={{ width: task.progress === null ? undefined : `${task.progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {result && (
        <div className={styles.result}>
          <div className={styles.resultHeader}>
            <div>
              <h2>Your trimmed video</h2>
              <span>
                {result.name} · {formatBytes(result.size)}
              </span>
            </div>
            <a className={`${styles.button} ${styles.primary}`} href={result.url} download={result.name}>
              Download
            </a>
          </div>
          <video className={styles.video} src={result.url} controls playsInline />
        </div>
      )}
    </div>
  );
}
