# Liberate Science API

![npm version](https://img.shields.io/npm/v/@p2pcommons/sdk-js?color=4F2D84)
[![Build Status](https://travis-ci.com/p2pcommons/sdk-js.svg?branch=master)](https://travis-ci.com/p2pcommons/sdk-js)

The base API for a p2p scholarly communication infrastructure. More
information on this infrastructure is available in this [conceptual
publication](https://doi.org/10.3390/publications6020021) and this
[technical publication](https://chartgerink.github.io/2018dat-com/)
(note these might have been extended by now).

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

Returns an object containing the metadata for the newly created module.

### get

> _async_ `get(hash: string)`

Retrieves metadata item from the local db.

- hash: represents the key (`url`) to be looked for. It is the buffer archive key `.toString('hex')`

### set

> _async_ `set(metadata: object)`

Used to update a previously retrieved value.

- metadata: it is an object with the updated values. The only required field is the `url` property, which is used as the object key.

### filter

> _async_ `filter(feature: string, criteria: string)`

Handy method for querying **content** values from the local db.

Returns a promise which can resolve to an array of 0 or more values.

- feature: indicates the filter property, e.g.: filter by `title` or `description` (currently supported filter types)
- criteria: it is the filter value.

### listContent

> _async_ `listContent()`

Returns an array containing all the `content` modules saved in the local db.

### listProfiles

> _async_ `listProfiles()`

Returns an array containing all the `profile` modules saved in the local db.

### openFile

> _async_ `openFile(key: string)`

Used to obtain a file descriptor from the `main` file of a module.

- type: indicates the module type to retrieve. Allowed values: `profile`, `content`.
- key: represents the module key (`url`) to be looked for. It is the buffer archive key `.toString('hex')`

### destroy

> _async_ `destroy()`

Closes the swarm instance (if created) and the local db.


