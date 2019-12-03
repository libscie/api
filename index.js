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
const crypto = require('hypercore-crypto')
const parse = require('parse-dat-url')
const DatEncoding = require('dat-encoding')
const debug = require('debug')('p2pcommons')
const deepMerge = require('deepmerge')
const dat = require('./lib/dat-helper')
const Swarm = require('hyperswarm')
const pump = require('pump')
const protocol = require('hypercore-protocol')
const Codec = require('./codec')
const ContentSchema = require('./schemas/content.json')
const ProfileSchema = require('./schemas/profile.json')
const ValidationTypes = require('./validation')
const {
  InvalidKeyError,
  ValidationError,
  MissingParam
} = require('./lib/errors')

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
    let msg = `${path.join('.')}`
    if (type.typeName === 'record') {
      if (any !== null && typeof any === 'object') {
        const declared = new Set(type.fields.map(f => f.name))
        const extra = Object.keys(any).filter(n => !declared.has(n))
        msg += `extra fields (${extra.join(', ')})`
        throw new Error(msg)
      } else {
        msg += `not an object: ${any}`
        throw new Error(msg)
      }
    }
    throw new ValidationError(
      type.name ? type.name : type._logicalTypeName,
      any,
      msg
    )
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
    this.drives = new Map()

    this.disableSwarm = !!opts.disableSwarm

    if (!this.disableSwarm) {
      this.networker = Swarm()
      this.networker.on('error', console.error)
      debug('swarm listening...')
      this.networker.on('connection', (socket, info) => {
        this._replicate(socket, info, (stream, discoveryKey) => {
          const drive = this.drives.get(DatEncoding.encode(discoveryKey))
          if (!drive) {
            if (this.verbose) {
              console.error(
                `No drive found for key ${DatEncoding.encode(discoveryKey)}`
              )
            }

            return
          }
          drive.replicate({ live: true, stream })
        })
      })
    }
  }

  _replicate (socket, info, handle) {
    const isInitiator = !!info.client
    const protocolStream = protocol({ live: true })
    if (isInitiator) {
      handle(protocolStream, info.peer.topic)
    } else {
      protocolStream.on('feed', discoveryKey => {
        handle(protocolStream, discoveryKey)
      })
    }
    pump(socket, protocolStream, socket, err => {
      debug(err.message)
      if (this.verbose) {
        console.warn(err.message)
      }
    })
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

  _seed (archive) {
    if (!this.disableSwarm) {
      const dkey = DatEncoding.encode(archive.discoveryKey)
      this.drives.set(dkey, archive)

      debug(`swarm seeding ${dkey}`)
      this.networker.join(archive.discoveryKey, {
        announce: true,
        lookup: true
      })

      archive.once('close', () => {
        if (this.verbose) {
          console.log(`closing archive ${dkey}...`)
        }
        this.networker.leave(archive.discoveryKey)
      })
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
    assert(typeof type === 'string', ValidationError, 'string', type, 'type')
    assert(
      type === 'profile' || type === 'content',
      ValidationError,
      "'content' or 'profile'",
      type,
      'type'
    )
    assert(typeof title === 'string', ValidationError, 'string', title, 'title')
    assert(
      typeof subtype === 'string',
      ValidationError,
      'string',
      subtype,
      'subtype'
    )

    debug(`init ${type}`)

    const { publicKey, secretKey } = crypto.keyPair()
    debug(`init pk ${publicKey.toString('hex')}`)

    // NOTE(dk): check out datStorage options: https://github.com/RangerMauve/universal-dat-storage#api
    datOpts.datStorage.storageLocation = datOpts.datStorage.storageLocation
      ? datOpts.datStorage.storageLocation
      : join(this.baseDir, publicKey.toString('hex'))
    debug(`init storageLocation ${datOpts.datStorage.storageLocation}`)

    await ensureDir(datOpts.datStorage.storageLocation)
    const { drive: archive } = dat.create(
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
      this._seed(archive)
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
    const metadata = {
      isWritable: archive.writable,
      lastModified: stat.mtime,
      version: archive.version
    }
    await this.saveItem({
      ...metadata,
      datJSON
    })

    if (this.verbose) {
      console.log(`Saved new ${datJSON.p2pcommons.type}, with key: ${hash}`)
    }
    // Note(dk): flatten p2pcommons obj in order to have a more symmetrical API
    return { rawJSON: this._flatten(datJSON), metadata }
  }

  async saveItem ({ isWritable, lastModified, version, datJSON }) {
    debug('saveItem', datJSON)
    assert(
      typeof isWritable === 'boolean',
      ValidationError,
      'boolean',
      isWritable,
      'isWritable'
    )
    assert(
      typeof datJSON === 'object',
      ValidationError,
      'object',
      datJSON,
      'datJSON'
    )

    const datJSONDir = join(this.baseDir, datJSON.url.toString('hex'))
    const storageOpts = {
      storageLocation: join(this.baseDir, datJSON.url.toString('hex'))
    }
    const { drive: archive } = dat.open(
      datJSON.url.toString('hex'),
      undefined,
      storageOpts
    )
    await archive.ready()

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
    assert(
      typeof params === 'object',
      ValidationError,
      'object',
      params,
      'params'
    )
    assert(
      typeof params.url === 'string' || Buffer.isBuffer(params.url),
      ValidationError,
      "'string' or Buffer",
      params.url,
      'params.url'
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
      key,
      'key'
    )
    key = DatEncoding.encode(key)
    const dbitem = await this.localdb.get(key)
    debug('get', dbitem)
    const { rawJSON, ...metadata } = dbitem
    return { rawJSON: this._flatten(rawJSON), metadata }
  }

  async filterExact (feature, criteria) {
    assert(
      typeof feature === 'string',
      ValidationError,
      'string',
      feature,
      'feature'
    )
    assert(
      typeof criteria === 'string',
      ValidationError,
      'string',
      criteria,
      'criteria'
    )
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
    assert(
      typeof feature === 'string',
      ValidationError,
      'string',
      feature,
      'feature'
    )
    assert(
      typeof criteria === 'string',
      ValidationError,
      'string',
      criteria,
      'criteria'
    )
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
    assert(typeof key === 'string', ValidationError, 'string', key, 'key')
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
      contentKey,
      'contentKey'
    )
    assert(
      typeof profileKey === 'string' || Buffer.isBuffer(profileKey),
      ValidationError,
      "'string' or Buffer",
      profileKey,
      'profileKey'
    )
    const { host: cKey, version: contentVersion } = parse(contentKey)
    const { host: pKey, version: profileVersion } = parse(profileKey)
    // fetch source and dest
    // 1 - try to get source from localdb
    let content
    try {
      debug('register: fetching content module from localdb')
      const { rawJSON } = await this.get(DatEncoding.encode(cKey))
      content = rawJSON
    } catch (_) {
      // 2 - if no module is found on localdb, then fetch from hyperdrive
      // something like:
      debug(
        'register: content module was not found on localdb.\nFetching from swarm...'
      )

      const { drive: contentDat } = dat.open(cKey) // NOTE(dk): be sure to check sparse options so we only dwld dat.json
      debug('register: Found archive')
      debug('register: waiting for archive ready')

      await contentDat.ready()

      this._seed(contentDat)
      await dat.reallyReady(contentDat)

      const cVersion = contentVersion || contentDat.version
      debug('content version', cVersion)
      // 3 - after fetching module we still need to read the dat.json file
      try {
        const contentVersion = await contentDat.checkout(cVersion)

        await contentVersion.ready()

        // Note(dk): revisit this delay
        // readfile delay, taken from  https://github.com/datproject/sdk/blob/master/promise.js#L285
        await setTimeout(() => {
          return Promise.resolve()
        }, 1000)

        content = JSON.parse(await contentVersion.readFile('dat.json'))
      } catch (err) {
        if (this.verbose) {
          console.error(err)
        }
        throw new Error('Problems fetching external module')
      }
      // 4 - clone new module (move into its own method)
      // contentPath = datkey || datkey+version
      const contentPath = `${cKey}+${cVersion}`
      const folderPath = join(this.baseDir, contentPath)
      await ensureDir(folderPath)
      await writeFile(join(folderPath, 'dat.json'), JSON.stringify(content))
    }
    const contentUnflatten = this._unflatten(content)

    // 1 - try to get dest from localdb
    let profile
    try {
      const { rawJSON } = await this.get(DatEncoding.encode(pKey))
      profile = rawJSON
    } catch (_) {
      // 2 - if no module is found on localdb, then fetch from hyperdrive
      // something like:
      const { drive: profileDat } = dat.open(pKey) // NOTE(dk): be sure to check sparse options so we only dwld dat.json
      await profileDat.ready()
      this._seed(profileDat)

      const pVersion = profileVersion
        ? `${profileVersion}`
        : `${profileDat.version}`

      debug('profile version', pVersion)
      // 3 - after fetching module we still need to read the dat.json file
      try {
        const profileVersion = await profileDat.checkout(pVersion)

        // Note(dk): revisit this delay
        // readfile delay, taken from  https://github.com/datproject/sdk/blob/master/promise.js#L285
        await setTimeout(() => {
          return Promise.resolve()
        }, 1000)

        profile = JSON.parse(await profileVersion.readFile('dat.json'))
      } catch (err) {
        if (this.verbose) {
          console.error(err)
        }
        throw new Error('Problems fetching external module')
      }
      // 4 - clone the new module
      const profilePath = `${pKey}+${pVersion}`
      const folderPath = join(this.baseDir, profilePath)
      await ensureDir(folderPath)
      await writeFile(join(folderPath, 'dat.json'), JSON.stringify(profile))
    }

    const profileUnflatten = this._unflatten(profile)
    // TODO(dk): consider add custom errors for register and verification
    assert(
      contentUnflatten.p2pcommons.type === 'content',
      ValidationError,
      'content',
      contentUnflatten.p2pcommons.type,
      'type'
    )
    assert(
      profileUnflatten.p2pcommons.type === 'profile',
      ValidationError,
      'profile',
      profileUnflatten.p2pcommons.type,
      'type'
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
    debug('register: successful')
  }

  async verify (source) {
    debug('verify', source)
    source = this._unflatten(source)
    assert(
      source.p2pcommons.type === 'content',
      ValidationError,
      'content',
      source.p2pcommons.type,
      'type'
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
    if (swarm) {
      this.networker.destroy(err => {
        if (err) throw new Error(err)
        this.swarm = null
      })
    }
  }
}

SDK.errors = { ValidationError, InvalidKeyError, MissingParam }

module.exports = SDK
