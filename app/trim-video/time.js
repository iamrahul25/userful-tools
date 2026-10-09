export function formatTime(seconds) {
  const tenths = Math.round(Math.max(0, seconds) * 10);
  const h = Math.floor(tenths / 36000);
  const m = Math.floor((tenths % 36000) / 600);
  const s = ((tenths % 600) / 10).toFixed(1).padStart(4, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

// Accepts "83.4", "1:23.4" or "0:01:23.4". Returns null if the text isn't a valid time.
export function parseTime(text) {
  const parts = text.trim().split(":");
  if (parts.length > 3 || parts.some((part) => part === "" || isNaN(Number(part)))) {
    return null;
  }
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
}

export function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
