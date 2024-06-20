import path from "node:path";
import fs from "node:fs/promises";

const CWD = process.cwd();

export async function readPackageJson() {
  let packageJson = path.join(CWD, "package.json");
  let content = await fs.readFile(packageJson);

  return JSON.parse(content);
}

export async function getDeclaredDeps(json, includeDev = false) {
  let deps = [
    ...Object.keys(json.dependencies || {}),
    ...Object.keys(json.peerDependencies || {}),
  ];

  if (includeDev) {
    deps.push(...Object.keys(json.devDependencies || {}));
  }

  return deps;
}
