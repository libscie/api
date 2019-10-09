# Liberate Science API

[![NPM](https://nodei.co/npm/libscie-api.png)](https://npmjs.org/package/libscie-api)

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

## Example

```javascript
const P2PCommons = require('@p2pcommons/sdk-js')

const p2p = P2PCommons()

;(async () => {
  await p2p.init({ type: 'content' }) // ~/.p2pcommons/hash/dat.json --> type: content
  await p2p.init({ type: 'profile' }) // ~/.p2pcommons/hash/dat.json --> type: profile
})()
```

## API

### Init

### Create


