const { join, isAbsolute } = require('path')
const { homedir, tmpdir, platform } = require('os')
const {
  promises: { open, writeFile, readFile, readdir, stat: statFn }
} = require('fs')
const { ensureDir } = require('fs-extra')
const assert = require('nanocustomassert')
const level = require('level')
const sub = require('subleveldown')
const AutoIndex = require('level-auto-index')
const { Type } = require('@avro/types')
const crypto = require('hypercore-crypto')
const DatEncoding = require('dat-encoding')
const debug = require('debug')('p2pcommons')
const trash = require('trash')
const deepMerge = require('deepmerge')
const pRetry = require('p-retry')
const PCancelable = require('p-cancelable')
const pMemoize = require('p-memoize')
const Swarm = require('corestore-swarm-networking')
const dat = require('./lib/dat-helper')
const parse = require('./lib/parse-url')
const { validate, validatePartial, validateOnRegister, validateOnFollow, validateTitle, validateDescription, validateUrl, validateLinks, validateP2pcommons, validateType, validateSubtype, validateMain, validateAvatar, validateAuthors, validateParents, validateParentsOnUpdate, validateFollows, validateContents } = require('./lib/validate')
const Codec = require('./codec')
const ContentSchema = require('./schemas/content.json')
const ProfileSchema = require('./schemas/profile.json')
const ValidationTypes = require('./schemas/validation') // avro related validations

/**
 * @typedef {Object} Module
 * @property {object} rawJSON - Module's index.json object
 * @property {object} metadata - Module's metadata, this can contain latest version and modification time.
 */

const {
  InvalidKeyError,
  ValidationError,
  TypeError,
  MissingParam,
  EBUSYError
} = require('./lib/errors')
const { createIndexJSON, collect } = require('./lib/utils')

// helper assert fn
const assertValid = (type, val) => {
  return type.isValid(val, { errorHook })

  function errorHook (path, any, type) {
    let msg = `${path.join('.')}`
    if (type.typeName === 'record') {
      if (any !== null && typeof any === 'object') {
        const declared = new Set(type.fields.map(f => f.name))
        const extra = Object.keys(any).filter(n => !declared.has(n))
        msg = `extra fields (${extra.join(', ')})`
        throw new TypeError(msg, extra.join(', '))
      } else {
        msg += `not an object: ${any}`
        throw new Error(msg)
      }
    }
    throw new TypeError(
      type.name ? type.name : type._logicalTypeName,
      any,
      msg
    )
  }
}

const DEFAULT_SDK_OPTS = {
  persist: true,
  storage: undefined,
  versose: false,
  watch: true
}

const DEFAULT_GLOBAL_SETTINGS = {
  networkDepth: 2,
  defaultProfile: '',
  keys: '~/.p2pcommons/.dat',
  sparse: true,
  sparseMetadata: true
}

class SDK {
  constructor (opts = {}) {
    debug('constructor')
    const finalOpts = { ...DEFAULT_SDK_OPTS, ...opts }
    this.start = false
    this.platform = platform()
    // NOTE(dk): consider switch to envPaths usage
    this.home =
      process.env.HOME ||
      (this.windows && this.windowsHome()) ||
      homedir() ||
      tmpdir()
    this.windows = this.platform === 'win32'
    finalOpts.baseDir = finalOpts.baseDir || '.p2pcommons'
    this.baseDir = isAbsolute(finalOpts.baseDir)
      ? finalOpts.baseDir
      : join(this.home, finalOpts.baseDir)
    this.persist = finalOpts.persist
    this.storage = finalOpts.storage
    this.verbose = finalOpts.verbose
    this.dbPath = finalOpts.dbPath || this.baseDir
    this.watch = finalOpts.watch

    this.drives = new Map()
    this.stores = new Map() // deprecated
    this.drivesToWatch = new Map()

    this.dht = finalOpts.dht
    this.bootstrap = finalOpts.bootstrap

    // start hyperswarm
    this.disableSwarm = !!finalOpts.disableSwarm
    if (!this.disableSwarm) {
      this.swarmFn =
        finalOpts.swarm && typeof finalOpts.swarm === 'function'
          ? finalOpts.swarm
          : (...args) => new Swarm(...args)
    }

    // memoize methods
    this.ready = pMemoize(this.ready)
    // cancelable methods
    this.clone = PCancelable.fn(this.clone.bind(this))
    // debug constructor
    debug(`platform: ${this.platform}`)
    debug(`Is windows? ${!!this.windows}`)
    debug(`home: ${this.home}`)
    debug(`baseDir: ${this.baseDir}`)
    debug(`dbPath: ${this.dbPath}`)
    debug(`persist drives? ${!!this.persist}`)
    debug(`swarm enabled? ${!this.disableSwarm}`)
    debug(`watch enabled? ${this.watch}`)
  }

  allowedProperties () {
    return [
      'title',
      'description',
      'main',
      'subtype',
      'authors',
      'contents',
      'parents',
      'follows'
    ]
  }

  assertDatUrl (datUrl) {
    assert(
      typeof datUrl === 'string' || Buffer.isBuffer(datUrl),
      TypeError,
      "'string' or Buffer",
      datUrl,
      'datUrl'
    )
  }

  assertVersionedUrl (datUrl) {
    assert(typeof datUrl === 'string', TypeError, 'string', 'datUrl')
    const { version } = parse(datUrl)
    if (version !== 0 && !version) {
      throw new TypeError('versioned hyper url', datUrl, 'datUrl')
    }
    return true
  }

  assertModuleType (module, mType) {
    const unflatten = this._unflatten(module)
    assert(
      unflatten.p2pcommons.type === mType,
      TypeError,
      mType,
      unflatten.p2pcommons.type,
      'type'
    )
  }

  assertModule (module) {
    const unflatten = this._unflatten(module)
    const localProfileType = this._getAvroType(unflatten.p2pcommons.type)
    if (!localProfileType.isValid(unflatten)) {
      throw new Error('Invalid local profile module')
    }
  }

  _log (msg, level = 'log') {
    if (this.verbose) {
      console[level](msg)
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

  async _seed (archive, joinOpts = {}) {
    const dkey = DatEncoding.encode(archive.discoveryKey)

    this.drives.set(dkey, archive)

    if (!this.disableSwarm) {
      const defaultJoinOpts = {
        announce: true,
        lookup: true
      }

      await this.localdb.open()
      await this.seeddb.open()
      await this.seeddb.put(dkey, {
        key: dkey,
        opts: { ...defaultJoinOpts, ...joinOpts }
      })

      debug(`swarm seeding ${dkey}`)

      await this.networker.join(archive.discoveryKey, {
        ...defaultJoinOpts,
        ...joinOpts
      })

      archive.once('close', () => {
        debug(`closing archive ${dkey}...`)
        this.drives.delete(dkey)
      })
    }
  }

  async _reseed () {
    const driveList = await collect(this.seeddb)
    debug(`re-seeding ${driveList.length} modules...`)
    // Note(dk): latest corestore-swarm-networking has an async join
    const joins = driveList.map(item => {
      this.networker.join(item.key, item.opts)
    })
    await Promise.all(joins)
  }

  /**
   * handy method for getting the dar url with its version (if version is omitted then module is fetched to get the latest version)
   *
   * @private
   *
   * @param {(string|buffer)} datUrl
   * @returns {string}
   */
  async _getVersionedUrl (datUrl, version = null) {
    this.assertDatUrl(datUrl)

    const { version: versioned } = parse(datUrl)
    if (versioned) return datUrl

    if (version && typeof version === 'number') {
      return `${datUrl}+${version}`
    }

    const { versionedKey } = await this.clone(datUrl, null, false)
    if (!versionedKey) {
      throw new Error(`Unable to found module with hyper url: ${datUrl}`)
    }
    return versionedKey
  }

  async getOptionsOrCreate () {
    // read global settings or create with default values according to:
    // https://github.com/p2pcommons/specs/blob/main/interoperability.md#global-settings
    let options = { ...DEFAULT_GLOBAL_SETTINGS }
    try {
      const optionsFile = await readFile(
        join(this.baseDir, 'settings.json'),
        'utf-8'
      )
      options = JSON.parse(optionsFile)
      return options
    } catch (_) {
      // create missing settings.json file
      await writeFile(
        join(this.baseDir, 'settings.json'),
        JSON.stringify(options)
      )
      // default options
      return options
    }
  }

  async startdb () {
    return new Promise((resolve, reject) => {
      // start local db
      const registry = {}
      this.contentType = Type.forSchema(ContentSchema, {
        registry,
        logicalTypes: {
          title: ValidationTypes.Title,
          path: ValidationTypes.Path,
          'dat-url': ValidationTypes.DatUrl,
          'dat-versioned-url': ValidationTypes.DatUrlVersion
        }
      })
      this.profileType = Type.forSchema(ProfileSchema, {
        registry,
        logicalTypes: {
          title: ValidationTypes.Title,
          path: ValidationTypes.Path,
          'dat-url': ValidationTypes.DatUrl,
          'dat-versioned-url': ValidationTypes.DatUrlVersion
        }
      })
      const codec = new Codec(registry)

      level(join(this.dbPath, 'db'), { valueEncoding: codec }, (err, db) => {
        if (err) {
          this._log(err, 'error')
          return reject(err)
        }

        if (err instanceof level.errors.OpenError) {
          this._log('failed to open database', 'error')
          return reject(err)
        }
        this.db = db

        // create partitions - required by level-auto-index
        this.localdb = sub(this.db, 'localdb', {
          valueEncoding: codec
        })
        // create seeded modules partitions
        this.seeddb = sub(this.db, 'seeddb', {
          valueEncoding: 'json'
        })

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
        return resolve()
      })
    })
  }

  async refreshMTimes () {
    const modules = await collect(this.localdb)

    for (const {
      value: { rawJSON, ...metadata }
    } of modules) {
      const { host: urlString } = parse(rawJSON.url)

      const drive = dat.open(this.store, DatEncoding.decode(urlString), {
        sparse: this.globalOptions.sparse,
        sparseMetadata: this.globalOptions.sparseMetadata
      })
      await drive.ready()

      try {
        const moduleDir = join(this.baseDir, urlString)

        const statDrive = await drive.stat('/')
        const statDir = await statFn(moduleDir)
        const statDriveMtime = statDrive[0].mtime
        const statDirMtime = statDir.mtime

        const mtime =
          statDriveMtime.getTime() >= statDirMtime.getTime()
            ? statDriveMtime
            : statDirMtime

        const driveWatch = await dat.importFiles(drive, moduleDir, {
          watch: this.watch,
          keepExisting: false,
          dereference: true
        })

        if (this.watch) {
          this.drivesToWatch.set(
            DatEncoding.encode(drive.discoveryKey),
            driveWatch
          )
        }

        const unwatch = await new Promise(resolve => {
          const unwatch = drive.watch('', () => {
            resolve(unwatch)
          })
        })
        unwatch.destroy()

        if (metadata.lastModified.getTime() >= mtime.getTime()) continue

        // Note(dk): this looks like an heuristic...
        if (metadata.version === drive.version) {
          const files = await drive.readdir('/')
          const dirFiles = await readdir(moduleDir)
          if (dirFiles.length === files.length) continue
        }

        // update index.json file
        const module = await drive.readFile('index.json')
        const indexJSON = this._unflatten(JSON.parse(module))

        // update metadata
        metadata.lastModified = mtime
        metadata.version = drive.version
        // update localdb
        await this.localdb.put(urlString, {
          ...metadata,
          rawJSON: indexJSON,
          avroType: this._getAvroType(indexJSON.p2pcommons.type).name
        })
      } catch (err) {
        this._log(`refreshMTimes: ${err.message}`, 'error')
      }
    }
  }

  async createStore () {
    this.store = await dat.getDriveStorage({
      persist: this.persist,
      storageFn: this.storage,
      storageOpts: { storageLocation: this.baseDir },
      corestoreOpts: {}
    })

    this.store.on('error', err => {
      this._log(err.message, 'error')
    })
  }

  async startSwarm () {
    if (!this.disableSwarm) {
      this.networker = this.swarmFn(this.store, {
        announceLocalAddress: true,
        bootstrap: this.bootstrap
      })
      this.networker.on('error', console.error)
      if (typeof this.networker.listen === 'function') {
        // legacy method - unused by corestore-swarm-networking
        this.networker.listen()
      }
      debug('swarm listening...')

      await this._reseed()
    }
  }

  async ready () {
    if (this.start) {
      this._log('already started')
      return
    }
    try {
      // create db dir
      await ensureDir(this.dbPath)
      await ensureDir(this.baseDir)

      // read global options
      this.globalOptions = await this.getOptionsOrCreate()

      // start db
      await this.startdb()
      await this.db.open()
      await this.localdb.open()
      await this.seeddb.open()

      // create hyperdrive storage
      await this.createStore()
      // start swarm
      await this.startSwarm()

      // check latest mtimes
      await this.refreshMTimes()

      this.start = true
      return this.start
    } catch (err) {
      this._log(`Error starting the SDK: ${err.message}`, 'error')
      throw err
    }
  }

  /**
   * initialize a new module. This method will create a specific folder and seed the content if swarm is enabeld.
   *
   * @public
   * @async
   * @param {{
   *   type: String,
   *   title: String,
   *   subtype: String ,
   *   description: String,
   *   authors: Array,
   *   contents: Array,
   *   follows: Array,
   *   parents:Array
   * }}
   *
   * @returns {{ rawJSON: Object, metadata:Object }}
   */
  async init ({
    type,
    title = '',
    description = '',
    subtype = '',
    avatar = '',
    authors = [],
    parents = [],
    follows = [],
    contents = []
  }) {
    // follow module spec: https://github.com/p2pcommons/specs/pull/1/files?short_path=2d471ef#diff-2d471ef4e3a452b579a3367eb33ccfb9
    // 1. create folder with unique name (pk)
    // 2. initialize an hyperdrive inside
    // 3. createIndexJSON with the correct metadata and save it there

    validateType({ type })

    debug(`init ${type}`)

    await this.ready()

    // Note(dk): the pk will be used as a seed, it can be any string
    const { publicKey } = crypto.keyPair()

    const archive = await dat.create(this.store, publicKey, {
      hyperdrive: {
        sparse: this.globalOptions.sparse,
        sparseMetadata: this.globalOptions.sparseMetadata
      }
    })

    await archive.ready()

    const publicKeyString = DatEncoding.encode(archive.key)
    debug(`init pk ${publicKeyString}`)
    const moduleDir = join(this.baseDir, publicKeyString)
    await ensureDir(moduleDir)
    debug(`ensure module dir: ${moduleDir}`)

    // create index.json metadata
    const indexJSON = createIndexJSON({
      type,
      title,
      subtype,
      description,
      main: '',
      avatar,
      authors,
      parents,
      follows,
      contents,
      url: `hyper://${publicKeyString}`
    })

    await validatePartial(indexJSON)

    // Note(dk): validate earlier
    const avroType = this._getAvroType(type)

    assertValid(avroType, indexJSON)

    // write index.json
    await writeFile(join(moduleDir, 'index.json'), JSON.stringify(indexJSON))

    const driveWatch = await dat.importFiles(archive, moduleDir, {
      watch: this.watch,
      keepExisting: false,
      dereference: true
    })

    if (this.watch) {
      driveWatch.on('error', err => {
        if (err.code === 'EBUSY') {
          throw new EBUSYError(err.message, publicKeyString)
        }
      })
      this.drivesToWatch.set(
        DatEncoding.encode(archive.discoveryKey),
        driveWatch
      )
    }

    const unwatch = await new Promise(resolve => {
      const unwatch = archive.watch('index.json', () => {
        resolve(unwatch)
      })
    })
    unwatch.destroy()

    this._log(
      `Initialized new ${indexJSON.p2pcommons.type}, hyper://${publicKeyString}`
    )

    debug('init indexJSON', indexJSON)

    const stat = await archive.stat('/')
    const metadata = {
      // start hyperswarm
      isWritable: archive.writable,
      lastModified: stat[0].mtime,
      version: archive.version
    }

    await this.localdb.put(publicKeyString, {
      ...metadata,
      rawJSON: indexJSON,
      avroType: avroType.name
    })

    await this._seed(archive)

    this._log(
      `Saved new ${indexJSON.p2pcommons.type}, with key: ${publicKeyString}`
    )
    // Note(dk): flatten p2pcommons obj in order to have a more symmetrical API
    return { rawJSON: this._flatten(indexJSON), metadata, driveWatch }
  }

  async saveItem ({ isWritable, lastModified, version, indexJSON }) {
    debug('saveItem', indexJSON)
    assert(
      typeof isWritable === 'boolean',
      TypeError,
      'boolean',
      isWritable,
      'isWritable'
    )
    assert(
      typeof indexJSON === 'object',
      TypeError,
      'object',
      indexJSON,
      'indexJSON'
    )

    const keyString = DatEncoding.encode(indexJSON.url)
    const indexJSONDir = join(this.baseDir, keyString)

    let archive
    debug(`saveItem: looking drive ${keyString} in local structure...`)
    const dkey = DatEncoding.encode(
      crypto.discoveryKey(DatEncoding.decode(keyString))
    )
    archive = this.drives.get(version ? `${dkey}+${version}` : dkey)
    if (!archive) {
      debug(`saveItem: calling hyper open ${keyString}`)
      const drive = dat.open(this.store, DatEncoding.decode(indexJSON.url), {
        sparse: this.globalOptions.sparse,
        sparseMetadata: this.globalOptions.sparseMetadata
      })
      await drive.ready()
      archive = drive
    }

    let stat, mtime
    if (isWritable) {
      await writeFile(
        join(indexJSONDir, 'index.json'),
        JSON.stringify(indexJSON)
      )
      await dat.importFiles(archive, indexJSONDir)

      version = archive.version
      stat = await archive.stat('/index.json')
      mtime = stat[0].mtime
    }

    debug('updating cache value')
    // Note(dk): we are almost all the time fetching profiles without indicating any specific version so this is more effective
    this.drives.set(
      version && indexJSON.p2pcommons.type !== 'profile'
        ? `${dkey}+${version}`
        : dkey,
      archive
    )

    const lastM =
      mtime && mtime.getTime() >= lastModified.getTime() ? mtime : lastModified
    debug('saving item on local db')
    await this.localdb.put(DatEncoding.encode(indexJSON.url), {
      isWritable,
      lastModified: lastM,
      version: version,
      rawJSON: indexJSON,
      avroType: this._getAvroType(indexJSON.p2pcommons.type).name
    })

    return {
      rawJSON: this._flatten(indexJSON),
      metadata: {
        isWritable,
        lastModified: lastM,
        version
      }
    }
  }

  /**
   * updates module fields
   *
   * @public
   * @async
   * @link https://github.com/p2pcommons/specs/blob/main/module.md
   * @param {Object} module - Object containing field to update
   * @param {(String|Buffer)} module.url - module hyper url REQUIRED
   * @param {String} [module.title]
   * @param {String} [module.description]
   * @param {String} [module.main]
   * @param {String} [module.subtype]
   * @param {Array<String>} [module.authors] - only valid for content modules
   * @param {Array<String>} [module.contents] - only valid for profile modules
   */
  async set (params, force = false) {
    assert(
      typeof params === 'object',
      TypeError,
      'object',
      params,
      'params'
    )
    assert(
      typeof params.url === 'string' || Buffer.isBuffer(params.url),
      TypeError,
      "'string' or Buffer",
      params.url,
      'params.url'
    )

    await this.ready()

    // NOTE(dk): some properties are read only (type, license, url, ...)
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
    const { host: hyperdriveKey } = parse(rawJSONFlatten.url)

    if (!rawJSONFlatten) {
      // Note(dk): check if we need to search the module on the hyperdrive?
      throw new Error(`Module with url ${url} can not be found on localdb`)
    }

    if (!metadata.isWritable) {
      throw new Error(`Module with url ${url} is not writable`)
    }

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

    const overwriteMerge = (dest, source, options) => source
    const finalJSON = deepMerge(
      this._unflatten(rawJSONFlatten),
      prepareMergeData(this._unflatten(mod)),
      {
        arrayMerge: force ? overwriteMerge : null
      }
    )

    // check valid params
    if (!force) {
      if (params.contents !== undefined) {
        await validate(finalJSON, metadata, hyperdriveKey, this.baseDir)
        for (const content of params.contents) {
          const { version: contentVersion } = parse(content)
          const { rawJSON: contentJSON } = await this.clone(content, contentVersion)
          validateOnRegister(contentJSON, finalJSON.url)
        }
      } else {
        await validatePartial(finalJSON, metadata, hyperdriveKey, this.baseDir)
      }
      if (params.parents !== undefined) {
        await validateParentsOnUpdate(finalJSON, this)
      }
      if (params.follows !== undefined) {
        for (const follow of params.follows) {
          const { rawJSON: followJSON } = await this.clone(follow)
          validateOnFollow(followJSON)
        }
      }
      debug('set: valid params')
    }

    debug('set', { finalJSON })
    // Check if keys values are valid (ie: non empty, etc)
    const avroType = this._getAvroType(rawJSONFlatten.type)

    assertValid(avroType, finalJSON)

    debug('set: valid input')
    return this.saveItem({
      ...metadata,
      indexJSON: finalJSON
    })
  }

  /**
   * get a module from the localdb (leveldb)
   *
   * @public
   * @async
   * @param {(String|Buffer)} key - a valid hyper url
   * @returns {{ rawJSON:Object, metadata: Object }}
   */
  async get (key) {
    assert(
      typeof key === 'string' || Buffer.isBuffer(key),
      ValidationError,
      "'string' or Buffer",
      key,
      'key'
    )

    await this.ready()

    key = DatEncoding.encode(key)

    const dbitem = await this.localdb.get(key)
    debug('get', dbitem)
    const { rawJSON, ...metadata } = dbitem
    return { rawJSON: this._flatten(rawJSON), metadata }
  }

  async filterExact (feature, criteria) {
    assert(
      typeof feature === 'string',
      TypeError,
      'string',
      feature,
      'feature'
    )
    assert(
      typeof criteria === 'string',
      TypeError,
      'string',
      criteria,
      'criteria'
    )

    await this.ready()

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
      TypeError,
      'string',
      feature,
      'feature'
    )
    assert(
      typeof criteria === 'string',
      TypeError,
      'string',
      criteria,
      'criteria'
    )

    await this.ready()

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

  /**
   * list content modules
   *
   * @public
   * @async
   * @returns {Array<Object>}
   */
  async listContent () {
    await this.ready()
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

  /**
   * list profile modules
   *
   * @public
   * @async
   * @returns {Array<Object>}
   */
  async listProfiles () {
    await this.ready()
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
    await this.ready()
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

  /**
   * get a file descriptor for a given module url
   *
   * @public
   * @async
   * @param {String|Buffer} key - a valid hyper url
   * @returns {Number} fd - a file descriptor
   */
  async openFile (key) {
    assert(
      typeof key === 'string' || Buffer.isBuffer(key),
      TypeError,
      "'string' or Buffer",
      key,
      'key'
    )

    await this.ready()

    const { main } = await this.get(key)
    if (!main) {
      throw new Error('Empty main file')
    }
    return open(main)
  }

  /**
   * getDrive
   *
   * @description get drive from memory or swarm. Wrapper for calling dat.open and seeding.
   * @private
   * @param {(string|buffer)} key
   * @param {number} [version]
   * @returns {Object} hyper archive
   */
  async getDrive (key, version) {
    const keyBuffer = DatEncoding.decode(key)
    const dkey = DatEncoding.encode(crypto.discoveryKey(keyBuffer))
    const cacheKey = version ? `${dkey}+${version}` : dkey

    const archive = this.drives.get(cacheKey)
    if (archive) {
      debug(`getDrive: module found in cache with cachekey ${cacheKey}`)
      return archive
    }

    const drive = dat.open(this.store, keyBuffer, {
      sparse: true,
      sparseMetadata: true
    })

    debug(`getDrive: Found archive key ${key}`)
    debug('getDrive: Waiting for archive to be ready')
    await drive.ready()

    await this._seed(drive, { announce: true, lookup: true })

    return drive
  }

  /**
   * getFromSwarm
   *
   * @description if module isn't found locally, then fetch it from swarm
   * @private
   * @param {(string|buffer)} key - module url
   * @param {number} [version] - module version
   * @param {boolean} [download=true] - indicates if modules files should be downloaded or not
   * @returns {{
   *   Module,
   *   dwldHandle
   * }}
   */
  async getFromSwarm (key, version, download = true) {
    // if module isn't found locally, then fetch from swarm
    // something like:
    debug('clone: Module was not found in localdb.')
    const mKeyString = DatEncoding.encode(key)
    let moduleVersion, module, dwldHandle

    const moduleHyper = await this.getDrive(mKeyString, version)

    version = version || moduleHyper.version
    debug('clone: Module version', version)

    try {
      // 3 - after fetching module we still need to read the index.json file
      if (version !== 0) {
        moduleVersion = moduleHyper.checkout(version)
      } else {
        moduleVersion = moduleHyper
      }
      debug('clone: Reading modules index.json...')

      const getFile = async () => {
        try {
          return moduleVersion.readFile('index.json', 'utf-8')
        } catch (_) {}
      }

      const content = await pRetry(getFile, {
        onFailedAttempt: error => {
          this._log(
            `Failed attempt fetching index.json. ${error.attemptNumber}/${
              error.retriesLeft
            }`
          )
        },
        retries: 3,
        minTimeout: 500
      })

      module = JSON.parse(content)
      // NOTE (dk): we can consider have another map for checkouts only
      const dkey = DatEncoding.encode(moduleVersion.discoveryKey)
      this.drives.set(version ? `${dkey}+${version}` : dkey, moduleVersion)
    } catch (err) {
      this._log(err.message, 'error')
      throw new Error('clone: Problems fetching external module')
    }
    // 4 - clone new module (move into its own method)
    const modulePath = version ? `${mKeyString}+${version}` : `${mKeyString}`
    const folderPath = join(this.baseDir, modulePath)
    await ensureDir(folderPath)
    await writeFile(join(folderPath, 'index.json'), JSON.stringify(module))
    const stat = await moduleHyper.stat('index.json')

    if (download) {
      dwldHandle = dat.downloadFiles(moduleVersion, folderPath)
    }

    let lastMeta
    try {
      const { metadata } = await this.get(mKeyString)
      lastMeta = metadata
    } catch (_) {}

    // Note(dk): only update localdb if fetched module is more recent
    if (
      !lastMeta ||
      stat[0].mtime.getTime() > lastMeta.lastModified.getTime()
    ) {
      await this.localdb.put(DatEncoding.encode(module.url), {
        isWritable: moduleVersion.writable,
        lastModified: stat[0].mtime,
        version: Number(moduleVersion.version),
        rawJSON: module,
        avroType: this._getAvroType(module.p2pcommons.type).name
      })
    }

    return {
      rawJSON: module,
      metadata: {
        isWritable: moduleVersion.writable,
        lastModified: stat[0].mtime,
        version: Number(moduleVersion.version)
      },
      dwldHandle
    }
  }

  /**
   * getModule
   *
   * @description get module from local db, if its not found, module.rawJSON will be **undefined**
   * @private
   * @param {(string|buffer)} url - module hyper url
   * @returns {Module}
   */
  async getModule (url) {
    const mKeyString = DatEncoding.encode(url)
    let rawJSON, metadata
    try {
      // 1 - try to get content from localdb
      debug('clone: Fetching module from localdb')
      const out = await this.get(mKeyString)
      rawJSON = out.rawJSON
      metadata = out.metadata
    } catch (err) {
      this._log('module not found in local db', 'warn')
    }

    return {
      rawJSON,
      metadata
    }
  }

  /**
   * clone a module
   *
   * @public
   * @async
   * @param {(String|Buffer) }mKey - hyper url
   * @param {Number} [mVersion] - a module version
   * @returns {{
   *   rawJSON: Object,
   *   metadata: Object,
   *   versionedKey: String,
   *   dwldHandle: Object
   * }}
   */
  async clone (mKey, mVersion, download = true, onCancel) {
    // get module from localdb, if absent will query it from the swarm
    // this fn will also call seed() after retrieving the module from the swarm

    this.assertDatUrl(mKey)
    if (typeof mVersion === 'boolean') {
      download = mVersion
      mVersion = null
    }

    if (typeof mVersion === 'function') {
      onCancel = mVersion
      mVersion = null
      download = true
    }

    if (onCancel) {
      onCancel.shouldReject = false
    }

    await this.ready()

    let module
    let version
    let meta
    let dwldHandle

    const mKeyString = DatEncoding.encode(mKey)

    if (!mVersion) {
      const out = await this.getModule(mKeyString)
      module = out.rawJSON
      meta = out.metadata
    }

    if (!module) {
      const out = await this.getFromSwarm(mKey, mVersion, download)
      module = out.rawJSON
      meta = out.metadata
      dwldHandle = out.dwldHandle
    }

    return {
      rawJSON: this._flatten(module),
      versionedKey: `hyper://${mKeyString}+${version}`,
      metadata: meta,
      dwldHandle
    }
  }

  /**
   * register a content module to a profile
   *
   * @public
   * @async
   * @link https://github.com/p2pcommons/specs/blob/main/module.md#registration
   * @param {(String|Buffer)} contentKey - hyper url
   * @param {(String|Buffer)} profileKey - hyper url
   */
  async register (contentKey, profileKey) {
    debug(`register contentKey: ${contentKey}`)
    debug(`register profileKey: ${profileKey}`)

    // profile.p2pcommons.contents.push(cKeyVersion)
    // update profile
    await this.set({
      url: profileKey,
      contents: [contentKey]
    })

    this._log('register: profile updated successfully')
  }

  /**
   * verify a given module
   *
   * @public
   * @async
   * @link https://github.com/p2pcommons/specs/blob/main/module.md#verification
   * @param {String} datUrl - a versioned hyper url
   * @returns {Boolean} - true if module is verified, false otherwise
   */
  async verify (datUrl) {
    debug('verify %s', datUrl)
    const { host: url, version } = parse(datUrl)
    if (!version) {
      throw new Error('Module can not be verified: unversioned content')
    }
    await this.ready()

    const { rawJSON: module } = await this.clone(url, version, false)

    assert(
      module.type === 'content',
      TypeError,
      'content',
      module.type,
      'type'
    )

    if (module.authors.length === 0) return false
    return module.authors.reduce(async (prevProm, authorKey) => {
      const prev = await prevProm
      const { rawJSON: profile } = await this.clone(authorKey, null, false)
      return prev && profile.contents.includes(datUrl)
    }, Promise.resolve(true))
  }

  /**
   * deregister content from a user's profile
   *
   * @param {(String)} contentKey - contentKey should include the version
   * @param {(String|Buffer)} profileKey
   */
  async deregister (contentKey, profileKey) {
    assert(
      typeof contentKey === 'string' || Buffer.isBuffer(contentKey),
      TypeError,
      "'string' or Buffer",
      contentKey,
      'contentKey'
    )
    assert(
      typeof profileKey === 'string' || Buffer.isBuffer(profileKey),
      TypeError,
      "'string' or Buffer",
      profileKey,
      'profileKey'
    )
    debug('deregister')

    await this.ready()

    const { rawJSON: profile, metadata } = await this.clone(profileKey, false)

    if (!metadata.isWritable) {
      throw new Error('profile is not writable')
    }

    if (!profile) {
      throw new Error(
        `profile with key ${DatEncoding.encode(profileKey)} not found`
      )
    }

    const { host: cKey, version: contentVersion } = parse(contentKey)
    if (!contentVersion) {
      this._log('content url does not include version', 'warn')
    }

    const { rawJSON: content, versionedKey } = await this.clone(
      cKey,
      contentVersion,
      false
    )
    if (!content) {
      this._log(`content with key ${cKey} not found`)
      return
    }

    // everything is valid, removing content from contents
    profile.contents.splice(profile.contents.indexOf(versionedKey), 1)

    await this.set(
      {
        url: profile.url,
        contents: profile.contents
      },
      true
    )
  }

  /**
   * follow a profile
   * @public
   * @async
   * @param {string} localProfileUrl - local profile hyper url
   * @param {string} targetProfileUrl - target profile hyper url
   */
  async follow (localProfileUrl, targetProfileUrl) {
    debug('follow')

    // update profile
    await this.set({
      url: localProfileUrl,
      follows: [targetProfileUrl]
    })

    this._log('follow: profile updated successfully')
  }

  /**
   * localProfile unfollows a targetProfile
   *
   * @public
   * @async
   * @param {(string|buffer)} localProfileUrl - hyper url
   * @param {(string|buffer)} targetProfileUrl - hyper url
   */
  async unfollow (localProfileUrl, targetProfileUrl) {
    this.assertDatUrl(localProfileUrl)
    this.assertDatUrl(targetProfileUrl)

    debug('unfollow')

    await this.ready()

    // Fetching localProfile module
    const { rawJSON: localProfile, metadata } = await this.clone(
      localProfileUrl,
      false
    )

    if (!localProfile) {
      throw new Error('Module not found')
    }

    if (!metadata.isWritable) {
      throw new Error('local profile is not writable')
    }

    this.assertModuleType(localProfile, 'profile')

    this.assertModule(localProfile)

    const { host: targetProfileKey, version: targetProfileVersion } = parse(
      targetProfileUrl
    )

    // Fetching targetProfile module
    debug(
      `follow: fetching module with key: ${targetProfileKey} and version: ${targetProfileVersion}`
    )
    const { rawJSON: targetProfile } = await this.clone(
      targetProfileKey,
      targetProfileVersion,
      false
    )

    if (!targetProfile) {
      throw new Error('Module not found')
    }

    this.assertModuleType(targetProfile, 'profile')

    this.assertModule(targetProfile)

    // everything is valid, removing profile
    const finalTargetProfileKey = targetProfileVersion
      ? `hyper://${targetProfileKey}+${targetProfileVersion}`
      : `hyper://${targetProfileKey}`

    const idx = localProfile.follows.indexOf(finalTargetProfileKey)
    if (idx !== -1) {
      localProfile.follows.splice(idx, 1)
    }

    await this.set(
      {
        url: localProfile.url,
        follows: localProfile.follows
      },
      true
    )

    this._log('unfollow: profile updated successfully')
  }

  /**
   * delete a module. This method will remove the module from the localdb and seeddb. It will also close the drive.
   *
   * @public
   * @async
   * @param {(String|Buffer)} key - a valid hyper url
   * @param {boolean} deleteFiles - if true, then moves the drive folder to the trash bin
   */
  async delete (key, deleteFiles = false) {
    assert(
      typeof key === 'string' || Buffer.isBuffer(key),
      TypeError,
      "'string' or Buffer",
      key,
      'key'
    )

    debug('delete')

    await this.ready()

    const keyString = DatEncoding.encode(key)
    const dkeyString = DatEncoding.encode(
      crypto.discoveryKey(DatEncoding.decode(key))
    )
    const { rawJSON: module, metadata } = await this.get(key)
    if (!metadata.isWritable) {
      this._log('delete: drive is not writable')
      return
    }
    try {
      if (module.type === 'content') {
        // deregister from profiles
        const profiles = await this.listProfiles()

        for (const { rawJSON: prof } of profiles) {
          await this.deregister(key, prof.url)
        }
      }
      await this.localdb.del(keyString)
      await this.seeddb.del(dkeyString)

      const drivePath = join(this.baseDir, keyString)

      if (deleteFiles) {
        debug(`Moving drive folde ${drivePath} to trash bin`)
        await trash(drivePath)
      }

      const drive = this.drives.get(dkeyString) // if drive is open in memory we can close it
      // Note(dk): what about the checkouts? this can be dkey + version
      // maybe keep things inside a map structure would be better -> map of maps
      if (drive) {
        await drive.close()
      }
      if (!this.disableSwarm) {
        await this.networker.leave(dkeyString)
      }
    } catch (err) {
      debug('delete: %O', err)
      console.error('Something went wrong with delete')
    }
  }

  /**
   * shutdown a sdk instance closing all the open hyperdrives
   *
   * @public
   * @async
   * @param {Boolean} db=true - if true it will close all the internal databases
   * @param {Boolean} swarm=true - if true it will close the swarm
   */
  async destroy (db = true, swarm = true) {
    if (this.watch) {
      for (const mirror of this.drivesToWatch.values()) {
        mirror.destroy()
      }
    }

    if (db) {
      debug('closing db...')
      try {
        if (this.localdb) await this.localdb.close()
        if (this.seeddb) await this.seeddb.close()
        if (this.db) await this.db.close()
      } catch (err) {
        this._log(err.message, 'error')
      }
      debug('db successfully closed')
    }

    if (swarm && this.networker) {
      for (const drive of this.drives.values()) {
        if (drive.closing && !drive.closed) {
          await drive.close()
        }
      }
      debug('closing swarm...')
      try {
        await this.networker.close()
      } catch (err) {
        this._log(err.message, 'error')
      }

      debug('swarm successfully closed')
    }

    this.start = false
  }
}

SDK.errors = { ValidationError, TypeError, InvalidKeyError, MissingParam, EBUSYError }

SDK.validate = { validate, validatePartial, validateOnRegister, validateOnFollow, validateTitle, validateDescription, validateUrl, validateLinks, validateP2pcommons, validateType, validateSubtype, validateMain, validateAvatar, validateAuthors, validateParents, validateParentsOnUpdate, validateFollows, validateContents }

module.exports = SDK
