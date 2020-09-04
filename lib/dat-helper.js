// Note(dk): this file contents should be replaced-by/combine-with dat-sdk in medium-term
const { normalize, join } = require('path')
const debug = require('debug')('p2pcommons:dathelper')
const assert = require('nanocustomassert')

const mirror = require('mirror-folder')
const dft = require('diff-file-tree')
const Hyperdrive = require('@geut/hyperdrive-promise')
const Corestore = require('corestore')
const RAM = require('random-access-memory')
const raf = require('random-access-file')
const DatEncoding = require('dat-encoding')
const bytes = require('bytes')
const { TypeError } = require('./errors')

const DEFAULT_DRIVE_OPTS = {
  sparse: true,
  latest: true
}

const DEFAULT_SYNC_OPTS = {
  compareContent: true,
  sizeLimit: {
    maxSize: bytes('5mb'),
    assumeEq: false
  }
}

const getCoreStore = (storageLocation, name) => {
  const location = join(storageLocation, name)
  return file => raf(join(location, file))
}

const getDriveStorage = async ({
  storageOpts = {},
  corestoreOpts = {},
  storageFn,
  persist = true
} = {}) => {
  debug('Storage options %O', storageOpts)

  let driveStorage
  if (!persist) {
    driveStorage = new Corestore(RAM)
    await driveStorage.ready()
  } else if (storageFn) {
    // WIP: temp disable
    // driveStorage = storageFn(location)
  } else {
    driveStorage = new Corestore(
      getCoreStore(storageOpts.storageLocation, '.hyperdrive'),
      corestoreOpts
    )
    await driveStorage.ready()
  }

  return driveStorage
}

// NOTE(dk): this can be used to get or create.
const create = async (store, key = null, opts = {}) => {
  assert(typeof opts === 'object', TypeError, 'object', opts)

  const finalHyperdriveOpts = { ...DEFAULT_DRIVE_OPTS, ...opts.hyperdrive }

  finalHyperdriveOpts.namespace = DatEncoding.encode(key)

  const drive = Hyperdrive(store, null, finalHyperdriveOpts)
  return drive
}

const importFiles = async (archive, src = './', opts = {}) => {
  assert(typeof archive === 'object', TypeError, 'object', archive)

  const finalOpts = {
    watch: false,
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
  assert(typeof archive === 'object', TypeError, 'object', archive)
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
 * sync
 *
 * @description sync your hyperdrive with the fs
 * @param {Object} drive - hyperdrive
 * @param {String} moduleDir - path to module dir
 * @param {Object} [opts] - diff file tree options
 */
const sync = async (drive, moduleDir, opts = {}) => {
  const finalOpts = { ...DEFAULT_SYNC_OPTS, ...opts }
  assert(typeof drive === 'object', TypeError, 'Object', drive)
  assert(typeof moduleDir === 'string', TypeError, 'String', moduleDir)
  const driveFS = { path: '/', fs: drive }
  const diff = await dft.diff(driveFS, moduleDir, finalOpts)
  await dft.applyLeft(driveFS, moduleDir, diff)
  return diff
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
    TypeError,
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
  getDriveStorage,
  sync
}
