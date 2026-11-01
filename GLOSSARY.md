# LMU Livery Editor

A desktop editor for custom liveries of the game Le Mans Ultimate. It reads the livery templates of the game install and writes the two files that the game reads.

## Catalogue

**Category**:
A racing class of cars. The app shows it with its class name and its class badge, as the game does.
_Avoid_: class (alone)

**Class name**:
The long name of a category, as on the game selection tabs: Hypercar, LMP2, LMP3, LMGT3, LMGTE.

**Class badge**:
The short name of a category on its class colour, as next to a car name in the game showroom: HY, P2, P3, GT3, GTE.

**Class code**:
The token that names the category in a template file name: `HYPER`, `LMP2`, `LMP3`, `GT3`, `GTE`. Users never see it.

**Car**:
One car model in a category, for example Ferrari 296 LMGT3. A car has one or more variants.
_Avoid_: vehicle, model

**Variant**:
One season or series version of a car, for example "2025 ELMS" or "EVO 2026". Each variant has exactly one template. "Base" is the variant without a year or series token.
_Avoid_: version, edition

**Template**:
The PSD file that the game supplies for one variant, in `support/LiveryTemplates`. It is game content.
_Avoid_: PSD, model file

## Template layers

**Content layer**:
A template layer that goes into the skin file: base layer, carbon, number plates, stickers, adjustments.

**Base layer**:
The bottom content layer of a template: the base paint.
_Avoid_: background (some templates name it "Background", but it is not a guide)

**Guide layer**:
A template layer that helps the user but never goes into an export: the wireframe, the mask guide and the region layers.
_Avoid_: helper layer, overlay

**Wireframe**:
The guide layer that shows the UV mesh lines of the car.
_Avoid_: UVW, UV layer, wire

**Mask guide**:
The guide layer that covers the areas of the texture that are not on the car ("Mask(Disable for export)" in the templates).
_Avoid_: mask (alone): it is ambiguous with layer mask

**Layer mask**:
The greyscale mask of one layer that hides parts of that layer.

**Region layer**:
A guide layer of one flat region colour, shaped by its layer mask. A template has five.

**Levels range**:
The output range of the Levels adjustment of a template, for example 10–225. It is different for each car.

## Output

**Skin file**:
`customskin.tga`: the paint of the livery.
_Avoid_: texture, livery file, diffuse

**Region map**:
The image that tells the game which material goes on each pixel. The app writes it as the region file, `customskin_region.tga`.
_Avoid_: material map, region mask

**Region**:
One of the five areas of the region map, named as in the game showroom: Base (black), Carbon (red), Option 1 (green), Option 2 (blue), Stickers (white).
_Avoid_: material (the material is what the player selects for a region in the game)

**Showroom**:
The livery screen of the game. The user presses RELOAD there to see the exported files on the car.

## Editor

**User layer**:
A layer that the user adds in the editor: fill, shape or text. It is not in the template.
_Avoid_: custom layer, my layer

**Insertion point**:
The place of the user layers in the template stack, given as the number of template content layers below them. The user can move it, but never above the Levels of the template.

**Template segment**:
The merge of the template content layers below the insertion point ("below") or above it ("above").

**Livery document**:
Everything the user makes for one template: the user layers, the insertion point and the template visibility. A project file saves one livery document.
_Avoid_: project (the project is the file), scene

**Fill layer**:
A user layer of one colour that covers the whole texture.

**Image layer**:
A user layer that shows an imported image (PNG, JPEG, WebP or SVG), for example a sponsor logo.
_Avoid_: picture layer, sticker (a sticker is a region and a template group)

**Asset**:
The bytes of one imported image, kept once in the project file and named by their SHA-256. Image layers refer to assets.

**Fast preview**:
The canvas image made from the template segments, the live user layers and the template Levels as a GPU filter.

**Exact preview**:
The canvas image made by the compositor with the user layers in the template stack. The editor shows it only when the fast preview is not exact for the template.

**Project file**:
A `.lmulivery` file that keeps one livery document and the template it uses.
_Avoid_: save file, livery file (the game reads TGA files, not project files)

**Export**:
Writing the skin file and the region file. "Export" writes them into the game livery slot; "Export to folder" writes them where the user selects.
_Avoid_: save (saving writes the project file)

**Livery slot**:
The one place where the game reads a custom livery: `UserData\Liveries`. It is the same for all cars.

## French terms

The French UI uses the words of the French game UI (ADR-0024).

| English                                            | French                                          |
| -------------------------------------------------- | ----------------------------------------------- |
| Livery                                             | Livrée                                          |
| Region map                                         | Carte de la région                              |
| Region: Base, Carbon, Option 1, Option 2, Stickers | Base, Carbone, Option 1, Option 2, Autocollants |
| Template                                           | Modèle                                          |
| Variant                                            | Variante                                        |
| User layer / Your layers                           | Calque / Vos calques                            |
| Wireframe                                          | Maillage                                        |
| Mask guide                                         | Masque                                          |
| Guide layer                                        | Repère                                          |
| Fill layer                                         | Fond                                            |
| Image layer                                        | Image                                           |
| Export / Export to folder                          | Exporter / Exporter dans un dossier             |
| Project file                                       | Projet (fichier .lmulivery)                     |
| Continue                                           | Poursuivre                                      |
