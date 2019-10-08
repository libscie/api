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
outside of it. If you are looking for a Command Line Interface (CLI),
[we got you covered](https://github.com/libscie/cli).

## Example

```javascript
const libsdk = require('@p2pcommons/sdk-js')({}) // liberate science constructor function

;(async () => {
  await libsdk.init({ type: 'content' }) // ~/.p2pcommons/hash/dat.json --> type: content
  await libsdk.init({ type: 'profile' }) // ~/.p2pcommons/hash/dat.json --> type: profile
})()
```

## API

### Init

### Create


