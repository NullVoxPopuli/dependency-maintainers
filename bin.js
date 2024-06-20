#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import process from "node:process";
import { execa } from "execa";

import { cacheResponse, readCachedResponse } from "./cache.js";
import { IN_MONOREPO, getMonorepoPackage } from "./monorepo.js";
import { getPackageInfo } from "./npm.js";
import { readPackageJson, getDeclaredDeps } from "./package-json.js";
import { printSummary } from "./output.js";

const CWD = process.cwd();

const BATCH_SIZE = 40;
const SEEN_DEPS = new Set();
const MAINTAINERS = new Map();
const WHO_MAINTAINS = new Set();
const NOT_FOUND = new Set();
const NOT_AUTHORIZED = new Set();

function updateMaintainers(npmInfo) {
  /**
   * Array:
   * username <email>
   * username2 <email2>
   */
  let { maintainers, _npmUser } = npmInfo;

  let users = maintainers?.map((maintainer) => maintainer.split(" ")[0]) ?? [];

  users.map(incrementUser);

  if (!maintainers) {
    WHO_MAINTAINS.add(npmInfo.name);
  }
}

function incrementUser(user) {
  let count = MAINTAINERS.get(user) ?? 0;
  MAINTAINERS.set(user, count + 1);
}

const QUEUE = [];

async function traverseGraph() {
  async function processDep(depName) {
    if (SEEN_DEPS.has(depName)) {
      return;
    }

    console.debug(`Processed ${SEEN_DEPS.size}. Processing ${depName}`);

    let shouldSkipMaintainers = IN_MONOREPO.has(depName);
    let info = getMonorepoPackage(depName) || (await getPackageInfo(depName));

    // Did someone else grab this package while we were waiting?
    if (SEEN_DEPS.has(depName)) {
      return;
    }

    // Did someone else grab this package while we were waiting?
    if (SEEN_DEPS.has(depName)) {
      return;
    }

    if (!info) {
      SEEN_DEPS.add(depName);
      return;
    }

    if (!shouldSkipMaintainers) {
      updateMaintainers(info);
    }

    // Now that we've done all our checking, we can safely
    // never repeat that work again
    SEEN_DEPS.add(depName);

    let subDeps = await getDeclaredDeps(info);

    // Did someone else grab this package while we were waiting?
    if (SEEN_DEPS.has(depName)) {
      return;
    }

    QUEUE.push(...subDeps);
  }

  async function prepareBatch(batch) {
    await Promise.all(batch.map((depName) => processDep(depName)));
  }

  while (QUEUE.length > 0) {
    let batch = [];

    for (let i = 0; i < Math.min(QUEUE.length, BATCH_SIZE); i++) {
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

printSummary({
  MAINTAINERS,
  SEEN_DEPS,
  NOT_FOUND,
  NOT_AUTHORIZED,
  WHO_MAINTAINS,
});
