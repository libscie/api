// Note(dk): this file contents should be replaced-by/combine-with dat-sdk in medium-term
const assert = require('assert')
const debug = require('debug')('p2pcommons')
const Hyperdrive = require('@geut/hyperdrive-promise')
const corestore = require('corestore')
const Storage = require('universal-dat-storage')
const RAM = require('random-access-memory')

const DEFAULT_DRIVE_OPTS = {
  sparse: true,
  latest: false
}

const create = (location, opts = {}) => {
  assert.ok(location, 'directory or storage required')
  assert.strictEqual(typeof opts, 'object', 'opts should be type object')
  debug('DatHelper:constructor location', location)
  debug('DatHelper:constructor opts', opts)
  const storage = Storage(Object.assign({}, opts.storageOpts))
  const key = null
  const hOpts = Object.assign(DEFAULT_DRIVE_OPTS, opts.hyperdrive)

  let driveStorage

  if (!opts.persist) {
    driveStorage = RAM
  } else if (opts.storageFn) {
    driveStorage = opts.storageFn(location)
  } else {
    driveStorage = corestore(
      storage.getCoreStore(`cores-${location}`),
      opts.corestoreOpts
    )
  }

  debug('DatHelper: driveStorage', driveStorage)
  return Hyperdrive(driveStorage, key, hOpts)
}

const open = (location, opts = {}) => {
  // NOTE(dk): location can be a path or a dat url
  assert.ok(location, 'location is required')
  return Hyperdrive(location, opts)
}

module.exports = {
  create,
  open
}
