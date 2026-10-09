let loading = null;
let instance = null;

export function loadFFmpeg() {
  if (!loading) {
    loading = (async () => {
      const base = `${window.location.origin}/ffmpeg`;
      const { FFmpeg } = await import(/* webpackIgnore: true */ `${base}/index.js`);
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: `${base}/ffmpeg-core.js`,
        wasmURL: `${base}/ffmpeg-core.wasm`,
      });
      instance = ffmpeg;
      return ffmpeg;
    })().catch((error) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}

export function cancelFFmpeg() {
  instance?.terminate();
  instance = null;
  loading = null;
}

function toSeconds(h, m, s) {
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

// Re-encodes `file` to an H.264/AAC MP4, optionally keeping only `duration` seconds from `start`.
export async function transcodeToMp4(file, { start = 0, duration } = {}, onProgress) {
  const ffmpeg = await loadFFmpeg();
  const extension = file.name.match(/\.[^.]+$/)?.[0] ?? "";
  const input = `input${extension}`;
  const output = "output.mp4";
  let total = duration;

  const onLog = ({ message }) => {
    const length = message.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (length && !total) total = toSeconds(length[1], length[2], length[3]);
    const time = message.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (time && total) onProgress?.(Math.min(1, toSeconds(time[1], time[2], time[3]) / total));
  };
  ffmpeg.on("log", onLog);

  try {
    await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()));

    const args = [];
    if (start > 0) args.push("-ss", start.toFixed(3));
    args.push("-i", input);
    if (duration) args.push("-t", duration.toFixed(3));
    args.push(
      // libx264 with yuv420p requires even dimensions.
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      output
    );

    const exitCode = await ffmpeg.exec(args);
    if (exitCode !== 0) throw new Error("ffmpeg could not process this video.");

    const data = await ffmpeg.readFile(output);
    onProgress?.(1);
    return new Blob([data], { type: "video/mp4" });
  } finally {
    ffmpeg.off("log", onLog);
    for (const path of [input, output]) {
      try {
        await ffmpeg.deleteFile(path);
      } catch {}
    }
  }
}
