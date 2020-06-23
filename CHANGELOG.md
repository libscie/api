# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Changed
- renamed (un)publish to (de)register
- renamed dat.json to index.json


## [0.5.8] - 2020-04-01
### Added
- unpublish on delete
- get on set

## [0.5.7] - 2020-03-27
### Added
- new deleteFiles option to delete method #90
- new check of modified times at ready #138
- new contributing doc

### Fixed
- add missing check on main field (publish) #141

## [0.5.6] - 2020-03-18
### Security
- bump acorn dep #137

### Changed
- clone method output module to rawJSON

## [0.5.5] - 2020-03-13
### Changed
- allow empty string on main #133
- replaced parse-dat-url with url-parse

## [0.5.4] - 2020-03-12
### Fixed
- add missing char limit for titles #116
- future parents checks

### Added
- support for avatar and simple path validation #118

### Changed
- added main property validations #121
- inconsistent clone #129

## [0.5.3] - 2020-03-10
### Added
- verify method improvements #97
- update to module specs 0.2.3 #99

### Changed
- make parents dat url validation strict #96
- refactor set method so follow and publish calls pass through it
- switch to GitHub actions for CI #114

### Fixed
- leveldb open errors ignored #112

## 0.5.2 - 2020-02-28
### Added
- new changelog file
- use latest corestore-swarm-networking

### Changed
- ready method call is now implicit
- extra params now throw validationError

[Unreleased]: https://github.com/p2pcommons/sdk-js/compare/v0.5.8...HEAD
[0.5.8]: https://github.com/p2pcommons/sdk-js/compare/v0.5.7...v0.5.8
[0.5.7]: https://github.com/p2pcommons/sdk-js/compare/v0.5.6...v0.5.7
[0.5.6]: https://github.com/p2pcommons/sdk-js/compare/v0.5.5...v0.5.6
[0.5.5]: https://github.com/p2pcommons/sdk-js/compare/v0.5.4...v0.5.5
[0.5.4]: https://github.com/p2pcommons/sdk-js/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/p2pcommons/sdk-js/compare/v0.5.2...v0.5.3
