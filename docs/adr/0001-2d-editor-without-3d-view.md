# 2D editor without a 3D view

**Status:** accepted (2026-10-29)

The app is a 2D editor on the UV layout of the template. It has no 3D view of the car. To make a 3D view, the app needs the car mesh with the same UVs as the template. The game keeps its meshes in `car.mas` files, and these files are encrypted: MAS2Extract opens only `car-upgrade.mas`. A mesh from a 3D model shop does not have the game UVs. Livery Lab, another livery editor, has no 3D view for the same reason.

The user checks the livery in the in-game showroom (button RELOAD).

## Considered options

- A user-supplied mesh (`.glb`) with game UVs. Rejected: nobody can get such a mesh legally.
- Extraction of the game meshes. Rejected: encrypted, and a licence risk (Ferrari, Porsche, … content).

## Consequences

Do not add Three.js or a mesh loader without a new ADR that replaces this one.
