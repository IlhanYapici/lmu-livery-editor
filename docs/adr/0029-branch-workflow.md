# Branch workflow: GitHub Flow with a protected master

**Status:** accepted (2026-11-01)

The repository uses **GitHub Flow**: `master` is always green, and every change goes through a short-lived branch and a pull request. Git Flow (`develop`, `release/*`, `hotfix/*`) adds work without benefit for a project of this size. Releases will be tags on `master`.

- **Public repository.** GitHub refuses branch protection and rulesets on private repositories with the Free plan ("Upgrade to GitHub Pro or make this repository public"). The user chose to make the repository public (2026-11-01), with the **MIT licence**. Before that, the full history was checked: no game content, tokens, keys, real IP addresses or private paths. The author e-mail stays in the commits (user decision). Public repositories also get free GitHub Actions minutes.
- **Ruleset "Protect master"** (default branch, enforcement active, **no bypass actors**): pull request required with 0 approvals (one maintainer cannot approve their own pull request); required status check `windows` from GitHub Actions (integration 15368) on an up-to-date branch; linear history; no force push (`non_fast_forward`); no deletion. A probe push to `master` was refused with `GH013 … Changes must be made through a pull request`.
- **Merge method: rebase only** (merge commits and squash turned off). Commits carry detailed messages that ADRs refer to; a squash would lose them. Branches are deleted after the merge.
- **Branch names** use the commit types: `feat/`, `fix/`, `docs/`, `test/`, `refactor/`, `build/`, `ci/`, `chore/`.
- The branch stays named `master` (user decision).

## Consequences

- Every change, also documentation, needs a pull request and a green CI run (about 2 minutes on Windows).
- A rebase merge rewrites the commit hashes of the branch on `master`: refer to the hashes on `master`, not to the branch hashes.
- To change the rules, an administrator edits the ruleset in the repository settings (or `gh api repos/{owner}/{repo}/rulesets`); there is no bypass for urgent pushes on purpose.
