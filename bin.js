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
import {
  SEEN_DEPS,
  MAINTAINERS,
  WHO_MAINTAINS,
  NOT_FOUND,
  NOT_AUTHORIZED,
} from "./info-buckets.js";

const CWD = process.cwd();

const BATCH_SIZE = 40;

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
const HAS_INFO = new Set();

async function traverseGraph() {
  async function processDep(depName) {
    console.debug(`Processed ${SEEN_DEPS.size}. Processing ${depName}`);

    let shouldSkipMaintainers = IN_MONOREPO.has(depName);
    let info = getMonorepoPackage(depName) || (await getPackageInfo(depName));

    if (!info) {
      return;
    }

    HAS_INFO.add(info);

    if (!shouldSkipMaintainers) {
      updateMaintainers(info);
    }

    let subDeps = await getDeclaredDeps(info);

    QUEUE.push(...subDeps);
  }

  async function prepareBatch(batch) {
    await Promise.all(
      batch.map((depName) => {
        if (SEEN_DEPS.has(depName)) return;

        SEEN_DEPS.add(depName);
        return processDep(depName);
      }),
    );
  }

  while (QUEUE.length > 0) {
    let batch = [];

    for (let i = 0; i < Math.min(QUEUE.length, BATCH_SIZE); i++) {
      let depName = QUEUE.pop();

      if (SEEN_DEPS.has(depName)) {
        i--;
        continue;
      }

      batch.push(depName);
    }

    await prepareBatch(batch);
  }
}

let rootJson = await readPackageJson();
let rootDeps = await getDeclaredDeps(rootJson, true);

QUEUE.push(...rootDeps);
await traverseGraph();

printSummary();
