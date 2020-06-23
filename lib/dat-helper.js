// Note(dk): this file contents should be replaced-by/combine-with dat-sdk in medium-term
const { normalize } = require('path')
const debug = require('debug')('p2pcommons:dathelper')
const assert = require('nanocustomassert')
const pMemoize = require('p-memoize')

const mirror = require('mirror-folder')
const datIgnore = require('dat-ignore')
const Hyperdrive = require('@geut/hyperdrive-promise')
const Corestore = require('corestore')
const Storage = require('universal-dat-storage')
const RAM = require('random-access-memory')
const DatEncoding = require('dat-encoding')
const { ValidationError } = require('./errors')

const DEFAULT_DRIVE_OPTS = {
  sparse: true,
  latest: true
}

const getDriveStorage = async ({
  storageOpts = {},
  corestoreOpts = {},
  storageFn,
  persist = true
} = {}) => {
  debug('Storage options %O', storageOpts)
  const storage = Storage(storageOpts)

  let driveStorage
  if (!persist) {
    driveStorage = new Corestore(RAM)
    await driveStorage.ready()
  } else if (storageFn) {
    // WIP: temp disable
    // driveStorage = storageFn(location)
  } else {
    driveStorage = new Corestore(storage.getCoreStore('.dat'), corestoreOpts)
    await driveStorage.ready()
  }

  return driveStorage
}

// NOTE(dk): this can be used to get or create.
const create = async (store, key = null, opts = {}) => {
  assert(typeof opts === 'object', ValidationError, 'object', opts)

  const finalHyperdriveOpts = { ...DEFAULT_DRIVE_OPTS, ...opts.hyperdrive }

  finalHyperdriveOpts.namespace = DatEncoding.encode(key)

  const drive = Hyperdrive(store, null, finalHyperdriveOpts)
  return drive
}

const importFiles = async (archive, src = './', opts = {}) => {
  assert(typeof archive === 'object', ValidationError, 'object', archive)

  const finalOpts = {
    watch: false,
    dereference: true,
    count: true,
    ...opts
  }

  debug('importFiles opts', finalOpts)
  if (finalOpts.watch || finalOpts.ee) {
    // returns an event emitter
    return mirror(normalize(src), { name: '/', fs: archive }, finalOpts)
  }

  return new Promise((resolve, reject) => {
    mirror(normalize(src), { name: '/', fs: archive }, finalOpts, err => {
      if (err) {
        debug('importFiles:err', err)
        return reject(err)
      }
      debug('importFiles:mirror end successfully')
      return resolve()
    })
  })
}

const downloadFiles = (archive, dst, opts = {}) => {
  assert(typeof archive === 'object', ValidationError, 'object', archive)
  debug('downloadFiles')

  const finalOpts = {
    watch: false,
    dereference: true,
    count: true,
    ...opts
  }

  return mirror({ name: '/', fs: archive }, dst, finalOpts)
}

/**
 * open
 * @description Open a previously created dat archive using its key
 *
 * @param key
 * @param hyperdriveOpts
 * @returns {
 *  drive: an hyperdrive-promise instance,
 *  driveStorage: a storage instance (ie: corestore, random-access-x, etc) DEPRECATED
 * }
 */
const open = (store, key, hyperdriveOpts = {}) => {
  // TODO(dk): check store is required
  assert(
    typeof key === 'string' || Buffer.isBuffer(key),
    ValidationError,
    "'string' or Buffer",
    key
  )
  const finalHyperdriveOpts = { ...DEFAULT_DRIVE_OPTS, ...hyperdriveOpts }
  return Hyperdrive(store, DatEncoding.decode(key), finalHyperdriveOpts)
}

module.exports = {
  create,
  importFiles,
  downloadFiles,
  open,
  getDriveStorage
}
