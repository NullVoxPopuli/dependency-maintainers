#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import process from "node:process";
import url from "node:url";
import { execa } from "execa";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CWD = process.cwd();

async function ensureCacheDir() {
  let cachePath = path.join(__dirname, ".cache");

  if (!fsSync.existsSync(cachePath)) {
    await fs.mkdir(cachePath);
  }
}
await ensureCacheDir();

async function cacheResponse(depName, response) {
  let cachePath = path.join(__dirname, ".cache", depName + ".json");
  await fs.writeFile(cachePath, JSON.stringify(response));
}

async function readCachedResponse(depName) {
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

async function readPackageJson() {
  let packageJson = path.join(CWD, "package.json");
  let content = await fs.readFile(packageJson);

  return JSON.parse(content);
}

async function getDeclaredDeps(json, includeDev = false) {
  let deps = [
    ...Object.keys(json.dependencies || {}),
    ...Object.keys(json.peerDependencies || {}),
  ];

  if (includeDev) {
    deps.push(...Object.keys(json.devDependencies || {}));
  }

  return deps;
}

async function getPackageInfo(name) {
  let cached = await readCachedResponse(name);

  if (cached) {
    return cached;
  }
  try {
    let { stdout } = await execa`npm info ${name} --json`;

    return JSON.parse(stdout);
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

const SEEN_DEPS = new Set();
const MAINTAINERS = new Map();
const NOT_FOUND = new Set();
const NOT_AUTHORIZED = new Set();

function updateMaintainers(npmInfo) {
  /**
   * Array:
   * username <email>
   * username2 <email2>
   */
  let { maintainers } = npmInfo;

  let users = maintainers.map((maintainer) => maintainer.split(" ")[0]);

  users.map((user) => {
    let count = MAINTAINERS.get(user) ?? 0;
    MAINTAINERS.set(user, count + 1);
  });
}

const QUEUE = [];

async function traverseGraph() {
  async function processDep(depName) {
    if (SEEN_DEPS.has(depName)) {
      return;
    }

    console.debug(`Processed ${SEEN_DEPS.size}. Processing ${depName}`);

    let info = await getPackageInfo(depName);

    // Did someone else grab this package while we were waiting?
    if (SEEN_DEPS.has(depName)) {
      return;
    }

    if (!info) {
      SEEN_DEPS.add(depName);
      return;
    }

    let subDeps = await getDeclaredDeps(info);
    //
    // Did someone else grab this package while we were waiting?
    if (SEEN_DEPS.has(depName)) {
      return;
    }

    // Only do this once, when we know for sure the work won't be duplicated.
    updateMaintainers(info);

    // Now that we've done all our checking, we can safely
    // never repeat that work again
    SEEN_DEPS.add(depName);

    QUEUE.push(...subDeps);
  }

  async function prepareBatch(batch) {
    await Promise.all(batch.map((depName) => processDep(depName)));
  }

  while (QUEUE.length > 0) {
    let batch = [];

    for (let i = 0; i < Math.min(QUEUE.length, 20); i++) {
      let depName = QUEUE.pop();
      batch.push(depName);
    }

    await prepareBatch(batch);
  }
}

let rootJson = await readPackageJson();
let rootDeps = await getDeclaredDeps(rootJson, true);
QUEUE.push(...rootDeps);
await traverseGraph();

let tableData = [...MAINTAINERS.entries()].map((entry) => ({
  "NPM Name": entry[0],
  "# Packages": entry[1],
}));

tableData.sort((a, b) => a["# Packages"] - b["# Packages"]);

console.info(`
  Number of maintainers: ${MAINTAINERS.size}
  Number of packages: ${SEEN_DEPS.size}
`);
console.table(tableData.reverse());

if (NOT_FOUND.size > 0) {
  console.info("The following packages could not be found and were skipped");
  console.log(NOT_FOUND);
}

if (NOT_AUTHORIZED.size > 0) {
  console.info(
    "The following packages required authorization and were skipped",
  );
  console.log(NOT_AUTHORIZED);
}
