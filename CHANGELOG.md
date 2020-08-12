# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Location of keys is now `~/.p2pcommons/.hyperdrive` instead of `~/.p2pcommons/.dat` 

### Fixed
- listProfiles() only returned writable profiles
- Improve formatting #207

### Changed
- Bump module specification version to `0.9.3`

## [0.7.0] - 2020-07-29
### Added
- Full and partial metadata validations #154
- TypeError to replace old ValidationErrors #154

### Changed
- Remove hyper:// protocol from p2pcommons keys #179
- ValidationError parameters to fit with new validations #154
- Improved readability of some parts of the readme
- bump lodash from 4.17.15 to 4.17.19
- Eagerly call networker listen, remove await from swarm.join call #193

### Fixed
- Always cast version to Number
- deregister specific content #198
- refreshMtimes: only call importFiles with writable drives + new test.

## [0.6.3] - 2020-07-14
### Changed
- rename dat:// to hyper:// #169
- pretty print JSON write-out #183
- SDK now emits EBUSY error as a warn event #185

### Fixed
- Use module property for spec #182

## [0.6.2] - 2020-07-08
### Added
- New Error: EBUSYError #177

### Changed
- Dynamic p2pcommons URLs #178

## [0.6.1] - 2020-07-07
### Fixed
- loading issue
- broken links #170
- check closing status before close drive on destroy #175

## [0.6.0] - 2020-06-30
### Changed
- renamed (un)publish to (de)register
- renamed dat.json to index.json
- bump hypercore-crypto dep to version 2

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

[Unreleased]: https://github.com/p2pcommons/sdk-js/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/p2pcommons/sdk-js/compare/v0.6.3...v0.7.0
[0.6.3]: https://github.com/p2pcommons/sdk-js/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/p2pcommons/sdk-js/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/p2pcommons/sdk-js/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/p2pcommons/sdk-js/compare/v0.5.8...v0.6.0
[0.5.8]: https://github.com/p2pcommons/sdk-js/compare/v0.5.7...v0.5.8
[0.5.7]: https://github.com/p2pcommons/sdk-js/compare/v0.5.6...v0.5.7
[0.5.6]: https://github.com/p2pcommons/sdk-js/compare/v0.5.5...v0.5.6
[0.5.5]: https://github.com/p2pcommons/sdk-js/compare/v0.5.4...v0.5.5
[0.5.4]: https://github.com/p2pcommons/sdk-js/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/p2pcommons/sdk-js/compare/v0.5.2...v0.5.3
