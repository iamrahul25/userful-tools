"use client";

import { useRef } from "react";
import { formatTime } from "./time";
import styles from "./trim.module.css";

const TICKS = 5;

export default function Timeline({
  duration,
  start,
  end,
  currentTime,
  thumbnails,
  thumbnailCount,
  minGap,
  onRangeChange,
  onSeek,
}) {
  const trackRef = useRef(null);
  const dragRef = useRef(null);

  const pct = (t) => `${(t / duration) * 100}%`;

  function timeAt(clientX) {
    const rect = trackRef.current.getBoundingClientRect();
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1) * duration;
  }

  function moveHandle(handle, t) {
    if (handle === "start") onRangeChange(Math.min(Math.max(t, 0), end - minGap), end, "start");
    else onRangeChange(start, Math.max(Math.min(t, duration), start + minGap), "end");
  }

  function update(target, clientX) {
    if (target === "seek") onSeek(timeAt(clientX));
    else moveHandle(target, timeAt(clientX));
  }

  function handlePointerDown(event) {
    const target = event.target.closest("[data-handle]")?.dataset.handle ?? "seek";
    dragRef.current = target;
    trackRef.current.setPointerCapture(event.pointerId);
    if (target === "seek") update(target, event.clientX);
  }

  function handlePointerMove(event) {
    if (dragRef.current) update(dragRef.current, event.clientX);
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleKeyDown(handle) {
    return (event) => {
      const step = event.shiftKey ? 1 : 0.1;
      const value = handle === "start" ? start : end;
      if (event.key === "ArrowLeft") moveHandle(handle, value - step);
      else if (event.key === "ArrowRight") moveHandle(handle, value + step);
      else return;
      event.preventDefault();
    };
  }

  function handleProps(handle) {
    const value = handle === "start" ? start : end;
    return {
      "data-handle": handle,
      className: `${styles.handle} ${handle === "start" ? styles.handleStart : styles.handleEnd}`,
      role: "slider",
      tabIndex: 0,
      "aria-label": handle === "start" ? "Trim start" : "Trim end",
      "aria-valuemin": 0,
      "aria-valuemax": duration,
      "aria-valuenow": value,
      "aria-valuetext": formatTime(value),
      onKeyDown: handleKeyDown(handle),
    };
  }

  return (
    <div className={styles.timeline}>
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className={styles.filmstrip}>
          {Array.from({ length: thumbnailCount }, (_, i) =>
            thumbnails[i] ? (
              <img key={i} src={thumbnails[i]} alt="" draggable={false} />
            ) : (
              <div key={i} className={styles.thumbPlaceholder} />
            )
          )}
        </div>
        <div className={`${styles.dim} ${styles.dimStart}`} style={{ width: pct(start) }} />
        <div className={`${styles.dim} ${styles.dimEnd}`} style={{ left: pct(end) }} />
        <div className={styles.selection} style={{ left: pct(start), width: pct(end - start) }}>
          <div {...handleProps("start")} />
          <div {...handleProps("end")} />
        </div>
        <div className={styles.playhead} style={{ left: pct(currentTime) }} />
      </div>
      <div className={styles.ruler}>
        {Array.from({ length: TICKS }, (_, i) => (
          <span key={i}>{formatTime((i / (TICKS - 1)) * duration)}</span>
        ))}
      </div>
    </div>
  );
}
