const { join, isAbsolute } = require('path')
const { homedir, tmpdir, platform } = require('os')
const {
  promises: { open, writeFile }
} = require('fs')
const { ensureDir } = require('fs-extra')
const assert = require('nanocustomassert')
const level = require('level')
const sub = require('subleveldown')
const AutoIndex = require('level-auto-index')
const { Type } = require('@avro/types')
const discovery = require('hyperdiscovery')
const crypto = require('hypercore-crypto')
const DatEncoding = require('dat-encoding')
const debug = require('debug')('p2pcommons')
const dat = require('./lib/dat-helper')
const Codec = require('./codec')
const ContentSchema = require('./schemas/content.json')
const ProfileSchema = require('./schemas/profile.json')
const ValidationTypes = require('./validation')
const {
  InvalidKeyError,
  ValidationError,
  MissingParam
} = require('./lib/errors')

const DEFAULT_SWARM_OPTS = {
  extensions: []
}

// helper dat.json object mould
const createDatJSON = ({
  title,
  description,
  url,
  license = [
    {
      href: 'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
    }
  ],
  spec = [{ href: 'https://p2pcommons.com/specs/module/0.2.0' }],
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
    mould.p2pcommons.follows = []
    mould.p2pcommons.contents = []
  } else {
    mould.p2pcommons.authors = []
    mould.p2pcommons.parents = []
  }

  return mould
}

// helper assert fn
const assertValid = (type, val) => {
  return type.isValid(val, { errorHook })

  function errorHook (path, any, type) {
    let msg = `[${path.join('.')}]\t`
    if (type.typeName === 'record') {
      if (any !== null && typeof any === 'object') {
        const declared = new Set(type.fields.map(f => f.name))
        const extra = Object.keys(any).filter(n => !declared.has(n))
        msg += `extra fields (${extra.join(', ')})`
      } else {
        msg += `not an object: ${any}`
      }
    } else {
      msg += `not a valid ${type}: ${JSON.stringify(any)}`
    }
    // Here, we just print the mismatches. It would be straightforward to return
    // them instead too (for example using a custom error).
    throw new ValidationError(type, msg)
  }
}

class SDK {
  constructor (opts = {}) {
    debug('constructor')
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
    this.dbPath = opts.dbPath || this.baseDir
    // start hyperswarm
    this.disableSwarm = !!opts.disableSwarm
    if (!this.disableSwarm) {
      debug('constructor starting swarm')
      this.swarm = discovery(Object.assign({}, DEFAULT_SWARM_OPTS, opts.swarm))
    }
  }

  allowedProperties () {
    return ['title', 'description', 'main', 'subtype', 'authors', 'contents']
  }

  _getAvroType (appType) {
    if (appType === 'content') {
      return this.contentType
    }
    if (appType === 'profile') {
      return this.profileType
    }
  }

  async ready () {
    return Promise.all([
      ensureDir(this.dbPath),
      new Promise((resolve, reject) => {
        // start local db
        const registry = {}
        this.contentType = Type.forSchema(ContentSchema, {
          registry,
          logicalTypes: {
            'required-string': ValidationTypes.RequiredString,
            'dat-url': ValidationTypes.DatUrl,
            'dat-versioned-url': ValidationTypes.DatUrlVersion
          }
        })
        this.profileType = Type.forSchema(ProfileSchema, {
          registry,
          logicalTypes: {
            'required-string': ValidationTypes.RequiredString,
            'dat-url': ValidationTypes.DatUrl,
            'dat-versioned-url': ValidationTypes.DatUrlVersion
          }
        })
        const codec = new Codec(registry)
        debug('ready dbpath', this.dbPath)
        level(join(this.dbPath, 'db'), { valueEncoding: codec }, (err, db) => {
          if (err instanceof level.errors.OpenError) {
            if (this.verbose) {
              console.error('failed to open database')
            }
            return reject(err)
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
    ])
  }

  async init ({
    type,
    title,
    subtype = '',
    description = '',
    main = '',
    datOpts = { datStorage: {} }
  }) {
    // follow module spec: https://github.com/p2pcommons/specs/pull/1/files?short_path=2d471ef#diff-2d471ef4e3a452b579a3367eb33ccfb9
    // 1. create folder with unique name (pk)
    // 2. initialize an hyperdrive inside
    // 3. createDatJSON with the correct metadata and save it there
    //
    assert(typeof type === 'string', ValidationError, 'string', type)
    assert(
      type === 'profile' || type === 'content',
      ValidationError,
      "'content' or 'profile'",
      type
    )
    assert(typeof title === 'string', ValidationError, 'string', title)
    assert(typeof subtype === 'string', ValidationError, 'string', subtype)

    debug(`init ${type}`)

    const { publicKey, secretKey } = crypto.keyPair()
    debug(`init pk ${publicKey.toString('hex')}`)

    // NOTE(dk): check out datStorage options: https://github.com/RangerMauve/universal-dat-storage#api
    datOpts.datStorage.storageLocation = datOpts.datStorage.storageLocation
      ? datOpts.datStorage.storageLocation
      : join(this.baseDir, publicKey.toString('hex'))
    debug(`init storageLocation ${datOpts.datStorage.storageLocation}`)

    await ensureDir(datOpts.datStorage.storageLocation)
    const archive = dat.create(datOpts.datStorage.storageLocation, publicKey, {
      persist: this.persist,
      storageFn: this.storage,
      hyperdrive: {
        secretKey
      },
      storageOpts: { ...datOpts.datStorage }
    })
    await archive.ready()

    const hash = archive.key.toString('hex')

    if (!this.disableSwarm) {
      this.swarm.add(archive)

      archive.once('close', () => {
        debug(`closing archive ${archive.publicKey}...`)
        const discoveryKey = DatEncoding.encode(archive.discoveryKey)
        this.swarm.leave(discoveryKey)
        this.swarm._replicatingFeeds.delete(discoveryKey)
      })
    }

    // create dat.json metadata
    const datJSON = createDatJSON({
      type,
      title,
      subtype,
      description,
      main,
      url: hash
    })

    // Note(dk): validate earlier
    const avroType = this._getAvroType(type)

    assertValid(avroType, datJSON)

    // write dat.json
    const folderPath = join(this.baseDir, hash)
    await writeFile(join(folderPath, 'dat.json'), JSON.stringify(datJSON))
    await dat.importFiles(archive, folderPath)

    if (this.verbose) {
      // Note(dk): this kind of output can be part of the cli
      console.log(`Initialized new ${datJSON.p2pcommons.type}, dat://${hash}`)
    }

    debug('init datJSON', datJSON)

    const stat = await archive.stat('dat.json')
    await this.saveItem({
      isWritable: archive.writable,
      lastModified: stat.mtime,
      version: archive.version,
      metadata: datJSON
    })

    if (this.verbose) {
      console.log(`Saved new ${datJSON.p2pcommons.type}, with key: ${hash}`)
    }
    return datJSON
  }

  async saveItem ({ isWritable, lastModified, version, metadata }) {
    debug('saveItem', metadata)
    assert(
      typeof isWritable === 'boolean',
      ValidationError,
      'boolean',
      isWritable
    )
    assert(typeof metadata === 'object', ValidationError, 'object', metadata)

    const datJSONDir = join(this.baseDir, metadata.url.toString('hex'))
    const storageOpts = {
      storageLocation: join(this.baseDir, metadata.url.toString('hex'))
    }
    const archive = dat.open(
      metadata.url.toString('hex'),
      undefined,
      storageOpts
    )
    await archive.ready()
    let stat
    if (isWritable) {
      await writeFile(join(datJSONDir, 'dat.json'), JSON.stringify(metadata))
      await dat.importFiles(archive, datJSONDir)
      stat = await archive.stat('/dat.json')
    }

    await this.localdb.put(metadata.url.toString('hex'), {
      isWritable,
      lastModified: stat ? stat.mtime : lastModified,
      version: archive.version,
      rawJSON: metadata,
      avroType: this._getAvroType(metadata.p2pcommons.type).name
    })
  }

  async set (metadata) {
    assert(typeof metadata === 'object', ValidationError, 'object', metadata)
    assert(
      typeof metadata.url === 'string' || Buffer.isBuffer(metadata.url),
      ValidationError,
      "'string' or Buffer",
      metadata.url
    )

    // NOTE(dk): some properties are read only (license, follows, ...)
    const { url, ...mod } = metadata

    // Check if received keys are valid (editable)
    const receivedKeys = Object.keys(mod)
    const allowedProperties = this.allowedProperties()
    for (const key of receivedKeys) {
      if (!allowedProperties.includes(key)) {
        throw new InvalidKeyError(key)
      }
    }

    const tmp = await this.get(DatEncoding.encode(url), false)
    if (!tmp) {
      // Note(dk): check if we need to search the module on the hyperdrive?
      throw new Error(`Module with url ${url} can not be found on localdb`)
    }

    // Check if keys values are valid (ie: non empty, etc)
    const avroType = this._getAvroType(tmp.rawJSON.p2pcommons.type)
    const finalMetadata = { ...tmp.rawJSON, ...mod }
    assertValid(avroType, finalMetadata)

    debug('set', { ...mod })
    return this.saveItem({
      ...tmp,
      metadata: finalMetadata
    })
  }

  async get (key, onlyMetadata = true) {
    assert(
      typeof key === 'string' || Buffer.isBuffer(key),
      ValidationError,
      "'string' or Buffer",
      key
    )
    key = DatEncoding.encode(key)
    const dbitem = await this.localdb.get(key)
    debug('get', dbitem)
    if (onlyMetadata) {
      return dbitem.rawJSON
    }
    return dbitem
  }

  async filterExact (feature, criteria) {
    assert(typeof feature === 'string', ValidationError, 'string', feature)
    assert(typeof criteria === 'string', ValidationError, 'string', criteria)
    return new Promise((resolve, reject) => {
      this.by[feature].get(criteria, (err, data) => {
        if (err) return reject(err)

        if (!Array.isArray(data)) return resolve([data])
        return resolve(data)
      })
    })
  }

  async filter (feature, criteria, dbitem = false) {
    assert(typeof feature === 'string', ValidationError, 'string', feature)
    assert(typeof criteria === 'string', ValidationError, 'string', criteria)
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
          out.push(dbitem ? v : v.rawJSON)
        }
      })
      s.on('end', () => resolve(out))
      s.on('error', reject)
    })
  }

  async listContent (dbitem = false) {
    return new Promise((resolve, reject) => {
      const out = []
      const s = this.localdb.createValueStream()
      s.on('data', val => {
        if (val.isWritable && val.rawJSON.p2pcommons.type === 'content') {
          out.push(dbitem ? val : val.rawJSON)
        }
      })
      s.on('end', () => resolve(out))
      s.on('error', reject)
    })
  }

  async listProfiles (dbitem = false) {
    return new Promise((resolve, reject) => {
      const out = []
      const s = this.localdb.createValueStream()
      s.on('data', val => {
        if (val.isWritable && val.rawJSON.p2pcommons.type === 'profile') {
          out.push(dbitem ? val : val.rawJSON)
        }
      })
      s.on('end', () => resolve(out))
      s.on('error', reject)
    })
  }

  async list (dbitem = false) {
    return new Promise((resolve, reject) => {
      const out = []
      const s = this.localdb.createValueStream()
      s.on('data', val => {
        if (val.isWritable) out.push(dbitem ? val : val.rawJSON)
      })
      s.on('end', () => resolve(out))
      s.on('error', reject)
    })
  }

  async openFile (key) {
    assert(typeof key === 'string', ValidationError, 'string', key)
    const { main } = await this.get(key)
    if (!main) {
      throw new Error('Empty main file')
    }
    return open(main)
  }

  async register (sourceKey, destKey) {
    assert(
      typeof sourceKey === 'string' || Buffer.isBuffer(sourceKey),
      ValidationError,
      "'string' or Buffer",
      sourceKey
    )
    assert(
      typeof destKey === 'string' || Buffer.isBuffer(destKey),
      ValidationError,
      "'string' or Buffer",
      destKey
    )
    // fetch source and dest
    // 1 - try to get source from localdb
    let source = await this.get(DatEncoding.encode(sourceKey))
    if (!source) {
      // 2 - if no module is found on localdb, then fetch from hyperdrive
      // something like:
      const sourceDat = dat.open(source) // NOTE(dk): be sure to check sparse options so we only dwld dat.json
      await sourceDat.ready()
      // 3 - after fetching module we still need to read the dat.json file
      try {
        source = await sourceDat.readFile('dat.json')
      } catch (err) {
        throw new Error('Module not found')
      }
      // 4 - clone new module
      // TBD
    }
    // 1 - try to get dest from localdb
    let dest = await this.get(DatEncoding.encode(destKey))
    if (!dest) {
      // 2 - if no module is found on localdb, then fetch from hyperdrive
      // something like:
      const destDat = dat.open(dest) // NOTE(dk): be sure to check sparse options so we only dwld dat.json
      await destDat.ready()
      // 3 - after fetching module we still need to read the dat.json file
      try {
        dest = await destDat.readFile('dat.json')
      } catch (err) {
        throw new Error('Module not found')
      }
      //
      // 4 - clone the new module
    }

    // TODO(dk): add custom errors for register and validation maybe....
    assert(source.type === 'content', ValidationError, 'content', source.type)
    assert(dest.type === 'profile', ValidationError, 'profile', dest.type)

    const destType = this._getAvroType(dest.type)
    const destValid = destType.isValid(dest)
    if (!destValid) {
      throw new Error('Invalid module')
    }
    const sourceType = this._getAvroType(source.type)
    const sourceValid = sourceType.isValid(source)
    if (!sourceValid) {
      throw new Error('Invalid module')
    }

    // Note(dk): at this point is safe to save the new modules if necessary

    if (dest.authors.length === 0) {
      throw new Error('Authors is empty')
    }
    // verify content first
    const verified = await this.verify(source)

    if (!verified) {
      throw new Error('source module does not met the requirements')
    }

    // register new content
    dest.contents.push(source.url)
  }

  async verify (source) {
    assert(source.type === 'content', ValidationError, 'content', source.type)
    // TODO(dk): check versions
    if (source.authors.length === 0) return false
    return source.authors.reduce(async (prevProm, authorKey) => {
      const prev = await prevProm
      const profile = await this.get(authorKey)
      return prev && profile.contents.includes(source.url)
    }, Promise.resolve(true))
  }

  async destroy () {
    debug('destroying swarm')
    await this.db.close()
    await this.localdb.close()
    if (this.disableSwarm) return
    return this.swarm.close()
  }
}

SDK.errors = { ValidationError, InvalidKeyError, MissingParam }

module.exports = SDK
