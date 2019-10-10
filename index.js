const assert = require('assert')
const { join } = require('path')
const { homedir, tmpdir, platform } = require('os')
const {
  promises: { writeFile, rename }
} = require('fs')
const { ensureDir } = require('fs-extra')
const level = require('level')
const avro = require('avsc')
const envPaths = require('env-paths')
const discovery = require('hyperdiscovery')
const uniqueString = require('unique-string')
const DatEncoding = require('dat-encoding')
const debug = require('debug')('p2pcommons')
const DatHelper = require('./lib/dat-helper')
const ContentSchema = require('./schemas/content.json')
const ProfileSchema = require('./schemas/profile.json')

const DEFAULT_SWARM_OPTS = {
  extensions: []
}

const createDatJSON = (type, title = '', description = '') => {
  const obj = {}
  obj.title = title
  obj.description = description
  obj.url = ''
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
    debug('p2pcommons:constructor')
    this.paths = envPaths('p2pcommons')
    this.platform = platform()
    // NOTE(dk): consider switch to envPaths usage
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
    this.dbPath = opts.dbPath || this.paths.data
    // start hyperswarm
    this.disableSwarm = !!opts.disableSwarm
    if (!this.disableSwarm) {
      debug('p2pcommons:constructor starting swarm')
      this.swarm = discovery(Object.assign({}, DEFAULT_SWARM_OPTS, opts.swarm))
    }
  }

  async ready () {
    await ensureDir(this.dbPath)
    return new Promise((resolve, reject) => {
      // start local db
      this.contentType = avro.Type.forSchema(ContentSchema)
      this.profileType = avro.Type.forSchema(ProfileSchema)
      this.contentTypeCodec = {
        type: 'AvroContentType',
        encode: datum => this.contentType.toBuffer(datum),
        decode: datum => this.contentType.fromBuffer(datum),
        buffer: true
      }
      this.profileTypeCodec = {
        type: 'AvroProfileType',
        encode: datum => this.profileType.toBuffer(datum),
        decode: datum => this.profileType.fromBuffer(datum),
        buffer: true
      }
      level(
        join(this.dbPath, 'db'),
        {
          valueEncoding: 'binary'
        },
        (err, db) => {
          if (err instanceof level.errors.OpenError) {
            console.error('p2pcommons:failed to open database')
            reject(err)
          }
          this.db = db
          resolve()
        }
      )
    })
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
    debug(`p2pcommons:init ${type}`)
    const datJSON = createDatJSON(type, title, description)

    const tmp = join(this.baseDir, uniqueString())

    await ensureDir(tmp)

    const datHelper = await DatHelper(tmp, {
      persist: this.persist,
      storageFn: this.storage,
      storageOpts: { ...rest.storageOpts }
    })
    const { archive } = datHelper
    await archive.ready()

    const hash = archive.key.toString('hex')

    debug('p2pcommons:hash', hash)
    if (!this.disableSwarm) {
      this.swarm.add(archive)

      archive.once('close', () => {
        debug(`p2pcommons:closing archive ${archive.publicKey}...`)
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
    debug('p2pcommons:datJSON', datJSON)
    // cache(hash, env)
    const codec =
      datJSON.type === 'content' ? this.contentTypeCodec : this.profileTypeCodec
    await this.db.put(hash, datJSON, { valueEncoding: codec })
    console.log(`Saved new ${datJSON.type}, wth key: ${hash}`)
    return datJSON
  }

  async destroy () {
    debug('p2pcommons:destroying swarm')
    if (this.disableSwarm) return
    return this.swarm.close()
  }
}

module.exports = (...args) => new SDK(...args)
