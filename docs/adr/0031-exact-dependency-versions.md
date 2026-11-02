# Exact dependency versions, a minimum release age and Dependabot

**Status:** accepted (2026-11-02)

The lockfile already fixed every installed version for `npm ci` (CI and releases). But `package.json` had `^` ranges, so `npm install` and `npm update` could move to a newer version without a decision, and the GitHub Actions used tags that their owners can move.

- **Exact versions** in `package.json` for the direct dependencies, and `save-exact=true` in `.npmrc` for the next ones. An upgrade is always a visible change in a pull request. The dependencies of dependencies stay fixed by `package-lock.json` only.
- **Minimum release age: 3 days** (`min-release-age=3` in `.npmrc`). npm installs only versions published more than 3 days ago: a bad or hijacked release is often found and removed in that time. It needs npm 11.10 or newer; npm 10 ignores it without a warning. Checked with npm 11.20.0: an exact version 2.7 days old fails with `ETARGET`; a range resolves to the newest version older than 3 days. `npm ci` installs the lockfile versions and does not choose versions. To bypass the rule once (urgent fix): `npm install --min-release-age=0 <package>`.
- **Node 26** (`.node-version`), the active LTS, with npm 11.20 (Node 22 has npm 10.9). CI, the Release workflow, fnm and mise read the file; `engines` says `node >=26`, `npm >=11.10`.
- **Install scripts:** npm 11.17+ lists the dependencies whose install scripts nobody reviewed (`allowScripts` in `package.json`; advisory now, blocking in a future npm). The only one, `electron-winstaller` (Squirrel installers), is denied: the project builds NSIS only. Review a new entry with `npm approve-scripts --allow-scripts-pending`, then `npm approve-scripts <package>` or `npm deny-scripts <package>`.
- **GitHub Actions pinned to commit SHAs**, with the version in a comment, as GitHub's security hardening guide recommends. The Release workflow gives an action the maintainer's token and `contents: write`.
- **Dependabot** (`.github/dependabot.yml`), weekly on Monday: npm minor and patch upgrades in one grouped pull request, each major upgrade alone, the actions in one group. `cooldown: default-days: 3` is the same rule as `min-release-age` (Dependabot does not read `.npmrc`); security updates do not wait. Commit prefixes `build` and `ci`: an upgrade makes no release by itself.

## Consequences

- Upgrades come from Dependabot pull requests, with a green CI run like any change. Without them, the versions never change.
- A dependency upgrade reaches users with the next `feat` or `fix` release. For an urgent security upgrade, release it with a `fix` commit or a `Release-As` footer.
- Every developer needs Node 26 (npm 11.10+), else the age rule does nothing on their PC.
