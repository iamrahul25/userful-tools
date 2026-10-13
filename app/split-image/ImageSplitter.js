"use client";

import { useEffect, useRef, useState } from "react";
import {
  cutOffsets,
  fileBaseName,
  gridSummary,
  outputFormat,
  partSizes,
  splitImage,
  zipFiles,
} from "./split";
import styles from "./split.module.css";

const MAX_PARTS = 20;

function clampCount(value) {
  const number = Number(value);
  if (!Number.isInteger(number)) return null;
  return Math.min(MAX_PARTS, Math.max(1, number));
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function revokePieces(pieces) {
  pieces?.forEach((piece) => URL.revokeObjectURL(piece.url));
}

function sizeLabel(widths, heights) {
  const sameWidth = widths.every((width) => width === widths[0]);
  const sameHeight = heights.every((height) => height === heights[0]);
  if (sameWidth && sameHeight) return `Each piece is ${widths[0]}×${heights[0]} px.`;
  const width = sameWidth ? `${widths[0]}` : `${Math.min(...widths)}–${Math.max(...widths)}`;
  const height = sameHeight ? `${heights[0]}` : `${Math.min(...heights)}–${Math.max(...heights)}`;
  return `Pieces are ${width}×${height} px, and every pixel is kept.`;
}

export default function ImageSplitter() {
  const imageRef = useRef(null);
  const imageUrlRef = useRef("");
  const piecesRef = useRef(null);
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageSize, setImageSize] = useState(null);
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(4);
  const [pieces, setPieces] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
      revokePieces(piecesRef.current);
    };
  }, []);

  useEffect(() => {
    const image = imageRef.current;
    if (!image?.complete || !image.naturalWidth) return;
    setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
  }, [imageUrl]);

  function replacePieces(next) {
    revokePieces(piecesRef.current);
    piecesRef.current = next;
    setPieces(next);
  }

  function selectFile(selected) {
    if (!selected) return;
    if (selected.type && !selected.type.startsWith("image/")) {
      setError("That file isn't an image. Choose a PNG, JPG, or WebP.");
      return;
    }
    setError("");
    setImageSize(null);
    replacePieces(null);
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    const url = URL.createObjectURL(selected);
    imageUrlRef.current = url;
    setFile(selected);
    setImageUrl(url);
  }

  function changeCount(setter, value) {
    const next = clampCount(value);
    if (next === null) return;
    setter(next);
    replacePieces(null);
  }

  async function downloadAll() {
    const image = imageRef.current;
    if (!image || busy || !rowHeights || !colWidths) {
      setError(!image ? "The image isn't ready yet." : "Choose a grid that fits this image.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const format = outputFormat(file.type);
      const next = await splitImage(image, {
        rows,
        cols,
        format,
        baseName: fileBaseName(file.name),
      });
      const zipped = zipFiles(
        await Promise.all(
          next.map(async (piece) => ({
            name: piece.name,
            data: new Uint8Array(await piece.blob.arrayBuffer()),
          })),
        ),
      );
      replacePieces(
        next.map((piece) => ({
          ...piece,
          url: URL.createObjectURL(piece.blob),
        })),
      );
      saveBlob(new Blob([zipped], { type: "application/zip" }), `${fileBaseName(file.name)}-${rows}x${cols}.zip`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't split that image.");
    } finally {
      setBusy(false);
    }
  }

  const format = file ? outputFormat(file.type) : null;
  const rowHeights = imageSize ? partSizes(imageSize.height, rows) : null;
  const colWidths = imageSize ? partSizes(imageSize.width, cols) : null;
  const tooSmall = Boolean(imageSize && (!rowHeights || !colWidths));
  const horizontal = rowHeights ? cutOffsets(rowHeights) : [];
  const vertical = colWidths ? cutOffsets(colWidths) : [];

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
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            selectFile(event.dataTransfer.files[0]);
          }}
        >
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/*"
            hidden
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <strong>Drop an image here or click to choose</strong>
          <span>PNG, JPG, and WebP. Transparent backgrounds stay transparent.</span>
        </label>
        {error && <p className={styles.error}>{error}</p>}
      </>
    );
  }

  return (
    <div className={styles.editor}>
      <div className={styles.fileBar}>
        <span className={styles.fileName}>
          {file.name}
          {imageSize && (
            <span>
              {" "}
              · {imageSize.width}×{imageSize.height}
            </span>
          )}
        </span>
        <label className={`${styles.button} ${busy ? styles.disabled : ""}`}>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/*"
            hidden
            disabled={busy}
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          Choose another image
        </label>
      </div>

      <div className={styles.stage}>
        <div className={styles.frame}>
          <img
            ref={imageRef}
            src={imageUrl}
            alt=""
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (!naturalWidth || !naturalHeight) {
                setError("Couldn't read that image.");
                return;
              }
              setImageSize({ width: naturalWidth, height: naturalHeight });
            }}
            onError={() => setError("Couldn't read that image.")}
          />
          {horizontal.map((offset) => (
            <span
              key={`h-${offset}`}
              className={styles.hLine}
              aria-hidden="true"
              style={{ top: `${(offset / imageSize.height) * 100}%` }}
            />
          ))}
          {vertical.map((offset) => (
            <span
              key={`v-${offset}`}
              className={styles.vLine}
              aria-hidden="true"
              style={{ left: `${(offset / imageSize.width) * 100}%` }}
            />
          ))}
        </div>
      </div>

      <div className={styles.controls}>
        <label className={styles.field}>
          Rows
          <input
            type="number"
            min={1}
            max={MAX_PARTS}
            inputMode="numeric"
            aria-describedby="grid-summary"
            value={rows}
            disabled={busy}
            onChange={(event) => changeCount(setRows, event.target.value)}
          />
          <span>horizontal cuts</span>
        </label>
        <label className={styles.field}>
          Columns
          <input
            type="number"
            min={1}
            max={MAX_PARTS}
            inputMode="numeric"
            aria-describedby="grid-summary"
            value={cols}
            disabled={busy}
            onChange={(event) => changeCount(setCols, event.target.value)}
          />
          <span>vertical cuts</span>
        </label>
        <p id="grid-summary" className={styles.summary} aria-live="polite">
          {gridSummary(rows, cols)}
        </p>
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          disabled={busy || !rowHeights || !colWidths}
          onClick={downloadAll}
        >
          {busy ? "Cutting…" : `Download ${rows * cols} ${rows * cols === 1 ? "piece" : "pieces"}`}
        </button>
      </div>

      {rowHeights && colWidths && <p className={styles.note}>{sizeLabel(colWidths, rowHeights)}</p>}
      {format?.note ? (
        <p className={styles.note}>{format.note}</p>
      ) : (
        format && format.mime !== "image/jpeg" && (
          <p className={styles.note}>Transparency is kept in every piece.</p>
        )
      )}
      {tooSmall && (
        <p className={styles.error}>
          Choose fewer rows or columns. This image is {imageSize.width}×{imageSize.height}.
        </p>
      )}
      {error && <p className={styles.error}>{error}</p>}

      {pieces && (
        <div className={styles.results}>
          <div className={styles.resultHeader}>
            <h2>
              {pieces.length} {pieces.length === 1 ? "piece" : "pieces"}
            </h2>
            <span>Saved as a zip of separate images</span>
          </div>
          <div className={styles.pieces} style={{ "--cols": cols }}>
            {pieces.map((piece) => (
              <figure key={piece.name} className={styles.piece}>
                <div className={styles.pieceFrame}>
                  <img src={piece.url} alt={`Row ${piece.row}, column ${piece.col}`} />
                </div>
                <figcaption>
                  <span>
                    r{piece.row} c{piece.col} · {piece.width}×{piece.height}
                  </span>
                  <a href={piece.url} download={piece.name}>
                    Download
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
