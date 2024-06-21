# Dependency Maintainers

(aka `depmain`)

## Who maintains your project?

This tool recurses through your project's `node_modules` and gathers the maintainers, people with publish access on npm, and lists them out with a total of how many projects you use that they have access to.

For example:

```bash
$ npx dependency-maintainers@latest

  Number of maintainers: 333
  Number of packages: 462

┌─────────┬─────────────────────────────┬────────────┐
│ (index) │ NPM Name                    │ # Packages │
├─────────┼─────────────────────────────┼────────────┤
│ 0       │ 'ljharb'                    │ 80         │
│ 1       │ 'sindresorhus'              │ 53         │
│ 2       │ 'nicolo-ribaudo'            │ 32         │
│ 3       │ 'jlhwung'                   │ 31         │
│ 4       │ 'existentialism'            │ 31         │
│ 5       │ 'hzoo'                      │ 31         │
│ 6       │ 'isaacs'                    │ 27         │
│ 7       │ 'gar'                       │ 25         │
│ 8       │ 'fritzy'                    │ 25         │
│ 9       │ 'lukekarrys'                │ 23         │
│ 10      │ 'saquibkhan'                │ 23         │
│ 11      │ 'npm-cli-ops'               │ 23         │
│ 12      │ 'gr2m'                      │ 14         │
│ 13      │ 'octokitbot'                │ 12         │
│ 14      │ 'nickfloyd'                 │ 12         │
│ 15      │ 'kfcampbell'                │ 12         │
│ 16      │ 'rwjblue'                   │ 10         │
│ 17      │ 'types'                     │ 10         │
│ 18      │ 'jonschlinkert'             │ 10         │
...

```
