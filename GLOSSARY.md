# LMU Livery Editor

A desktop editor for custom liveries of the game Le Mans Ultimate. It reads the livery templates of the game install and writes the two files that the game reads.

## Catalogue

**Category**:
A racing class as the app shows it: Hypercar, LMP2, LMP3, LMGT3, LMGTE. The **class code** is the token in the template file name (`HYPER`, `LMP2`, `LMP3`, `GT3`, `GTE`).
_Avoid_: class (except for the class code)

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
