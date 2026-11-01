# LMU Livery Editor

[![CI](https://github.com/IlhanYapici/lmu-livery-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/IlhanYapici/lmu-livery-editor/actions/workflows/ci.yml)

A Windows app to make car liveries for Le Mans Ultimate (LMU). It reads the livery templates of your game install, lets you paint over them in 2D, and writes the two livery files into the game.

## Installation

1. Open the [latest release](https://github.com/IlhanYapici/lmu-livery-editor/releases/latest).
2. Download `LMU-Livery-Editor-Setup-<version>.exe` and run it. The installer needs no administrator rights: it installs the app for your Windows user only.
3. The installer is not signed yet. Windows SmartScreen can show "Windows protected your PC". Click **More info**, then **Run anyway**.

The app installs updates automatically: it downloads a new version in the background, then asks you to restart, or installs it when you quit.

## Usage

1. Start the app. It finds the game in your Steam libraries. If it does not, select the install folder of the game (for example `…\steamapps\common\Le Mans Ultimate`).
2. Select a category, a car and a variant, then click **Continue**.
3. Add fills, shapes, text and images. Give each layer a region (see below).
4. Click **Export**. The app writes the two files into `UserData\Liveries` of the game, after a backup of the old files.
5. In the game, open the showroom of the car and click **RELOAD**.

Save your work as a project (`.lmulivery`) to edit it again later.

## How LMU liveries work

The game gives one template (PSD file) per car in `…/Le Mans Ultimate/support/LiveryTemplates/`. Do not change the number plate layers or the base carbon layers of a template.

A livery has two uncompressed TGA files (no RLE compression), in `…/Le Mans Ultimate/UserData/Liveries/`:

1. `customskin.tga`: the paint of the car, without the guide layers (wireframe, mask).
2. `customskin_region.tga`: the region map. Each colour sets the material of that area:

| Colour | Region in the app | Material                               |
| ------ | ----------------- | -------------------------------------- |
| Black  | Base              | Base paint (metallic, flake)           |
| Red    | Carbon            | Carbon finish                          |
| Green  | Option 1          | Chrome, sticker or vinyl finish        |
| Blue   | Option 2          | Chrome, sticker or vinyl finish        |
| White  | Stickers          | Logos, stickers and race number plates |

The app writes both files for you.

## Online use

To show your livery in online races, you must create or join a team as the team leader in the Team Hub. A RaceControl Pro or Pro+ subscription is necessary to upload the livery and assign it to your lineup. These rules come from the game, not from this app: read the official guide, [How to create, upload and manage custom liveries in Le Mans Ultimate](https://guide.lemansultimate.com/hc/en-gb/articles/13211180344719-How-to-Create-Upload-and-Manage-custom-liveries-in-Le-Mans-Ultimate).

## Notice

This app is not made or approved by Motorsport Games, Studio 397 or the ACO. Le Mans Ultimate is a trademark of its owners. The app contains no game content: it reads the templates of your own game install.

## Development

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [architecture decision records](docs/adr/README.md).

## Licence

[MIT](LICENSE)
