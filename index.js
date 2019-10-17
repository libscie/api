const assert = require('assert')
const { join, isAbsolute } = require('path')
const { homedir, tmpdir, platform } = require('os')
const {
  promises: { rename, open }
} = require('fs')
const { ensureDir } = require('fs-extra')
const level = require('level')
const sub = require('subleveldown')
const AutoIndex = require('level-auto-index')
const { Type } = require('@avro/types')
const envPaths = require('env-paths')
const discovery = require('hyperdiscovery')
const uniqueString = require('unique-string')
const DatEncoding = require('dat-encoding')
const debug = require('debug')('p2pcommons')
const dat = require('./lib/dat-helper')
const Codec = require('./codec')
const ContentSchema = require('./schemas/content.json')
const ProfileSchema = require('./schemas/profile.json')

const DEFAULT_SWARM_OPTS = {
  extensions: []
}

const createDatJSON = ({ type, title = '', description = '', url = '' }) => {
  assert.strictEqual(typeof type, 'string', 'type is required')
  const obj = {}
  obj.title = title
  obj.description = description
  obj.url = url
  obj.main = ''
  obj.license = ''
  obj.subtype = type

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
    this.baseDir = isAbsolute(opts.baseDir)
      ? opts.baseDir
      : join(this.home, opts.baseDir)
    this.persist = opts.persist || true
    this.storage = opts.storage || undefined
    this.verbose = opts.verbose || false
    this.dbPath = opts.dbPath || this.paths.data
    // start hyperswarm
    this.disableSwarm = !!opts.disableSwarm
    if (!this.disableSwarm) {
      debug('p2pcommons:constructor starting swarm')
      this.swarm = discovery(Object.assign({}, DEFAULT_SWARM_OPTS, opts.swarm))
    }
  }

  _getAvroType (appType) {
    if (appType === 'content') {
      return this.contentType
    }
    if (appType === 'profile') {
      return this.profileType
    }
  }

  _getDb (type) {
    assert.ok(type, 'type is required')
    if (type.endsWith('profile')) return this.profiledb
    if (type.endsWith('content')) return this.contentdb
    throw new Error(`Unknown type: ${type}`)
  }

  async ready () {
    await ensureDir(this.dbPath)
    return new Promise((resolve, reject) => {
      // start local db
      const registry = {}
      this.contentType = Type.forSchema(ContentSchema, { registry })
      this.profileType = Type.forSchema(ProfileSchema, { registry })
      const codec = new Codec(registry)
      debug('p2pcommons:ready dbpath', this.dbPath)
      level(join(this.dbPath, 'db'), { valueEncoding: codec }, (err, db) => {
        if (err instanceof level.errors.OpenError) {
          if (this.verbose) {
            console.error('p2pcommons:failed to open database')
          }
          reject(err)
        }
        this.db = db
        // create partitions - required by level-auto-index
        this.localdb = sub(this.db, 'localdb', { valueEncoding: codec })
        // create index
        this.idx = {
          title: sub(this.db, 'title'),
          description: sub(this.db, 'description')
        }
        // create filters
        this.by = {}
        this.by.title = AutoIndex(this.localdb, this.idx.title, container =>
          container.rawJSON.title.toLowerCase()
        )
        this.by.description = AutoIndex(
          this.localdb,
          this.idx.description,
          container => container.rawJSON.description.toLowerCase()
        )

        /*
        this.profileByFollows = AutoIndex(
          this.profiledb,
          this.idx.follows,
          profile => {
            if (
              !profile ||
              !profile.follows ||
              !Array.isArray(profile.follows)
            ) {
              return
            }
            return profile.follows.map(
              p => `${p}_${profile.url.toString('hex')}`
            )
          }
        )
        */
        resolve()
      })
    })
  }

  async init ({ type, title = '', description = '', ...rest }) {
    // follow module spec: https://github.com/p2pcommons/specs/pull/1/files?short_path=2d471ef#diff-2d471ef4e3a452b579a3367eb33ccfb9
    // 1. create folder with unique name
    // 2. initialize an hyperdrive inside
    // 3. createDatJSON with the correct metadata and save it there
    //
    assert.ok(typeof type === 'string', 'type is required')
    assert.ok(
      type.endsWith('profile') || type.endsWith('content'),
      "type should be 'content' or 'profile'"
    )
    debug(`p2pcommons:init ${type}`)

    const tmp = join(this.baseDir, uniqueString())

    await ensureDir(tmp)

    const archive = dat.create(tmp, {
      persist: this.persist,
      storageFn: this.storage,
      storageOpts: { ...rest.storageOpts }
    })
    await archive.ready()

    const hash = archive.key.toString('hex')

    debug('p2pcommons:init hash', hash)
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

    // create dat.json metadata
    const datJSON = createDatJSON({
      type,
      title,
      description,
      url: archive.key
    })
    // Note(dk): validate earlier
    const avroType = this._getAvroType(datJSON.type)

    if (!avroType.isValid(datJSON)) {
      throw new Error('Invalid metadata')
    }

    // write dat.json
    await archive.writeFile('dat.json', JSON.stringify(datJSON))
    const newPath = join(this.baseDir, hash)
    await rename(tmp, newPath)

    if (this.verbose) {
      // Note(dk): this kind of output can be part of the cli
      console.log(`Initialized new ${datJSON.type}, dat://${hash}`)
    }
    debug('p2pcommons:init datJSON', datJSON)

    const stat = await archive.stat('dat.json')
    await this.saveItem({
      isWritable: archive.writable,
      lastModified: stat.mtime,
      metadata: datJSON
    })

    if (this.verbose) {
      console.log(`Saved new ${datJSON.type}, with key: ${hash}`)
    }
    return datJSON
  }

  async saveItem ({ isWritable, lastModified, metadata, persist = false }) {
    debug('p2pcommons:saveItem', metadata)
    assert.strictEqual(typeof isWritable, 'boolean', 'isWritable is required')
    assert.strictEqual(typeof metadata, 'object', 'An object is expected')
    assert.strictEqual(
      typeof metadata.type,
      'string',
      'type property is required'
    )

    await this.localdb.put(metadata.url.toString('hex'), {
      isWritable,
      lastModified,
      rawJSON: metadata,
      avroType: this._getAvroType(metadata.type).name
    })

    if (persist) {
      const datJSONDir = join(this.baseDir, metadata.url.toString('hex'))
      const archive = dat.open(datJSONDir)
      await archive.ready()
      await archive.writeFile('dat.json', JSON.stringify(metadata))
    }
  }

  async set (metadata) {
    assert.strictEqual(
      typeof metadata,
      'object',
      'metadata should be an object'
    )
    assert.ok(metadata.url, 'Invalid metadata. Missing property: url')
    assert.ok(
      metadata.type === 'profile' || metadata.type === 'content',
      "type should be 'content' or 'profile'"
    )

    const tmp = await this.get(metadata.url.toString('hex'), false)
    debug('p2pcommons:set', { ...tmp })
    return this.saveItem({ ...tmp, metadata, persist: tmp.isWritable })
  }

  async get (hash, onlyMetadata = true) {
    assert.strictEqual(typeof hash, 'string', 'hash is required')
    const dbitem = await this.localdb.get(hash)
    debug('p2pcommons:get', dbitem)
    if (onlyMetadata) {
      return dbitem.rawJSON
    }
    return dbitem
  }

  async filterExact (feature, criteria) {
    assert.strictEqual(
      typeof feature,
      'string',
      'A valid filter type is required'
    )
    assert.ok(criteria, 'filter criteria is required')
    return new Promise((resolve, reject) => {
      this.by[feature].get(criteria, (err, data) => {
        if (err) return reject(err)

        if (!Array.isArray(data)) return resolve([data])
        return resolve(data)
      })
    })
  }

  async filter (feature, criteria) {
    assert.strictEqual(
      typeof feature,
      'string',
      'A valid filter type is required'
    )
    assert.ok(criteria, 'filter criteria is required')
    return new Promise((resolve, reject) => {
      const out = []
      const criteriaLower = criteria.toLowerCase()
      const s = this.by[feature].createValueStream({
        gte: criteriaLower
      })
      s.on('data', v => {
        if (
          v.rawJSON &&
          v.rawJSON[feature] &&
          v.rawJSON[feature].toLowerCase().includes(criteriaLower)
        ) {
          out.push(v)
        }
      })
      s.on('end', () => resolve(out))
      s.on('error', reject)
    })
  }

  async listContent () {
    return new Promise((resolve, reject) => {
      const out = []
      const s = this.localdb.createValueStream()
      s.on('data', val => {
        if (val.isWritable && val.rawJSON.type === 'content') out.push(val)
      })
      s.on('end', () => resolve(out))
      s.on('error', reject)
    })
  }

  async listProfiles () {
    return new Promise((resolve, reject) => {
      const out = []
      const s = this.localdb.createValueStream()
      s.on('data', val => {
        if (val.isWritable && val.rawJSON.type === 'profile') out.push(val)
      })
      s.on('end', () => resolve(out))
      s.on('error', reject)
    })
  }

  async openFile (key) {
    assert.strictEqual(typeof key, 'string', 'key is required')
    const { main } = await this.get(key)
    if (!main) {
      throw new Error('Empty main file')
    }
    return open(main)
  }

  async destroy () {
    debug('p2pcommons:destroying swarm')
    if (this.disableSwarm) return
    await this.db.close()
    return this.swarm.close()
  }
}

module.exports = SDK
