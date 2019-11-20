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
const SwarmNetworker = require('corestore-swarm-networking')
const crypto = require('hypercore-crypto')
const DatEncoding = require('dat-encoding')
const debug = require('debug')('p2pcommons')
const deepMerge = require('deepmerge')
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
    this.networkers = []
    this.disableSwarm = !!opts.disableSwarm
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

  _unflatten (data) {
    if (typeof data.p2pcommons === 'object') return data
    const { title, description, url, links, ...p2pcommons } = data
    return { title, description, url, links, p2pcommons }
  }

  _flatten (data) {
    if (typeof data.type === 'string') return data
    const { p2pcommons, ...rest } = data
    return { ...rest, ...p2pcommons }
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
    const { drive: archive, driveStorage } = dat.create(
      datOpts.datStorage.storageLocation,
      publicKey,
      {
        persist: this.persist,
        storageFn: this.storage,
        hyperdrive: {
          secretKey
        },
        storageOpts: { ...datOpts.datStorage }
      }
    )
    await archive.ready()

    const hash = archive.key.toString('hex')

    if (!this.disableSwarm) {
      const networker = new SwarmNetworker(driveStorage, {
        announceLocalAddress: true
      })
      this.networkers.push(networker)
      debug('swarm listening...')
      networker.listen()
      debug(`swarm seeding ${archive.discoveryKey.toString('hex')}`)
      networker.seed(archive.discoveryKey)

      dat.replicateFeed(driveStorage, archive.metadata)
      archive.once('close', () => {
        const discoveryKey = DatEncoding.encode(archive.discoveryKey)
        if (this.verbose) {
          console.log(
            `closing archive ${DatEncoding.decode(archive.discoveryKey)}...`
          )
        }
        networker.unseed(discoveryKey)
        // this.swarm.leave(discoveryKey)
        // this.swarm._replicatingFeeds.delete(discoveryKey)
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
      datJSON
    })

    if (this.verbose) {
      console.log(`Saved new ${datJSON.p2pcommons.type}, with key: ${hash}`)
    }
    // Note(dk): flatten p2pcommons obj in order to have a more symmetrical API
    return this._flatten(datJSON)
  }

  async saveItem ({ isWritable, lastModified, version, datJSON }) {
    debug('saveItem', datJSON)
    assert(
      typeof isWritable === 'boolean',
      ValidationError,
      'boolean',
      isWritable
    )
    assert(typeof datJSON === 'object', ValidationError, 'object', datJSON)

    const datJSONDir = join(this.baseDir, datJSON.url.toString('hex'))
    const storageOpts = {
      storageLocation: join(this.baseDir, datJSON.url.toString('hex'))
    }
    const { drive: archive, driveStorage } = dat.open(
      datJSON.url.toString('hex'),
      undefined,
      storageOpts
    )
    await archive.ready()
    dat.replicateFeed(driveStorage, archive.metadata)

    let stat
    if (isWritable) {
      await writeFile(join(datJSONDir, 'dat.json'), JSON.stringify(datJSON))
      await dat.importFiles(archive, datJSONDir)
      stat = await archive.stat('/dat.json')
    }

    await this.localdb.put(datJSON.url.toString('hex'), {
      isWritable,
      lastModified: stat ? stat.mtime : lastModified,
      version: archive.version,
      rawJSON: datJSON,
      avroType: this._getAvroType(datJSON.p2pcommons.type).name
    })
  }

  async set (params) {
    assert(typeof params === 'object', ValidationError, 'object', params)
    assert(
      typeof params.url === 'string' || Buffer.isBuffer(params.url),
      ValidationError,
      "'string' or Buffer",
      params.url
    )

    // NOTE(dk): some properties are read only (license, follows, ...)
    const { url, ...mod } = params
    debug('set params', params)
    // Check if received keys are valid (editable)
    const receivedKeys = Object.keys(mod)
    const allowedProperties = this.allowedProperties()
    for (const key of receivedKeys) {
      if (!allowedProperties.includes(key)) {
        throw new InvalidKeyError(key)
      }
    }

    const { rawJSON: rawJSONFlatten, metadata } = await this.get(
      DatEncoding.encode(url)
    )

    if (!rawJSONFlatten) {
      // Note(dk): check if we need to search the module on the hyperdrive?
      throw new Error(`Module with url ${url} can not be found on localdb`)
    }

    // Check if keys values are valid (ie: non empty, etc)
    const avroType = this._getAvroType(rawJSONFlatten.type)
    const prepareMergeData = ({
      title,
      description,
      url,
      links,
      p2pcommons
    }) => {
      const out = {}
      if (typeof title === 'string') out.title = title
      if (typeof description === 'string') out.description = description
      if (typeof url === 'string') out.url = url
      if (links) out.links = links
      if (
        Object.keys(p2pcommons).length > 0 ||
        p2pcommons.constructor !== Object
      ) {
        out.p2pcommons = p2pcommons
      }

      return out
    }

    const finalJSON = deepMerge(
      this._unflatten(rawJSONFlatten),
      prepareMergeData(this._unflatten(mod))
    )
    debug('set', { finalJSON })
    assertValid(avroType, finalJSON)

    return this.saveItem({
      ...metadata,
      datJSON: finalJSON
    })
  }

  async get (key) {
    assert(
      typeof key === 'string' || Buffer.isBuffer(key),
      ValidationError,
      "'string' or Buffer",
      key
    )
    key = DatEncoding.encode(key)
    const dbitem = await this.localdb.get(key)
    debug('get', dbitem)
    const { rawJSON, ...metadata } = dbitem
    return { rawJSON: this._flatten(rawJSON), metadata }
  }

  async filterExact (feature, criteria) {
    assert(typeof feature === 'string', ValidationError, 'string', feature)
    assert(typeof criteria === 'string', ValidationError, 'string', criteria)
    return new Promise((resolve, reject) => {
      this.by[feature].get(criteria, (err, data) => {
        if (err) return reject(err)

        if (!Array.isArray(data)) return resolve([data])
        const { rawJSON, metadata } = data
        return resolve({ rawJSON: this._flatten(rawJSON), metadata })
      })
    })
  }

  async filter (feature, criteria) {
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
          const { rawJSON, ...metadata } = v
          const flattened = {
            rawJSON: this._flatten(rawJSON),
            metadata
          }
          out.push(flattened)
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
        const { rawJSON, ...metadata } = val
        if (metadata.isWritable && rawJSON.p2pcommons.type === 'content') {
          const flattened = {
            rawJSON: this._flatten(rawJSON),
            metadata
          }
          out.push(flattened)
        }
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
        const { rawJSON, ...metadata } = val
        if (metadata.isWritable && rawJSON.p2pcommons.type === 'profile') {
          const flattened = {
            rawJSON: this._flatten(rawJSON),
            metadata
          }
          out.push(flattened)
        }
      })
      s.on('end', () => resolve(out))
      s.on('error', reject)
    })
  }

  async list () {
    return new Promise((resolve, reject) => {
      const out = []
      const s = this.localdb.createValueStream()
      s.on('data', val => {
        const { rawJSON, ...metadata } = val
        if (metadata.isWritable) {
          const flattened = {
            rawJSON: this._flatten(rawJSON),
            metadata
          }
          out.push(flattened)
        }
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

  async register (contentKey, profileKey) {
    debug(`register contentKey: ${contentKey}`)
    debug(`register profileKey: ${profileKey}`)
    assert(
      typeof contentKey === 'string' || Buffer.isBuffer(contentKey),
      ValidationError,
      "'string' or Buffer",
      contentKey
    )
    assert(
      typeof profileKey === 'string' || Buffer.isBuffer(profileKey),
      ValidationError,
      "'string' or Buffer",
      profileKey
    )
    // fetch source and dest
    // 1 - try to get source from localdb
    let content
    try {
      debug('register: fetching content module from localdb')
      const { rawJSON } = await this.get(DatEncoding.encode(contentKey))
      content = rawJSON
    } catch (_) {
      // 2 - if no module is found on localdb, then fetch from hyperdrive
      // something like:
      debug(
        'register: content module was not found on localdb.\nFetching from swarm...'
      )
      const { drive: contentDat } = dat.open(contentKey) // NOTE(dk): be sure to check sparse options so we only dwld dat.json
      debug(`register: Found archive ${contentDat}`)
      debug('register: waiting for archive ready')
      await contentDat.ready()
      // 3 - after fetching module we still need to read the dat.json file
      try {
        content = await contentDat.readFile('dat.json')
      } catch (err) {
        if (this.verbose) {
          console.error(err)
        }
        throw new Error('Module not found')
      }
      // 4 - clone new module (move into its own method)
      // contentKey = datkey || datkey+version
      const folderPath = join(this.baseDir, contentKey)
      await ensureDir(folderPath)
      await writeFile(join(folderPath, 'dat.json'), JSON.stringify(content))
    }
    const contentUnflatten = this._unflatten(content)

    // 1 - try to get dest from localdb
    let profile
    try {
      const { rawJSON } = await this.get(DatEncoding.encode(profileKey))
      profile = rawJSON
    } catch (_) {
      // 2 - if no module is found on localdb, then fetch from hyperdrive
      // something like:
      const { drive: profileDat } = dat.open(profileKey) // NOTE(dk): be sure to check sparse options so we only dwld dat.json
      await profileDat.ready()
      // 3 - after fetching module we still need to read the dat.json file
      try {
        profile = await profileDat.readFile('dat.json')
      } catch (err) {
        throw new Error('Module not found')
      }
      //
      // 4 - clone the new module
      const folderPath = join(this.baseDir, profileKey)
      await ensureDir(folderPath)
      await writeFile(join(folderPath, 'dat.json'), JSON.stringify(profile))
    }

    const profileUnflatten = this._unflatten(profile)
    // TODO(dk): consider add custom errors for register and verification
    assert(
      contentUnflatten.p2pcommons.type === 'content',
      ValidationError,
      'content',
      contentUnflatten.p2pcommons.type
    )
    assert(
      profileUnflatten.p2pcommons.type === 'profile',
      ValidationError,
      'profile',
      profileUnflatten.p2pcommons.type
    )
    const profileType = this._getAvroType(profileUnflatten.p2pcommons.type)
    const profileValid = profileType.isValid(profileUnflatten)
    if (!profileValid) {
      throw new Error('Invalid profile module')
    }
    const contentType = this._getAvroType(contentUnflatten.p2pcommons.type)
    const contentValid = contentType.isValid(contentUnflatten)
    if (!contentValid) {
      throw new Error('Invalid content module')
    }

    // Note(dk): at this point is safe to save the new modules if necessary

    // if (contentUnflatten.p2pcommons.authors.length === 0) {
    //  throw new Error('Authors is empty')
    // }
    /*
     * Note(dk): omiting verification for now - WIP
    // verify content first
    const verified = await this.verify(content)

    if (!verified) {
      throw new Error('content module does not met the requirements')
    }
    */

    // register new content
    profileUnflatten.p2pcommons.contents.push(content.url)
    // update profile
    await this.set({
      url: profileUnflatten.url,
      contents: profileUnflatten.p2pcommons.contents
    })
  }

  async verify (source) {
    debug('verify', source)
    source = this._unflatten(source)
    assert(
      source.p2pcommons.type === 'content',
      ValidationError,
      'content',
      source.p2pcommons.type
    )
    // TODO(dk): check versions
    if (source.p2pcommons.authors.length === 0) return false
    return source.p2pcommons.authors.reduce(async (prevProm, authorKey) => {
      const prev = await prevProm
      // Note(dk): what if authorKey is not present on local db. fetch from swarm?
      const { rawJSON: profile } = await this.get(authorKey)
      return prev && profile.contents.includes(source.url)
    }, Promise.resolve(true))
  }

  async destroy (db = true, swarm = true) {
    if (db) {
      debug('closing db')
      await this.db.close()
      await this.localdb.close()
    }
    if (this.disableSwarm) return
    if (swarm) {
      debug('Closing networkers: ', this.networkers.length)
      for (const networker of this.networkers) {
        await networker.close()
      }
    }
  }
}

SDK.errors = { ValidationError, InvalidKeyError, MissingParam }

module.exports = SDK
