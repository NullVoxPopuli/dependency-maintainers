import path from "node:path";
import fs from "node:fs/promises";
import process from "node:process";
import { execa } from "execa";

const CWD = process.cwd();

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
  try {
    let { stdout } = await execa`npm info ${name} --json`;

    return JSON.parse(stdout);
  } catch (e) {
    if (typeof e === "object" && e !== null) {
      if ("message" in e) {
        if (e.message.includes("code E404")) {
          NOT_FOUND.add(name);

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
  while (QUEUE.length > 0) {
    let depName = QUEUE.pop();

    if (SEEN_DEPS.has(depName)) {
      continue;
    }

    let info = await getPackageInfo(depName);

    if (!info) {
      SEEN_DEPS.add(depName);
      continue;
    }

    updateMaintainers(info);

    SEEN_DEPS.add(depName);

    let subDeps = await getDeclaredDeps(info);

    QUEUE.push(...subDeps);
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

console.table(tableData);

if (NOT_FOUND.size > 0) {
  console.info("The following packages could not be found and were skipped");
  console.log(NOT_FOUND);
}
