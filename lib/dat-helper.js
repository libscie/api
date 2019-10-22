// Note(dk): this file contents should be replaced-by/combine-with dat-sdk in medium-term
const assert = require('assert')
const { normalize } = require('path')
const debug = require('debug')('p2pcommons:dathelper')
const mirror = require('mirror-folder')
const Hyperdrive = require('@geut/hyperdrive-promise')
const corestore = require('corestore')
const Storage = require('universal-dat-storage')
const RAM = require('random-access-memory')

const DEFAULT_DRIVE_OPTS = {
  sparse: true,
  latest: false
}

const create = (location, key = null, opts = {}) => {
  assert.ok(location, 'directory or storage required')
  assert.strictEqual(typeof opts, 'object', 'opts should be type object')
  debug('DatHelper:constructor location', location)
  debug('DatHelper:constructor opts', opts)
  const storage = Storage(Object.assign({}, opts.storageOpts))
  const hOpts = Object.assign(DEFAULT_DRIVE_OPTS, opts.hyperdrive)

  let driveStorage

  if (!opts.persist) {
    driveStorage = RAM
  } else if (opts.storageFn) {
    driveStorage = opts.storageFn(location)
  } else {
    driveStorage = corestore(storage.getCoreStore('.dat'), opts.corestoreOpts)
  }

  debug('DatHelper: driveStorage', driveStorage)
  const drive = Hyperdrive(driveStorage, key, hOpts)

  return drive
}

const importFiles = async (archive, src = './', opts = {}) => {
  assert.ok(archive, 'archive is required')
  const equals = (src, dst, cb) => {
    // Note(dk): this is necessary because latest hyperdrive is using Hyperdrive-schemas
    // which already resolves the getTime on the mtime value.
    if (!src.stat.isDirectory() && src.stat.size !== dst.stat.size) {
      return cb(null, false)
    }
    if (src.stat.mtime.getTime() > dst.stat.mtime) return cb(null, false)
    cb(null, true)
  }
  const finalOpts = {
    watch: false,
    dereference: true,
    count: true,
    equals,
    ...opts
  }

  if (finalOpts.watch || finalOpts.ee) {
    // returns an event emitter
    return mirror(normalize(src), { name: '/', fs: archive }, finalOpts)
  }
  return new Promise((resolve, reject) => {
    // NOTE(dk): this can be/feel slow if content is big.
    mirror(
      normalize(src),
      { name: '/', fs: archive },
      finalOpts,
      (err, data) => {
        if (err) return reject(err)
        resolve(data)
      }
    )
  })
}

const open = (location, opts = {}) => {
  // NOTE(dk): location can be a path or a dat url
  assert.ok(location, 'location is required')
  return Hyperdrive(location, opts)
}

module.exports = {
  create,
  importFiles,
  open
}
