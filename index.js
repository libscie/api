const assert = require('assert')
const { join } = require('path')
const { homedir, tmpdir, platform } = require('os')
const {
  promises: { writeFile, rename }
} = require('fs')
const fs = require('fs-extra')
const RAM = require('random-access-memory')
const discovery = require('hyperdiscovery')
const uniqueString = require('unique-string')
const DatEncoding = require('dat-encoding')
const debug = require('debug')('libsdk')
const DatHelper = require('./lib/dat-helper')

const DEFAULT_SWARM_OPTS = {
  extensions: []
}

const createDatJSON = (type, title = '', description = '') => {
  const obj = {}
  obj.title = title
  obj.description = description
  obj.url = ''
  obj.roots = []
  obj.main = ''
  obj.license = ''

  if (type.endsWith('profile')) {
    obj.type = 'profile'
    obj.follows = []
    obj.contents = []
  } else {
    obj.type = 'content'
    obj.authors = []
    obj.parents = []
  }

  return obj
}

class SDK {
  constructor (opts = {}) {
    debug('libsdk:constructor')
    this.platform = platform()
    this.home =
      process.env.HOME ||
      (this.windows && this.windowsHome()) ||
      homedir() ||
      tmpdir()
    this.windows = this.platform === 'win32'
    opts.baseDir = opts.baseDir || '.p2pcommons'
    this.baseDir = join(this.home, opts.baseDir)
    this.persist = opts.persist || true
    this.storage = opts.storage || undefined
    // instantiate local db here
    // start hyperswarm
    this.disableSwarm = !!opts.disableSwarm
    if (!this.disableSwarm) {
      debug('libsdk:constructor starting swarm')
      this.swarm = discovery(Object.assign({}, DEFAULT_SWARM_OPTS, opts.swarm))
    }
  }

  async init ({ type, title = '', description = '', ...rest }) {
    // follow module spec: https://github.com/p2pcommons/specs/pull/1/files?short_path=2d471ef#diff-2d471ef4e3a452b579a3367eb33ccfb9
    // 1. create folder with unique name
    // 2. initialize an hyperdrive inside
    // 3. createDatJSON with the corrent metadata and save it there
    //
    assert.ok(typeof type === 'string', 'type is required')
    assert.ok(
      type.endsWith('profile') || type.endsWith('content'),
      "type should be 'content' or 'profile'"
    )
    debug(`libsdk:init ${type}`)
    const datJSON = createDatJSON(type, title, description)

    const tmp = join(this.baseDir, uniqueString())

    await fs.ensureDir(tmp)

    const datHelper = await DatHelper(tmp, {
      persist: this.persist,
      storageFn: this.storage,
      storageOpts: { ...rest.storageOpts }
    })
    const { archive } = datHelper
    await archive.ready()

    const hash = archive.key.toString('hex')

    debug('libsdk:hash', hash)
    if (!this.disableSwarm) {
      this.swarm.add(archive)

      archive.once('close', () => {
        debug(`libsdk:closing archive ${archive.publicKey}...`)
        const discoveryKey = DatEncoding.encode(archive.discoveryKey)
        this.swarm.leave(discoveryKey)
        this.swarm._replicatingFeeds.delete(discoveryKey)
        // Note(dk): should we handle multiple drives?
        // drives.delete(stringKey)
      })
    }

    datJSON.url = `dat://${hash}`

    // write dat.json
    await writeFile(join(tmp, 'dat.json'), JSON.stringify(datJSON))

    await rename(tmp, join(this.baseDir, hash))

    console.log(`Initialized new ${datJSON.type}, dat://${hash}`)

    // cache(hash, env)

    return datJSON
  }

  async destroy () {
    debug('libsdk:destroying swarm')
    if (this.disableSwarm) return
    return this.swarm.close()
  }
}

module.exports = (...args) => new SDK(...args)
