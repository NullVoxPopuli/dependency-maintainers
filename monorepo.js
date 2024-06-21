import { getPackages } from "@manypkg/get-packages";

const CWD = process.cwd();

/**
 * packages[]:
 *  {
 *    dir: string
 *    relativeDir: string
 *    packageJson: {
 *      name: string
 *    }
 *  }
 */
const monorepoInfo = await getPackages(CWD);

export const IN_MONOREPO = new Set(
  monorepoInfo.packages.map((pkg) => pkg.packageJson.name),
);
/**
 * Returns a package.json or undefined
 */
export function getMonorepoPackage(name) {
  let pkg = monorepoInfo.packages.find((pkg) => pkg.packageJson.name === name);

  return pkg?.packageJson;
}
