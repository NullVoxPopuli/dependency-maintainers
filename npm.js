import { execa } from "execa";
import { cacheResponse, readCachedResponse } from "./cache.js";

export async function getPackageInfo(name) {
  let cached = await readCachedResponse(name);

  if (cached) {
    return cached;
  }
  try {
    let { stdout } = await execa`npm info ${name} --json`;

    let json = JSON.parse(stdout);

    await cacheResponse(name, json);

    return json;
  } catch (e) {
    if (typeof e === "object" && e !== null) {
      if ("message" in e) {
        let msg = e.message;
        if (msg.includes("code E404")) {
          NOT_FOUND.add(name);

          return;
        }

        if (msg.includes("code E401")) {
          NOT_AUTHORIZED.add(name);

          return;
        }
      }
    }

    throw e;
  }
}
