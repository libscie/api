# @p2pcommons/sdk-js
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-3-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->
![npm version](https://img.shields.io/npm/v/@p2pcommons/sdk-js?color=4F2D84)
![ci](https://github.com/p2pcommons/sdk-js/workflows/ci/badge.svg)

NodeJS development kit (`sdk-js`) for the peer-to-peer commons (p2pcommons). More
information on this infrastructure is available in this [conceptual
publication](https://doi.org/10.3390/publications6020021) and this
[technical publication](https://chartgerink.github.io/2018dat-com/)
(note these might have been extended by now).

The specifications for `sdk-js` are available from [`@p2pcommons/specs`](https://github.com/p2pcommons/specs).

:warning: **Work In Progress**

## Install

```
npm install @p2pcommons/sdk-js
```

## Usage

This is an `npm` module that does not export any processes to your
global environment. In other words, it is a module that you can use in
your NodeJS packages, but does not provide any direct functionality
outside of it.

### Example

```javascript
const P2PCommons = require('@p2pcommons/sdk-js')

const p2p = new P2PCommons()

;(async () => {

  // create a content module
  await p2p.init({ type: 'content' }) // ~/.p2pcommons/hash/index.json --> type: content
  // create a profile module
  await p2p.init({ type: 'profile' }) // ~/.p2pcommons/hash/index.json --> type: profile
})()
```

## API

`const P2PCommons = require('@p2pcommons/sdk-js')`

### constructor

> `P2PCommons(opts)`

Returns a new instance of the sdk.

- `opts` can include the following:
```javascript
{
  baseDir: // defaults to '~/.p2pcommons'
  persist: // Indicates if the drives should be persisted - defaults to true
  storage: // Accepts a storage function - defaults to undefined
  disableSwarm: // defaults to undefined
  swarm: // swarm options - defaults to undefined
}
```

### init

> _async_ `init(data: object)`

Creates a new folder for 'content' or 'profile' according to the received `data.type` value.

- `data` object following the [p2pcommons module spec](https://github.com/p2pcommons/specs/blob/main/module.md). The only required field is `type`.

Returns an object containing the **flattened** rawJSON and metadata (**version, lastModified, isWritable**) for the newly created module.

### get

> _async_ `get(hash: string)`

Retrieves raw indexJSON item and metadata from the local db.

- hash: represents the key (`url`) to be looked for. It is the buffer archive key `.toString('hex')`

Returns an object with:
- **rawJSON**: flattened indexJSON data
- **metadata**: Extra information like last modified time, latest archive version, etc

### set

> _async_ `set(metadata: object)`

Used to update a previously retrieved value.

- metadata: it is an object with the updated values. The only required field is the `url` property, which is used as the object key.

### filter

> _async_ `filter(feature: string, criteria: string)`

Handy method for querying **content** values from the local db.

Returns a promise which can resolve to an array of 0 or more values (flattened rawJSON data) together with their metadata.

- feature: indicates the filter property, e.g.: filter by `title` or `description` (currently supported filter types)
- criteria: it is the filter value.

### listContent

> _async_ `listContent()`

Returns an array containing all the `content` modules (flattened rawJSON data) together with metadata saved in the local db.

### listProfiles

> _async_ `listProfiles()`

Returns an array containing all the `profile` modules (flattened rawJSON data) together with metadata saved in the local db.

### list

> _async_ `list()`

Returns an array containing all the modules (flattened rawJSON data) and metadata saved in the local db.

### openFile

> _async_ `openFile(key: string)`

Used to obtain a file descriptor from the `main` file of a module.

- key: represents the module key (`url`) to be looked for. It is the buffer archive key `.toString('hex')`

### register

> _async_ `register(contentKey: string or buffer, profileKey: string or buffer)`

Register (add) new content into a profile. The new content is added to the profile's `p2pcommons.contents`.

### deregister

> _async_ `deregister(contentKey: string or buffer, profileKey: string or buffer)`

Deregister (remove) content from a profile.

### follow

> _async_ `follow(localProfile: string or buffer, targetProfile: string or buffer)`

Get a local profile and updates its follows property adding a new profile (targetProfile)

### unfollow

> _async_ `unfollow(localProfile: string or buffer, targetProfile: string or buffer)`

Undo the follow operation.

### clone

> _async_ `clone(mKey: string or buffer, mVersion: number, download: boolean)`

Get a module from the local db or the swarm. If the module is not present on the local db and the swarm is enabled (`disableSwarm === false`) then it will query the swarm.

- mKey: module url
- mVersion: module version. [OPTIONAL]
- download: a boolean indicating if module directory needs to be saved on disk. [DEFAULT=TRUE]

Returns a [cancelable promise](https://github.com/sindresorhus/p-cancelable). When fullfiled returns an object with multiple values:
- **rawJSON**: the module `index.json` content (**flattened**)
- **metadata**: an object with modules metadata
- **versionedKey**: an string indicating the full module url obtained. E.g: `hyper://${mKey}+${version}`
- **dwldHandle**: it contains a download event emitter, you can listen to `end` event to know when the download has been completed. It's defined only if `download === true`.


### delete

> _async_ `delete(key: string or buffer, deleteFiles: boolean)`

Remove module from local db and seed db. If it was open in memory, its closed. Note: While this will stop the file from being seeded, that does not means that the content won't still be available on the network. This is due to the P2P file sharing dynamics.

If `deleteFiles` option is true, then the target folder will be moved to the trash bin.

### destroy

> _async_ `destroy()`

Closes the swarm instance (if created) and the local db.

## Errors

The SDK exports some custom errors: `SDK.errors`

### ValidationError

Indicates there is a difference between what is expected and what was received.

Error object contains some useful properties:
- `expected`: Expected value
- `received`: Received value
- `key`: A string indicating the property in question

### InvalidKeyError

Some keys are _read only_. This error indicates the user is trying to modify a read only property.

Error object contains some useful properties:
- `invalid`: A string indicating the invalid property

### MissingParam

A more general error, used to indicate if something is missing.

Error object contains some useful properties:
- `key`: A string indicating the missing param

### EBUSYError

Triggered usually when there are conflicts with other apps watching the FS.

Error object contains some useful properties:
- `description`: A string indicating the error message
- `key`: A string indicating the hyperdrive involved

## Release

1. create a new branch like `{username}/release-{nextVersion}`
2. `npm version {nextVersion}`
    - this will prompt you with a new gh release window, you can mark it as _draft_ until PR is accepted.
3. _acceptance_ & _merge_
4. `git co main`
5. `git pull`
6. `npm publish`
7. :tada:

Requirements:
- 2FA enabled
- signed git tags (`npm config set sign-git-tag true`)

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="http://dpaez.github.io/"><img src="https://avatars0.githubusercontent.com/u/837500?v=4" width="100px;" alt=""/><br /><sub><b>Diego</b></sub></a><br /><a href="https://github.com/p2pcommons/sdk-js/commits?author=dpaez" title="Code">💻</a> <a href="https://github.com/p2pcommons/sdk-js/commits?author=dpaez" title="Documentation">📖</a> <a href="#ideas-dpaez" title="Ideas, Planning, & Feedback">🤔</a> <a href="#infra-dpaez" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
    <td align="center"><a href="http://twitter.com/juliangruber/"><img src="https://avatars2.githubusercontent.com/u/10247?v=4" width="100px;" alt=""/><br /><sub><b>Julian Gruber</b></sub></a><br /><a href="#ideas-juliangruber" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/p2pcommons/sdk-js/pulls?q=is%3Apr+reviewed-by%3Ajuliangruber" title="Reviewed Pull Requests">👀</a> <a href="https://github.com/p2pcommons/sdk-js/commits?author=juliangruber" title="Tests">⚠️</a> <a href="https://github.com/p2pcommons/sdk-js/issues?q=author%3Ajuliangruber" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/jameslibscie"><img src="https://avatars2.githubusercontent.com/u/59870484?v=4" width="100px;" alt=""/><br /><sub><b>James Lomas</b></sub></a><br /><a href="#ideas-jameslibscie" title="Ideas, Planning, & Feedback">🤔</a> <a href="#projectManagement-jameslibscie" title="Project Management">📆</a> <a href="https://github.com/p2pcommons/sdk-js/issues?q=author%3Ajameslibscie" title="Bug reports">🐛</a></td>
  </tr>
</table>

<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome! See also our [contributing guidelines](CONTRIBUTING.md).
