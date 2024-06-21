import path from "node:path";
import url from "node:url";
import fsSync from "node:fs";
import fs from "node:fs/promises";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

async function ensureCacheDir() {
  let cachePath = path.join(__dirname, ".cache");

  if (!fsSync.existsSync(cachePath)) {
    await fs.mkdir(cachePath);
  }
}
await ensureCacheDir();

export async function cacheResponse(depName, response) {
  let cachePath = path.join(__dirname, ".cache", depName + ".json");

  if (depName.includes("/")) {
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
  }

  await fs.writeFile(cachePath, JSON.stringify(response));
}

export async function readCachedResponse(depName) {
  let cachePath = path.join(__dirname, ".cache", depName + ".json");

  if (!fsSync.existsSync(cachePath)) {
    return;
  }

  let f = await fs.readFile(cachePath);

  let content = f.toString();

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error(e);
    return;
  }
}
