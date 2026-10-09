import { cpSync, mkdirSync, readdirSync } from "node:fs";

// ffmpeg.wasm is served as static files because its worker loader can't be bundled by Turbopack.
const to = "public/ffmpeg";
const sources = ["node_modules/@ffmpeg/ffmpeg/dist/esm", "node_modules/@ffmpeg/core/dist/esm"];

mkdirSync(to, { recursive: true });
for (const from of sources) {
  for (const file of readdirSync(from)) {
    if (/\.(js|wasm)$/.test(file)) cpSync(`${from}/${file}`, `${to}/${file}`);
  }
}
