# Windows test build from Linux, deployed over SSH

**Status:** accepted (2026-10-30)

The team develops on Linux, and the game runs on a Windows PC. `npm run dist:win` makes an unpacked Windows build (`electron-builder`, target `dir`, x64). It does not need Wine because `signAndEditExecutable` is false: the test `.exe` keeps the default Electron icon and file details. `npm run deploy:win` (with `LMU_WIN_HOST=user@host`) zips the build, copies it with `scp` to the Desktop of the Windows PC, and unpacks it there.

## Consequences

- The Windows PC needs the OpenSSH server and key login. If the Windows account is an administrator, `sshd` reads only `C:\ProgramData\ssh\administrators_authorized_keys` (write it from an elevated PowerShell; on a French Windows, give rights with the SIDs `*S-1-5-32-544` and `*S-1-5-18`).
- An SSH session has no desktop. The user must start the app by hand; scripts can run headless with `ELECTRON_RUN_AS_NODE=1`.
- A release build needs an installer target, an icon and code signing. This is a later decision.
