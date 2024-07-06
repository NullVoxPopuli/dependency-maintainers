#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import process from "node:process";
import { parseArgs } from "node:util";
import { execa } from "execa";
import cliProgress from "cli-progress";

import { cacheResponse, readCachedResponse, clearCache } from "./cache.js";
import {
  IN_MONOREPO,
  getMonorepoPackage,
  getAllPackageJSONs,
} from "./monorepo.js";
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

const args = parseArgs({
  options: {
    recursive: {
      type: "boolean",
      short: "r",
      default: false,
    },
    force: {
      type: "boolean",
      default: false,
    },
    verbose: {
      type: "boolean",
      short: "v",
      default: false,
    },
    help: {
      type: "boolean",
      short: "h",
      default: false,
    },
  },
});

if (args.values.help) {
  console.log(`
    Usage: 

      npx dependency-maintainers


      --recursive, -r     In a monorepo, find the montainers of every (package in the monorepo)'s (dev)dependencies

                            npx dependency-maintainers --recursive

      --verbose, -v       Print extra logging to stdout

                            npx dependency-maintainers --verbose

      --force             Force a cache refresh

                            npx dependency-maintainers --force

      --help, -h          show this message

                            npx dependency-maintainers --help
  `);
  process.exit(0);
}

if (args.values.force) {
  await clearCache();
}

const BATCH_SIZE = 40;
const IS_VERBOSE = args.values.verbose;

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
let seen = 0;
let total = 0;
const progress = new cliProgress.SingleBar(
  {},
  cliProgress.Presets.shades_classic,
);

function showProgress() {
  progress.start(total, seen);
}

function updateProgress() {
  if (IS_VERBOSE) return;

  progress.update(seen);
}

async function traverseGraph() {
  async function processDep(depName) {
    if (IS_VERBOSE) {
      console.debug(`Processed ${SEEN_DEPS.size}. Processing ${depName}`);
    } else {
      showProgress();
    }

    let shouldSkipMaintainers = IN_MONOREPO.has(depName);
    let info = getMonorepoPackage(depName) || (await getPackageInfo(depName));

    seen++;
    updateProgress();
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

        total++;
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

let rootDeps = [];

if (args.values.recursive) {
  let all = getAllPackageJSONs();

  console.log(`Getting maintainers for all ${all.length} packages...`);

  for (let rootJson of all) {
    rootDeps = await getDeclaredDeps(rootJson, true);
  }
} else {
  let rootJson = await readPackageJson();
  rootDeps = await getDeclaredDeps(rootJson, true);
}

QUEUE.push(...rootDeps);
await traverseGraph();

progress.stop();
printSummary();
