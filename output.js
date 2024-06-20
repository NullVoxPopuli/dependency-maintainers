export function printSummary({
  MAINTAINERS,
  SEEN_DEPS,
  NOT_FOUND,
  NOT_AUTHORIZED,
  WHO_MAINTAINS,
}) {
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

  if (WHO_MAINTAINS.size > 0) {
    console.info(
      "Could not determine the maintainers of the following packages (these may be private):",
    );
    console.log(WHO_MAINTAINS);
  }
}
