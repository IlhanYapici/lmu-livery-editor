# Windows only

**Status:** accepted (2026-10-30)

Le Mans Ultimate is a Windows game (Steam App 2399420). Most players use Windows. Linux players use Proton, and they are a small group. The app targets Windows only: automatic game detection runs only on Windows ([ADR-0006](0006-game-detection-order.md)), and the release build is a Windows x64 build.

## Consequences

- On Linux or macOS, the app starts, but the user must select the game folder manually. Developers on Linux work this way.
- Code that touches Windows paths uses `path.win32` behind the `Host` interface, so tests run on Linux.
