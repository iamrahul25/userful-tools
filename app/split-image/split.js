const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let crc = n;
    for (let k = 0; k < 8; k += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[n] = crc >>> 0;
  }
  return table;
})();

export function partSizes(total, parts) {
  if (!Number.isInteger(parts) || parts < 1 || total < parts) return null;
  const base = Math.floor(total / parts);
  const extra = total % parts;
  return Array.from({ length: parts }, (_, index) => base + (index < extra ? 1 : 0));
}

export function cutOffsets(sizes) {
  const cuts = [];
  let offset = 0;
  for (let index = 0; index < sizes.length - 1; index += 1) {
    offset += sizes[index];
    cuts.push(offset);
  }
  return cuts;
}

export function fileBaseName(filename) {
  const stripped = filename.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "");
  const cleaned = stripped.replace(/[\\/:*?"<>|]+/g, "").trim();
  return cleaned || "image";
}

export function outputFormat(type) {
  if (type === "image/jpeg" || type === "image/jpg") {
    return { mime: "image/jpeg", ext: "jpg", quality: 0.95 };
  }
  if (type === "image/webp") {
    return { mime: "image/webp", ext: "webp", quality: 0.95 };
  }
  if (type === "image/png") {
    return { mime: "image/png", ext: "png" };
  }
  return {
    mime: "image/png",
    ext: "png",
    note: "Saved as PNG so a transparent background is kept.",
  };
}

export function gridSummary(rows, cols) {
  const pieces = rows * cols;
  const parts = [`${rows}:${cols} grid`, `${pieces} ${pieces === 1 ? "piece" : "pieces"}`];
  const horizontal = rows - 1;
  const vertical = cols - 1;
  if (horizontal > 0) {
    parts.push(`${horizontal} horizontal ${horizontal === 1 ? "line" : "lines"}`);
  }
  if (vertical > 0) {
    parts.push(`${vertical} vertical ${vertical === 1 ? "line" : "lines"}`);
  }
  return parts.join(" · ");
}

function crc32(data) {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosStamp(date) {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export function zipFiles(files, date = new Date()) {
  const encoder = new TextEncoder();
  const entries = files.map((file) => ({
    name: encoder.encode(file.name),
    data: file.data,
    crc: crc32(file.data),
  }));
  const { time, day } = dosStamp(date);

  let localSize = 0;
  let centralSize = 0;
  for (const entry of entries) {
    localSize += 30 + entry.name.length + entry.data.length;
    centralSize += 46 + entry.name.length;
  }

  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let offset = 0;
  const localOffsets = [];

  for (const entry of entries) {
    localOffsets.push(offset);
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 0x0800, true);
    view.setUint16(offset + 8, 0, true);
    view.setUint16(offset + 10, time, true);
    view.setUint16(offset + 12, day, true);
    view.setUint32(offset + 14, entry.crc, true);
    view.setUint32(offset + 18, entry.data.length, true);
    view.setUint32(offset + 22, entry.data.length, true);
    view.setUint16(offset + 26, entry.name.length, true);
    view.setUint16(offset + 28, 0, true);
    out.set(entry.name, offset + 30);
    out.set(entry.data, offset + 30 + entry.name.length);
    offset += 30 + entry.name.length + entry.data.length;
  }

  const centralStart = offset;
  entries.forEach((entry, index) => {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, 0x0800, true);
    view.setUint16(offset + 10, 0, true);
    view.setUint16(offset + 12, time, true);
    view.setUint16(offset + 14, day, true);
    view.setUint32(offset + 16, entry.crc, true);
    view.setUint32(offset + 20, entry.data.length, true);
    view.setUint32(offset + 24, entry.data.length, true);
    view.setUint16(offset + 28, entry.name.length, true);
    view.setUint16(offset + 30, 0, true);
    view.setUint16(offset + 32, 0, true);
    view.setUint16(offset + 34, 0, true);
    view.setUint16(offset + 36, 0, true);
    view.setUint32(offset + 38, 0, true);
    view.setUint32(offset + 42, localOffsets[index], true);
    out.set(entry.name, offset + 46);
    offset += 46 + entry.name.length;
  });

  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 8, entries.length, true);
  view.setUint16(offset + 10, entries.length, true);
  view.setUint32(offset + 12, offset - centralStart, true);
  view.setUint32(offset + 16, centralStart, true);
  return out;
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't export a piece."))),
      mime,
      quality,
    );
  });
}

async function exportCanvas(canvas, format) {
  try {
    const blob = await canvasToBlob(canvas, format.mime, format.quality);
    return { blob, ext: format.ext, mime: format.mime };
  } catch (error) {
    if (format.mime === "image/png") throw error;
    const blob = await canvasToBlob(canvas, "image/png");
    return { blob, ext: "png", mime: "image/png" };
  }
}

export async function splitImage(image, { rows, cols, format, baseName }) {
  const rowHeights = partSizes(image.naturalHeight, rows);
  const colWidths = partSizes(image.naturalWidth, cols);
  if (!rowHeights || !colWidths) {
    throw new Error("This image is too small for that grid.");
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Couldn't prepare a canvas for this image.");

  const pieces = [];
  let saved = format;
  let y = 0;

  for (let row = 0; row < rows; row += 1) {
    const height = rowHeights[row];
    let x = 0;
    for (let col = 0; col < cols; col += 1) {
      const width = colWidths[col];
      canvas.width = width;
      canvas.height = height;
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, x, y, width, height, 0, 0, width, height);

      const exported = await exportCanvas(canvas, saved);
      saved = { ...saved, mime: exported.mime, ext: exported.ext };
      pieces.push({
        blob: exported.blob,
        name: `${baseName}-r${row + 1}-c${col + 1}.${exported.ext}`,
        row: row + 1,
        col: col + 1,
        width,
        height,
      });
      x += width;
    }
    y += height;
  }

  return pieces;
}
