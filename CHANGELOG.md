# Changelog

## [0.5.0](https://github.com/IlhanYapici/lmu-livery-editor/compare/v0.4.0...v0.5.0) (2026-11-06)


### Features

* **editor:** gradient controls in the properties panel ([d041e16](https://github.com/IlhanYapici/lmu-livery-editor/commit/d041e167c32835366046d5ff37458ef6c37ce15d))
* **editor:** gradient fills in the document and the export ([3db9529](https://github.com/IlhanYapici/lmu-livery-editor/commit/3db9529367ee907a8aaabd675913fdb806a90519))

## [0.4.0](https://github.com/IlhanYapici/lmu-livery-editor/compare/v0.3.0...v0.4.0) (2026-11-04)


### Features

* **ui:** What's new window after an update, and its history in About ([cf0186d](https://github.com/IlhanYapici/lmu-livery-editor/commit/cf0186d22e5cfd19479685efa7d0fd6eb68e3191))

## [0.3.0](https://github.com/IlhanYapici/lmu-livery-editor/compare/v0.2.1...v0.3.0) (2026-11-03)


### Features

* **ui:** fade and scale animations for dialogs, menus, tooltips and the update banner ([37a89b3](https://github.com/IlhanYapici/lmu-livery-editor/commit/37a89b3e518407cd93832f1b33f530d56826ce7c))
* **ui:** spinner on Save and Open project while the work runs ([c64ccd5](https://github.com/IlhanYapici/lmu-livery-editor/commit/c64ccd50777e35437cebd1260499ea66155f7bf8))


### Bug Fixes

* **main:** less noise in the updater log ([798822c](https://github.com/IlhanYapici/lmu-livery-editor/commit/798822cf9e299e3fd682be8ce2c82f1b1bb9680d))

## [0.2.1](https://github.com/IlhanYapici/lmu-livery-editor/compare/v0.2.0...v0.2.1) (2026-11-01)


### Bug Fixes

* **ui:** show "Exporting the livery…" during an export ([f7856a1](https://github.com/IlhanYapici/lmu-livery-editor/commit/f7856a1e64c6150186ce93e7d11fc690e9975158))

## [0.2.0](https://github.com/IlhanYapici/lmu-livery-editor/compare/v0.1.1...v0.2.0) (2026-11-01)


### Features

* **main:** write the updater messages to a log file ([522952f](https://github.com/IlhanYapici/lmu-livery-editor/commit/522952fdccbabc515a7f6889a1c90617f556206f))


### Bug Fixes

* **main:** load electron-updater with a static import ([3e566c6](https://github.com/IlhanYapici/lmu-livery-editor/commit/3e566c6d51db951d830268b8d0faf768b984ad8f))
* **main:** show the update banner also when the download ends before the window is ready ([5be4107](https://github.com/IlhanYapici/lmu-livery-editor/commit/5be4107bfa902e82dbc3f1c6e8b68817d73f369e))

## [0.1.1](https://github.com/IlhanYapici/lmu-livery-editor/compare/v0.1.0...v0.1.1) (2026-11-01)


### Bug Fixes

* **main:** forget "Restart now" when the save before close does not complete ([75d9d5d](https://github.com/IlhanYapici/lmu-livery-editor/commit/75d9d5d643b2deb9393d3038cbe05f0e0bc185bf))

## 0.1.0 (2026-11-01)


### Features

* automatic updates from GitHub releases ([0c9898c](https://github.com/IlhanYapici/lmu-livery-editor/commit/0c9898ca1639d7f6a3cd37fa4b3ae9d20efe4bfa))
* build the template catalogue from file names ([69403a3](https://github.com/IlhanYapici/lmu-livery-editor/commit/69403a3793f8d900f46bc4fdd8a5cda57b0e306d))
* **editor:** image layers (import, drag and drop, paste) ([b572d99](https://github.com/IlhanYapici/lmu-livery-editor/commit/b572d9975477be35c151b86d68281cd874e283b0))
* **editor:** template canvas with guides, segments and movable insertion point ([1c11cff](https://github.com/IlhanYapici/lmu-livery-editor/commit/1c11cffe12e72663ef3d71f31258948a60f01afd))
* **editor:** user layers, undo history and exact background preview ([47e4fa6](https://github.com/IlhanYapici/lmu-livery-editor/commit/47e4fa6fdfe4fd4fc52de45e3b361ed8de75e930))
* **editor:** warning icon for enlarged raster images ([5a40022](https://github.com/IlhanYapici/lmu-livery-editor/commit/5a40022dc8b4f383a598f601f186ed849598e2d4))
* **export:** write customskin.tga and customskin_region.tga ([e9fcd9d](https://github.com/IlhanYapici/lmu-livery-editor/commit/e9fcd9d0bb93718ee69610af82ba50ed92ef4e2d))
* **i18n:** English and French UI with i18next ([7171408](https://github.com/IlhanYapici/lmu-livery-editor/commit/717140887e999d4a5e31f333fb5cdac68de01d12))
* **main:** add Valve KeyValues (.vdf) parser ([465a8d9](https://github.com/IlhanYapici/lmu-livery-editor/commit/465a8d9d548c1ae7ce30ceb3fb553d4ee930f6cd))
* **main:** locate the Le Mans Ultimate install ([bdb6a19](https://github.com/IlhanYapici/lmu-livery-editor/commit/bdb6a190481ad38f2a87414cf5a5b41b153c60df))
* **project:** format version 2 with embedded image assets ([97ba953](https://github.com/IlhanYapici/lmu-livery-editor/commit/97ba953fe5ee8e299df362201ddda27f8c3e6558))
* **project:** save and open livery projects, protect unsaved changes ([4a06681](https://github.com/IlhanYapici/lmu-livery-editor/commit/4a0668129b50bc83b4375f337dae57487ad90de4))
* **psd:** template compositor, guide detection and template audit ([ce13c69](https://github.com/IlhanYapici/lmu-livery-editor/commit/ce13c69fd824df9b04f850b23d67800db812bed2))
* **ui:** game-style UI shell with Radix and design tokens ([0ffe6ea](https://github.com/IlhanYapici/lmu-livery-editor/commit/0ffe6ea07c90be403d8f4fd6db93152730966dfc))
* wire game detection into the Electron app ([8e10ed2](https://github.com/IlhanYapici/lmu-livery-editor/commit/8e10ed2f5d8eef929d2be131a8ec9024d82b2dd0))


### Bug Fixes

* **ui:** keep tile rows at a fixed height when the scroll bar appears ([d8e394d](https://github.com/IlhanYapici/lmu-livery-editor/commit/d8e394d7a52eed308fe3f257a52fa24baa5f7ea0))
* **ui:** show the selected tool in the canvas toolbar ([d3a8898](https://github.com/IlhanYapici/lmu-livery-editor/commit/d3a889877bc659f002a79302b9631f5de97d1974))


### Performance Improvements

* **psd:** use decoded layer pixels in place instead of copying them ([3ac545a](https://github.com/IlhanYapici/lmu-livery-editor/commit/3ac545a979732d910dd514d427979cdc7b34aa25))
