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
  storageOpts,
  corestoreOpts,
  storageFn,
  persist = true
}) => {
  if (store) {
    return store
  }
  console.log({ storageOpts })
  const storage = Storage(storageOpts)

  let driveStorage

  if (!persist) {
    driveStorage = RAM
  } else if (storageFn) {
    // WIP: temp disable
    // driveStorage = storageFn(location)
  } else {
    driveStorage = new Corestore(storage.getCoreStore('.dat'))
    await driveStorage.ready()
  }

  store = driveStorage
  return store
}

// NOTE(dk): this can be used to get or create.
const create = async (key = null, opts = {}) => {
  assert(typeof opts === 'object', ValidationError, 'object', opts)
  debug('create opts', opts)

  const finalHyperdriveOpts = Object.assign(DEFAULT_DRIVE_OPTS, opts.hyperdrive)

  const driveStorage = await getDriveStorage({
    storageOpts: opts.storageOpts,
    persist: opts.persist,
    corestoreOpts: opts.corestoreOpts,
    storageFn: opts.storageFn
  })
  debug('driveStorage', driveStorage)

  finalHyperdriveOpts.namespace = DatEncoding.encode(key)

  const drive = Hyperdrive(driveStorage, key, finalHyperdriveOpts)
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

// This make sure you sync up with peers before trying to do anything with the archive
const reallyReady = archive => {
  return new Promise((resolve, reject) => {
    function cb (err, result) {
      debug('reallyReady cb update', err, result)
      // Ignore errors saying we're up to date
      if (err && err.message !== 'No update available from peers') {
        return reject(err)
      } else return resolve(result)
    }
    if (archive.metadata.peers.length) {
      debug('Has peers, waiting for update...')
      archive.metadata.update({ ifAvailable: true }, cb)
    } else {
      archive.metadata.once('peer-add', () => {
        debug('Found peers, waiting for update...')
        archive.metadata.update({ ifAvailable: true }, cb)
      })
    }
  })
}

/**
 * open
 * @description Open a previously created dat archive using its key
 *
 * @param asynckey
 * @param location
 * @param storageOpts
 * @returns {
 *  drive: an hyperdrive-promise instance,
 *  driveStorage: a storage instance (ie: corestore, random-access-x, etc)
 * }
 */
const open = async (key, location, storageOpts = {}, hyperdriveOpts = {}) => {
  // NOTE(dk): location can be a path or a dat url
  assert(
    typeof key === 'string' || Buffer.isBuffer(key),
    ValidationError,
    "'string' or Buffer",
    key
  )
  const finalHyperdriveOpts = { ...DEFAULT_DRIVE_OPTS, ...hyperdriveOpts }
  const driveStorage = await getDriveStorage({
    storageOpts,
    location
  })

  finalHyperdriveOpts.namespace = DatEncoding.encode(key)

  return {
    drive: Hyperdrive(driveStorage, key, finalHyperdriveOpts),
    driveStorage
  }
}

module.exports = {
  create,
  importFiles,
  open,
  getDriveStorage
}
