# Game detection order

**Status:** accepted (2026-10-30)

`src/main/steam.ts` finds the game folder in this order. The first candidate that contains `support/LiveryTemplates` (any letter case) wins:

1. The uninstall key `HKLM\…\Uninstall\Steam App 2399420` → `InstallLocation`. It gives the game folder directly.
2. Steam roots: `HKCU\Software\Valve\Steam\SteamPath`, then `HKLM\SOFTWARE\WOW6432Node\Valve\Steam\InstallPath`, then the Program Files defaults.
3. `steamapps/libraryfolders.vdf` of each root. The libraries whose `apps` list has 2399420 come first.
4. `steamapps/appmanifest_2399420.acf` → `installdir`. The default `Le Mans Ultimate` is used only if this file is missing.

If nothing is found, the user selects the folder. The settings file (`%APPDATA%/lmu-livery-editor/settings.json`) keeps the result.

All file and registry access goes through the `Host` interface. The tests use an in-memory Windows file system with the values of a real install (Steam on `C:`, the game on `E:\SteamLibrary`).

## Consequences

`reg query` gives `SteamPath` with forward slashes and in lowercase (`c:/program files (x86)/steam`), and with CRLF line ends. `Host.join` normalises the paths, and the comparisons ignore case.
