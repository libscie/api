const { join, isAbsolute } = require('path')
const { homedir, tmpdir, platform } = require('os')
const {
  promises: { open, writeFile, readFile }
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
const Swarm = require('corestore-swarm-networking')
const pump = require('pump')
const protocol = require('hypercore-protocol')
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
const { createDatJSON, collect } = require('./lib/utils')

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

const DEFAULT_SDK_OPTS = {
  persist: true,
  storage: undefined,
  versose: false
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

    this.drives = new Map()
    this.stores = new Map() // deprecated

    // start hyperswarm
    this.disableSwarm = !!finalOpts.disableSwarm
    this.swarmFn =
      finalOpts.swarm && typeof finalOpts.swarm === 'function'
        ? finalOpts.swarm
        : (...args) => new Swarm(...args)
    // debug constructor
    debug(`platform: ${this.platform}`)
    debug(`Is windows? ${!!this.windows}`)
    debug(`home: ${this.home}`)
    debug(`baseDir: ${this.baseDir}`)
    debug(`dbPath: ${this.dbPath}`)
    debug(`persist drives? ${!!this.persist}`)
    debug(`swarm enabled? ${!this.disableSwarm}`)
  }

  allowedProperties () {
    return ['title', 'description', 'main', 'subtype', 'authors', 'contents']
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

      await this.seeddb.put(dkey, {
        key: dkey,
        opts: { ...defaultJoinOpts, ...joinOpts }
      })

      debug(`swarm seeding ${dkey}`)

      this.networker.seed(archive.discoveryKey, {
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
    debug('re-seeding modules...')
    const driveList = await collect(this.seeddb)
    for (const { key: discoveryKey, opts } of driveList) {
      this.networker.seed(discoveryKey, opts)
    }
  }

  async getOptionsOrCreate () {
    // read global settings or create with default values according to:
    // https://github.com/p2pcommons/specs/blob/master/interoperability.md#global-settings
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
      level(join(this.dbPath, 'db'), { valueEncoding: codec }, (err, db) => {
        if (err instanceof level.errors.OpenError) {
          this._log('failed to open database', 'error')
          return reject(err)
        }
        this.db = db
        // create partitions - required by level-auto-index
        this.localdb = sub(this.db, 'localdb', { valueEncoding: codec })
        // create seeded modules partitions
        this.seeddb = sub(this.db, 'seeddb', { valueEncoding: 'json' })

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

  async createStore () {
    this.store = await dat.getDriveStorage({
      persist: this.persist,
      storageFn: this.storage,
      storageOpts: { storageLocation: this.baseDir },
      corestoreOpts: { sparse: true, stats: true }
    })
  }

  async startSwarm () {
    if (!this.disableSwarm) {
      this.networker = this.swarmFn(this.store)
      this.networker.on('error', console.error)
      this.networker.listen()
      debug('swarm listening...')

      await this._reseed()
    }
  }

  async ready () {
    try {
      // create db dir
      await ensureDir(this.dbPath)
      await ensureDir(this.baseDir)

      // read global options
      this.globalOptions = await this.getOptionsOrCreate()

      // start db
      await this.startdb()
      // create hyperdrive storage
      await this.createStore()
      // start swarm
      await this.startSwarm()
    } catch (err) {
      console.error(err)
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
   *   main: String,
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
    title,
    subtype = '',
    description = '',
    main = '',
    authors = [],
    contents = [],
    follows = [],
    parents = []
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

    // create dat.json metadata
    const datJSON = createDatJSON({
      type,
      title,
      subtype,
      description,
      main,
      authors,
      parents,
      follows,
      contents,
      url: `dat://${publicKeyString}`
    })

    // Note(dk): validate earlier
    const avroType = this._getAvroType(type)

    assertValid(avroType, datJSON)

    // write dat.json
    await writeFile(join(moduleDir, 'dat.json'), JSON.stringify(datJSON))

    await dat.importFiles(archive, moduleDir)

    this._log(
      `Initialized new ${datJSON.p2pcommons.type}, dat://${publicKeyString}`
    )

    debug('init datJSON', datJSON)

    const stat = await archive.stat('dat.json')
    const metadata = {
      // start hyperswarm
      isWritable: archive.writable,
      lastModified: stat.mtime,
      version: archive.version
    }

    await this.saveItem({
      ...metadata,
      datJSON
    })

    this._log(
      `Saved new ${datJSON.p2pcommons.type}, with key: ${publicKeyString}`
    )
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

    const keyString = DatEncoding.encode(datJSON.url)
    const datJSONDir = join(this.baseDir, keyString)

    let archive
    debug(`saveItem: looking drive ${keyString} in local structure...`)
    const dkey = DatEncoding.encode(
      crypto.discoveryKey(DatEncoding.decode(datJSON.url))
    )
    archive = this.drives.get(dkey)

    if (!archive) {
      debug(`saveItem: calling dat open ${keyString}`)
      const drive = await dat.open(
        this.store,
        DatEncoding.decode(datJSON.url),
        {
          sparse: this.globalOptions.sparse,
          sparseMetadata: this.globalOptions.sparseMetadata
        }
      )
      await drive.ready()
      archive = drive
    }

    let stat
    if (isWritable) {
      await writeFile(join(datJSONDir, 'dat.json'), JSON.stringify(datJSON))
      await dat.importFiles(archive, datJSONDir)

      version = archive.version
      stat = await archive.stat('/dat.json')
      await this._seed(archive)
    }

    debug('saving item on local db')
    await this.localdb.put(DatEncoding.encode(datJSON.url), {
      isWritable,
      lastModified: stat ? stat.mtime : lastModified,
      version: version,
      rawJSON: datJSON,
      avroType: this._getAvroType(datJSON.p2pcommons.type).name
    })
  }

  /**
   * updates module fields
   *
   * @public
   * @async
   * @link https://github.com/p2pcommons/specs/blob/master/module.md
   * @param {Object} module - Object containing field to update
   * @param {(String|Buffer)} module.url - module dat url REQUIRED
   * @param {String} [module.title]
   * @param {String} [module.description]
   * @param {String} [module.main]
   * @param {String} [module.subtype]
   * @param {Array<String>} [module.authors] - only valid for content modules
   * @param {Array<String>} [module.contents] - only valid for profile modules
   */
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
    const overwriteMerge = (destinationArray, sourceArray, options) =>
      sourceArray
    const finalJSON = deepMerge(
      this._unflatten(rawJSONFlatten),
      prepareMergeData(this._unflatten(mod)),
      {
        arrayMerge: overwriteMerge
      }
    )
    debug('set', { finalJSON })
    assertValid(avroType, finalJSON)

    await this.saveItem({
      ...metadata,
      datJSON: finalJSON
    })
  }

  /**
   * get a module from the localdb (leveldb)
   *
   * @public
   * @async
   * @param {(String|Buffer)} key - a valid dat url
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

  /**
   * list content modules
   *
   * @public
   * @async
   * @returns {Array<Object>}
   */
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

  /**
   * list profile modules
   *
   * @public
   * @async
   * @returns {Array<Object>}
   */
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

  /**
   * get a file descriptor for a given module url
   *
   * @public
   * @async
   * @param {String|Buffer} key - a valid dat url
   * @returns {Number} fd - a file descriptor
   */
  async openFile (key) {
    assert(
      typeof key === 'string' || Buffer.isBuffer(key),
      ValidationError,
      "'string' or Buffer",
      key,
      'key'
    )
    const { main } = await this.get(key)
    if (!main) {
      throw new Error('Empty main file')
    }
    return open(main)
  }

  async _getModule (mKey, mVersion) {
    // get module from localdb, if absent will query it from the swarm
    // this fn will also call seed() after retrieving the module from the swarm
    let module
    let version
    let meta
    let stat
    try {
      // 1 - try to get content from localdb
      debug('_getModule: Fetching module from localdb')
      const { rawJSON, metadata } = await this.get(DatEncoding.encode(mKey))
      module = rawJSON
      version = metadata.version
      meta = metadata
    } catch (_) {
      // 2 - if no module is found on localdb, then fetch from hyperdrive
      // something like:
      debug(
        '_getModule: Module was not found on localdb.\nFetching from swarm...'
      )

      const _getDat = async key => {
        const keyBuffer = DatEncoding.decode(key)
        const archive = this.drives.get(
          DatEncoding.encode(crypto.discoveryKey(keyBuffer))
        )
        if (!archive) {
          const drive = await dat.open(this.store, keyBuffer, {
            sparse: this.globalOptions.sparse,
            sparseMetadata: this.globalOptions.sparseMetadata
          })

          return drive
        }

        return archive
      }

      const moduleDat = await _getDat(mKey)

      debug(`_getModule: Found archive key ${DatEncoding.encode(mKey)}`)
      debug('_getModule: Waiting for archive ready')

      await moduleDat.ready()

      await this._seed(moduleDat)

      version = mVersion || moduleDat.version
      debug('_getModule: Module version', version)
      // 3 - after fetching module we still need to read the dat.json file
      try {
        const moduleVersion = moduleDat.checkout(version)
        debug('_getModule: Reading modules dat.json...')
        module = JSON.parse(await moduleVersion.readFile('dat.json'))
      } catch (err) {
        this._log(err.message, 'error')
        throw new Error('_getModule: Problems fetching external module')
      }
      // 4 - clone new module (move into its own method)
      // modulePath = datkey || datkey+version
      const modulePath = `${mKey}+${version}`
      const folderPath = join(this.baseDir, modulePath)
      await ensureDir(folderPath)
      await writeFile(join(folderPath, 'dat.json'), JSON.stringify(module))
      stat = await moduleDat.stat('dat.json')
    }

    return {
      module: this._unflatten(module),
      version,
      versionedKey: `dat://${mKey}+${version}`,
      metadata: meta || {
        isWritable: module.writable,
        lastModified: stat.mtime,
        version: module.version
      }
    }
  }

  /**
   * publish a content module to a profile
   *
   * @public
   * @async
   * @link https://github.com/p2pcommons/specs/blob/master/module.md#registration
   * @param {(String|Buffer)} contentKey - a dat url
   * @param {(String|Buffer)} profileKey - a dat url
   */
  async publish (contentKey, profileKey) {
    debug(`publish contentKey: ${contentKey}`)
    debug(`publish profileKey: ${profileKey}`)
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
    if (!contentVersion) {
      this._log('Content version is not found. Using latest version.')
    }
    // fetch content and profile
    const {
      module: content,
      versionedKey: cKeyVersion
    } = await this._getModule(cKey, contentVersion)

    const { module: profile } = await this._getModule(pKey, profileVersion)

    // TODO(dk): consider add custom errors for publish and verification
    assert(
      content.p2pcommons.type === 'content',
      ValidationError,
      'content',
      content.p2pcommons.type,
      'type'
    )
    assert(
      profile.p2pcommons.type === 'profile',
      ValidationError,
      'profile',
      profile.p2pcommons.type,
      'type'
    )
    const profileType = this._getAvroType(profile.p2pcommons.type)
    const profileValid = profileType.isValid(profile)
    if (!profileValid) {
      throw new Error('Invalid profile module')
    }
    const contentType = this._getAvroType(content.p2pcommons.type)
    const contentValid = contentType.isValid(content)
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

    // publish new content
    if (profile.p2pcommons.contents.includes(cKeyVersion)) {
      this._log('publish: Content was already published', 'warn')
      return
    }

    profile.p2pcommons.contents.push(cKeyVersion)
    // update profile
    await this.set({
      url: profile.url,
      contents: profile.p2pcommons.contents
    })

    this._log('publish: profile updated successfully')
  }

  /**
   * verify a given module
   *
   * @public
   * @async
   * @link https://github.com/p2pcommons/specs/blob/master/module.md#verification
   * @param {Object} source - a module object to verify
   * @returns {Boolean} - true if module is verified, false otherwise
   */
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

  /**
   * unpublish content from users profile
   *
   * @param {(String)} contentKey - contentKey should include the version
   * @param {(String|Buffer)} profileKey
   */
  async unpublish (contentKey, profileKey) {
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
    debug('unpublish')

    const { module: profile, metadata } = await this._getModule(profileKey)

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

    const { module: content, versionedKey } = await this._getModule(
      cKey,
      contentVersion
    )
    if (!content) {
      this._log(`content with key ${cKey} not found`)
      return
    }

    // everything is valid, removing content from contents
    profile.p2pcommons.contents.splice(
      profile.p2pcommons.contents.indexOf(versionedKey),
      1
    )

    await this.set({
      url: profile.url,
      contents: profile.p2pcommons.contents
    })
  }

  /**
   * delete a module. This method will remove the module from the localdb and seeddb. It will also close the drive.
   *
   * @public
   * @async
   * @param {(String|Buffer)} key - a valid dat url
   */
  async delete (key) {
    assert(
      typeof key === 'string' || Buffer.isBuffer(key),
      ValidationError,
      "'string' or Buffer",
      key,
      'key'
    )

    debug('delete')
    const url = DatEncoding.encode(key)
    const dkey = DatEncoding.encode(
      crypto.discoveryKey(DatEncoding.decode(key))
    )
    const { metadata } = await this.get(key)
    if (!metadata.isWritable) {
      this._log('delete: drive is not writable')
      return
    }
    try {
      await this.localdb.del(url)
      await this.seeddb.del(dkey)
      const drive = this.drives.get(dkey) // if drive is open in memory we can close it
      if (drive) {
        await drive.close()
      }
      if (!this.disableSwarm) {
        this.networker.unseed(dkey)
      }
    } catch (err) {
      debug('delete: %O', err)
      console.error('Something went wrong with module delete')
    }
  }

  /**
   * shutdown an sdk instance closing all the open hyperdrives
   *
   * @public
   * @async
   * @param {Boolean} db=true - if true it will close all the internal databases
   * @param {Boolean} swarm=true - if true it will close the swarm
   */
  async destroy (db = true, swarm = true) {
    if (db) {
      debug('closing db...')
      await this.db.close()
      await this.localdb.close()
      await this.seeddb.close()
    }
    if (swarm && this.networker) {
      debug('closing swarm...')
      await this.networker.close()
    }

    const closing = Array.from(this.drives.values()).map(d => d.close())
    await Promise.all(closing)
  }
}

SDK.errors = { ValidationError, InvalidKeyError, MissingParam }

module.exports = SDK
