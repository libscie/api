# @p2pcommons/sdk-js

![npm version](https://img.shields.io/npm/v/@p2pcommons/sdk-js?color=4F2D84)
[![Build Status](https://travis-ci.com/p2pcommons/sdk-js.svg?branch=master)](https://travis-ci.com/p2pcommons/sdk-js)

The base Software Development Kit in JavaScript (`sdk-js`) for a p2p communication infrastructure. More
information on this infrastructure is available in this [conceptual
publication](https://doi.org/10.3390/publications6020021) and this
[technical publication](https://chartgerink.github.io/2018dat-com/)
(note these might have been extended by now).

The specifications for `sdk-js` are available from [`@p2pcommons/specs`](https://github.com/p2pcommons/specs).

:warning: **Work In Progress**

## Install

`npm install @p2pcommons/sdk-js`

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
  // call this method first
  await p2p.ready()

  // create a content module
  await p2p.init({ type: 'content' }) // ~/.p2pcommons/hash/dat.json --> type: content
  // create a profile module
  await p2p.init({ type: 'profile' }) // ~/.p2pcommons/hash/dat.json --> type: profile
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

### ready

> _async_ `ready()`

After creating a new instance the next **required** step is call the ready method. This method will create (if needed) the db and open it.

Returns a promise. Call this method before any other for expected behavior.

### init

> _async_ `init(data: object)`

Creates a new folder for 'content' or 'profile' according to the received `data.type` value.

- `data` object following the [p2pcommons module spec](https://github.com/p2pcommons/specs/blob/master/module.md). The only required field is `type`.

Returns an object containing the **flattened** rawJSON and metadata (**version, lastModified, isWritable**) for the newly created module.

### get

> _async_ `get(hash: string)`

Retrieves raw datJSON item and metadata from the local db.

- hash: represents the key (`url`) to be looked for. It is the buffer archive key `.toString('hex')`

Returns an object with:
- **rawJSON**: flattened datJSON data
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

- type: indicates the module type to retrieve. Allowed values: `profile`, `content`.
- key: represents the module key (`url`) to be looked for. It is the buffer archive key `.toString('hex')`

### publish

> _async_ `publish(contentKey: string or buffer, profileKey: string or buffer)`

Register new content into a profile. The new content is added to the profile's `p2pcommons.contents`.

### unpublish

> _async_ `unpublish(contentKey: string or buffer, profileKey: string or buffer)`

Remove content from a profile.

### delete

> _async_ `delete(key: string or buffer)`

Remove module from local db and seed db. If it was open in memory, its closed. Note: While this will stop the file from being seeded, that does not means that the content won't still be available on the network. This is due to the P2P file sharing dynamics.

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
