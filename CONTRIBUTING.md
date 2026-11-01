# Contributing

The project follows GitHub Flow ([ADR-0029](docs/adr/0029-branch-workflow.md)). Read [docs/adr/README.md](docs/adr/README.md) first: it explains the decisions and gives the quick start commands. The words of the project are in [GLOSSARY.md](GLOSSARY.md).

## Branches

- `master` is always green and ready to release. Nobody pushes to it directly: GitHub refuses it.
- Make each change on a short-lived branch from `master`. Name it with the commit type and a short topic:
  `feat/…`, `fix/…`, `docs/…`, `test/…`, `refactor/…`, `build/…`, `ci/…`, `chore/…`.
  Examples: `feat/layer-copy-paste`, `fix/tool-highlight`.
- Keep a branch small: one feature or one fix. Delete it after the merge (GitHub does it).

## Commits

- One topic per commit. The first line has the form `type(scope): summary`, for example `fix(ui): show the selected tool`.
- The body explains what changed and why, with the measurements or the checks. ADRs refer to commits.
- Do not add `Co-Authored-By` lines.
- The pre-commit hook (`.githooks/pre-commit`, installed by `npm install`) refuses a commit that is not formatted, has lint errors or type errors. Run `npm run check` before you push: it also runs the tests.

## Pull requests

1. Push the branch and open a pull request to `master`.
2. Describe the change with the sections **Summary**, **Evidence** (before and after: test output, screenshots) and **Merge Danger** (one-way or two-way door, blast radius).
3. Wait until the CI check `windows` is green. The branch must be up to date with `master`: rebase it if GitHub asks.
4. Merge with **Rebase and merge** (the only method that the repository allows). The history stays linear, and each detailed commit stays.

## Repository rules on `master`

A ruleset that nobody can bypass, also not the administrators:

- pull request required (no approval required: the project has one maintainer);
- the CI check `windows` must pass, on a branch that is up to date;
- linear history; no force push; no deletion.

## Releases

Releases come from the commits on `master` ([ADR-0030](docs/adr/0030-distribution-and-updates.md)). Nobody writes a version number by hand.

1. The commit types set the next version: `feat` raises the minor version, `fix` and `perf` the patch version. Other types (`build`, `ci`, `docs`, `test`, `refactor`, `style`, `chore`) make no release and do not go into the changelog.
2. After each merge, release-please updates the pull request "chore(master): release X.Y.Z" (version in `package.json`, `CHANGELOG.md`).
3. To release, merge that pull request when its CI check is green. The workflow `Release` makes the tag `vX.Y.Z` and the GitHub release, then builds the installer on Windows and uploads it with `latest.yml`. The installed apps find the update.

Do not make `v*` tags by hand.

## Licence

By contributing, you agree that your contribution uses the [MIT licence](LICENSE) of the project. Do not add game content (templates, liveries, car meshes, logos of the game): see [ADR-0002](docs/adr/0002-no-game-content-in-app-or-repo.md).
