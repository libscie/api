// Note(dk): this file contents should be replaced-by/combine-with dat-sdk in medium-term
const { normalize } = require('path')
const debug = require('debug')('p2pcommons:dathelper')
const assert = require('nanocustomassert')
const mirror = require('mirror-folder')
const datIgnore = require('dat-ignore')
const Hyperdrive = require('@geut/hyperdrive-promise')
const corestore = require('corestore')
const Storage = require('universal-dat-storage')
const RAM = require('random-access-memory')
const { ValidationError } = require('./errors')

const DEFAULT_DRIVE_OPTS = {
  sparse: true,
  latest: false
}

const getDriveStorage = ({
  location,
  storageOpts,
  corestoreOpts,
  storageFn,
  persist = true
}) => {
  const storage = Storage(storageOpts)

  let driveStorage

  if (!persist) {
    driveStorage = RAM
  } else if (storageFn) {
    driveStorage = storageFn(location)
  } else {
    driveStorage = corestore(storage.getCoreStore('.dat'), corestoreOpts)
  }

  return driveStorage
}

// NOTE(dk): this can be used to get or create.
const create = (location, key = null, opts = {}) => {
  assert(typeof location === 'string', ValidationError, 'string', location)
  assert(typeof opts === 'object', ValidationError, 'object', opts)
  debug('create location', location)
  debug('create opts', opts)
  const hOpts = Object.assign(DEFAULT_DRIVE_OPTS, opts.hyperdrive)

  const driveStorage = getDriveStorage({
    location,
    storageOpts: opts.storageOpts,
    persist: opts.persist,
    corestoreOpts: opts.corestoreOpts,
    storageFn: opts.storageFn
  })
  debug('driveStorage', driveStorage)
  const drive = Hyperdrive(driveStorage, key, hOpts)

  return drive
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
    if (src.stat.mtime.getTime() > dst.stat.mtime) return cb(null, false)
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
    equals,
    ignore,
    ...opts
  }

  debug('importFiles opts', finalOpts)
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
        if (err) {
          debug('importFiles:err', err)
          return reject(err)
        }
        debug('importFiles:mirror', data)
        resolve(data)
      }
    )
  })
}

const open = (
  key,
  location,
  storageOpts = {},
  hyperdriveOpts = { sparse: true }
) => {
  // NOTE(dk): location can be a path or a dat url
  assert(
    typeof key === 'string' || Buffer.isBuffer(key),
    ValidationError,
    "'string' or Buffer",
    key
  )
  const driveStorage = getDriveStorage({ storageOpts, location })
  return Hyperdrive(driveStorage, key, hyperdriveOpts)
}

module.exports = {
  create,
  importFiles,
  open
}
