const { EventEmitter } = require('events')
const {
  promises: { stat }
} = require('fs')
const { normalize, basename } = require('path')
const once = require('events.once')
const collectStream = require('stream-collector')
const assert = require('nanocustomassert')
const { TypeError } = require('./errors')
const vers = require('./spec')

exports.hashShort = x => {
  const p = x.substr(0, 3)
  const q = x.substr(x.length - 3, x.length)
  return `${p}...${q}`
}

exports.hashChecker = x => {
  const res = {}
  x = x.split('+')
  // check for hyper://
  // doesn't crash if not present
  res.key = x[0].replace('hyper://', '')
  res.version = parseInt(x[1])

  return res
}

const _JSONencode = (value, map) =>
  JSON.stringify(value, (key, value) => {
    if (map[key]) {
      return map[key](value)
    }

    return value
  })

const _JSONdecode = (value, map) =>
  JSON.parse(value, (key, value) => {
    if (map[key]) {
      return map[key](value.data || value)
    }

    return value
  })

const JSONencode = (exports.JSONencode = obj => {
  if (typeof obj === 'string') return JSONencode(JSONdecode(obj))

  const transform = {
    url: value => Buffer.from(value).toString('hex')
  }
  return _JSONencode(obj, transform)
})

const JSONdecode = (exports.JSONdecode = str => {
  if (Buffer.isBuffer(str)) return JSONdecode(JSONencode(str))
  assert(typeof str === 'string', TypeError, 'string', str)

  const transform = {
    url: value => {
      // looking for an hexa string of 64 or 65 consecutive chars
      var match = /([a-f0-9]{64,65})/i.exec(value)
      // we need exactly 64, so an hexa string with 65 chars (or more) is not allowed
      if (!match || match[1].length !== 64) throw new Error('Invalid key')
      return Buffer.from(match[1], 'hex')
    }
  }
  return _JSONdecode(str, transform)
})

// helper index.json object mould
exports.createIndexJSON = ({
  title,
  description,
  url,
  license = [
    {
      href: 'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
    }
  ],
  spec = [{ href: `https://p2pcommons.com/specs/module/${vers.module}` }],
  authors,
  follows,
  contents,
  parents,
  avatar,
  ...p2pcommons
}) => {
  const mould = {
    title,
    description,
    url,
    links: { license, spec },
    p2pcommons
  }
  // TODO(dk): validate links (license, spec)

  if (mould.p2pcommons.type === 'profile') {
    mould.p2pcommons.follows = follows || []
    mould.p2pcommons.contents = contents || []
    mould.p2pcommons.avatar = avatar || ''
  } else {
    mould.p2pcommons.authors = authors || []
    mould.p2pcommons.parents = parents || []
  }

  return mould
}

exports.collect = (index, opts) => {
  return new Promise((resolve, reject) => {
    collectStream(index.createReadStream(opts), (err, list) => {
      if (err) return reject(err)
      return resolve(list)
    })
  })
}

/**
 * driveWaitForFile
 *
 * @description Wait for the file to be seen on the drive
 * @async
 * @param {Object} drive - Hyperdrive to watch
 * @param {Function} watcher - mirror folder instance
 * @param {string} file - target file
 * @param {string} fullPathFile - target file full path
 */
exports.driveWaitForFile = async (drive, watcher, file, fullPathFile) => {
  assert(drive && typeof drive === 'object', TypeError, 'Hyperdrive', drive)
  assert(typeof file === 'string', TypeError, 'path', file)

  const fileName = basename(normalize(file))

  try {
    // Note(dk): replace with drive.access when it has support
    const [driveStat] = await drive.stat(fileName)

    const fileStat = await stat(fullPathFile)
    if (fileStat.mtime.getTime() > driveStat.mtime.getTime()) {
      throw new Error(
        'local file in filesystem is more recent than the one in the drive'
      )
    }
  } catch (_) {
    let src
    while (([src] = await once(watcher, 'put-end'))) {
      if (src && src.name && src.name.includes(fileName)) {
        break
      }
    }
  }
}

/**
 * dlWaitForFile.
 *
 * @description Wait for the file to be seen on the fs
 * @async
 * @param {Object} dlHandle - dlHandle should be an event emitter
 * @param {Object} driveFileStatMtime - drive file stat mtime
 * @param {String} file - its the file path
 */
exports.dlWaitForFile = async (dlHandle, driveFileStatMtime, file) => {
  assert(typeof file === 'string', TypeError, 'path', file)
  assert(
    driveFileStatMtime instanceof Date,
    TypeError,
    'Date',
    driveFileStatMtime
  )
  assert(dlHandle instanceof EventEmitter, TypeError, 'Event Emitter', dlHandle)
  file = normalize(file)
  try {
    const fileStat = await stat(file)
    if (fileStat.mtime.getTime() < driveFileStatMtime.getTime()) {
      throw new Error('file in filesystem is older than the one in the drive')
    }
  } catch (_) {
    let src
    const fileName = basename(file)
    while (([src] = await once(dlHandle, 'put-end'))) {
      if (src && src.name && src.name.includes(fileName)) {
        break
      }
    }
  }
}
