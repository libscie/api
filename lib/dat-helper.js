// Note(dk): this file contents should be replaced-by/combine-with dat-sdk in medium-term
const { normalize } = require('path')
const debug = require('debug')('p2pcommons:dathelper')
const assert = require('nanocustomassert')
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

let store

const getDriveStorage = async ({
  storageOpts = {},
  corestoreOpts = {},
  storageFn,
  persist = true
} = {}) => {
  if (store) {
    return store
  }
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

  store = driveStorage
  return store
}

// NOTE(dk): this can be used to get or create.
const create = async (key = null, opts = {}) => {
  assert(typeof opts === 'object', ValidationError, 'object', opts)

  const finalHyperdriveOpts = { ...DEFAULT_DRIVE_OPTS, ...opts.hyperdrive }

  const driveStorage = await getDriveStorage({
    storageOpts: opts.storageOpts,
    persist: opts.persist,
    corestoreOpts: opts.corestoreOpts,
    storageFn: opts.storageFn
  })

  finalHyperdriveOpts.namespace = DatEncoding.encode(key)

  debug('create finalHyperdriveOpts', finalHyperdriveOpts)

  const drive = Hyperdrive(driveStorage, null, finalHyperdriveOpts)
  return { drive, driveStorage }
}

const importFiles = async (archive, src = './', opts = {}) => {
  assert(typeof archive === 'object', ValidationError, 'object', archive)
  const equals = (src, dst, cb) => {
    debug('importFiles equals')
    // Note(dk): this is necessary because latest hyperdrive is using Hyperdrive-schemas
    // which already resolves the getTime on the mtime value.
    if (!src.stat.isDirectory() && src.stat.size !== dst.stat.size) {
      return cb(null, false)
    }
    if (src.stat.mtime.getTime() > dst.stat.mtime) {
      return cb(null, false)
    }
    return cb(null, true)
  }
  const dIgnore = datIgnore(src)
  const ignoreDirs = !(opts.ignoreDirs === false)
  const ignore = (name, st) => {
    if (ignoreDirs && st && st.isDirectory()) return true
    debug(`ignore ${name} : ${dIgnore(name, st)}`)
    return dIgnore(name, st)
  }

  const finalOpts = {
    watch: false,
    dereference: true,
    count: true,
    equals,
    ignore,
    indexing: false,
    ...opts
  }

  debug('importFiles opts', finalOpts)
  if (finalOpts.watch || finalOpts.ee) {
    // returns an event emitter
    return mirror(normalize(src), { name: '/', fs: archive.h }, finalOpts)
  }

  return new Promise((resolve, reject) => {
    mirror(normalize(src), { name: '/', fs: archive.h }, finalOpts, err => {
      if (err) {
        debug('importFiles:err', err)
        console.log(err)
        return reject(err)
      }
      debug('importFiles:mirror end successfully')
      return resolve()
    })
  })
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
const open = async (key, hyperdriveOpts = {}) => {
  // NOTE(dk): location can be a path or a dat url
  assert(
    typeof key === 'string' || Buffer.isBuffer(key),
    ValidationError,
    "'string' or Buffer",
    key
  )
  const finalHyperdriveOpts = { ...DEFAULT_DRIVE_OPTS, ...hyperdriveOpts }
  const driveStorage = await getDriveStorage()

  finalHyperdriveOpts.namespace = DatEncoding.encode(key)
  finalHyperdriveOpts.key = null

  return {
    drive: Hyperdrive(
      driveStorage,
      DatEncoding.decode(key),
      finalHyperdriveOpts
    ),
    driveStorage
  }
}

module.exports = {
  create,
  importFiles,
  open,
  getDriveStorage
}
