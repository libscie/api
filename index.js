const { EventEmitter } = require('events')
const { join, isAbsolute, basename } = require('path')
const { platform } = require('os')
const assertValid = require('./lib/assert-valid')
const allowedProperties = require('./lib/allowed-properties')
const assertHyperUrl = require('./lib/assert-hyper-url')
const _unflatten = require('./lib/_unflatten')
const assertModuleType = require('./lib/assert-module-type')
const _getAvroType = require('./lib/_get-avro-type')
const assertModule = require('./lib/assert-module')
const _flatten = require('./lib/_flatten')

const {
  promises: {
    open,
    writeFile,
    readFile,
    readdir,
    stat: statFn,
    mkdir,
    chmod,
    copyFile
  }
} = require('fs')
const { promisify } = require('util')
const chmodrcb = require('chmodr')
const { ensureDir } = require('fs-extra')
const assert = require('nanocustomassert')
const level = require('level')
const sub = require('subleveldown')
const AutoIndex = require('level-auto-index')
const { Type } = require('@avro/types')
const crypto = require('hypercore-crypto')
const HypercoreCache = require('hypercore-cache')
const DatEncoding = require('dat-encoding')
const debug = require('debug')('p2pcommons')
const trash = require('trash')
const deepMerge = require('deepmerge')
const pRetry = require('p-retry')
const PCancelable = require('p-cancelable')
const pMemoize = require('p-memoize')
const pTimeout = require('p-timeout')
const Swarm = require('@corestore/networker')
const dat = require('./lib/dat-helper')
const parse = require('./lib/parse-url')
const baseDir = require('./lib/base-dir')
const {
  validate,
  validatePartial,
  validateOnRegister,
  validateOnFollow,
  validateTitle,
  validateDescription,
  validateUrl,
  validateLinks,
  validateP2pcommons,
  validateType,
  validateSubtype,
  validateMain,
  validateAvatar,
  validateAuthors,
  validateParents,
  validateParentsOnUpdate,
  validateFollows,
  validateContents
} = require('./lib/validate')
const Codec = require('./codec')
const ContentSchema = require('./schemas/content.json')
const ProfileSchema = require('./schemas/profile.json')
const ValidationTypes = require('./schemas/validation') // avro related validations
const {
  createIndexJSON,
  collect,
  driveWaitForFile,
  dlWaitForFile
} = require('./lib/utils')

const chmodr = promisify(chmodrcb)

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

const DEFAULT_SDK_OPTS = {
  persist: true,
  storage: undefined,
  versose: false,
  watch: true
}

const TOTAL_CACHE_SIZE = 1024 * 1024 * 512
const CACHE_RATIO = 0.5
const TREE_CACHE_SIZE = TOTAL_CACHE_SIZE * CACHE_RATIO
const DATA_CACHE_SIZE = TOTAL_CACHE_SIZE * (1 - CACHE_RATIO)

const DEFAULT_GLOBAL_SETTINGS = {
  networkDepth: 2,
  defaultProfile: '',
  keys: '~/.p2pcommons/.hyperdrive',
  sparse: true
}

class SDK extends EventEmitter {
  constructor (opts = {}) {
    super()
    debug('constructor')
    const finalOpts = { ...DEFAULT_SDK_OPTS, ...opts }
    this.start = false
    this.platform = platform()
    // NOTE(dk): consider switch to envPaths usage
    this.baseDir = baseDir(finalOpts.baseDir)
    this.persist = finalOpts.persist
    this.storage = finalOpts.storage
    this.verbose = finalOpts.verbose
    this.dbPath = finalOpts.dbPath || this.baseDir
    this.watch = finalOpts.watch

    this.drives = new Map()
    this.drivesToWatch = new Map()
    this.externalUpdates = new Map()
    this.driveUnwatches = new Map()
    this.downloadListeners = new Map()
    this.activeFeedDownloads = new Map()

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
    debug(`baseDir: ${this.baseDir}`)
    debug(`dbPath: ${this.dbPath}`)
    debug(`persist drives? ${!!this.persist}`)
    debug(`swarm enabled? ${!this.disableSwarm}`)
    debug(`watch enabled? ${this.watch}`)
  }

  assertMetadata (meta) {
    assert(typeof meta === 'object', 'metadata object expected')
    const dbitem = {
      ...meta,
      rawJSON: Buffer.alloc(0) // we test validity of this property separately
    }

    this.dbItemType.isValid(dbitem, {
      errorHook: this._dbItemError
    })
  }

  _log (msg, level = 'log') {
    if (this.verbose) {
      console[level](msg)
    }
  }

  _watchErrHandler (err, key) {
    if (err.code === 'EBUSY') {
      const busyErr = new EBUSYError(err.message, key)
      this.emit('warn', busyErr)
    }
  }

  _dbItemError (path, any, type) {
    throw new ValidationError(
      `Valid Metadata: ${type}`,
      `${any} (${typeof any})`,
      path.join()
    )
  }

  async _seed (archive, joinOpts = {}) {
    const dkey = DatEncoding.encode(archive.discoveryKey)
    const defaultJoinOpts = {
      announce: true,
      lookup: true
    }

    const finalOpts = { ...defaultJoinOpts, ...joinOpts }

    let alreadySeededOpts = {}
    try {
      const { opts } = await this.seeddb.get(dkey)
      alreadySeededOpts = opts
    } catch (_) {}

    if (
      finalOpts.announce === alreadySeededOpts.announce &&
      finalOpts.lookup === alreadySeededOpts.lookup
    ) {
      return
    }

    if (!archive.isCheckout) {
      this.drives.set(dkey, archive)
    }

    if (!this.disableSwarm) {
      // await this.localdb.open()
      // await this.seeddb.open()
      await this.seeddb.put(dkey, {
        key: dkey,
        opts: finalOpts
      })

      debug(`swarm seeding ${dkey}`)

      this.networker.configure(archive.discoveryKey, { ...finalOpts })

      archive.once('close', () => {
        debug(`closing archive ${dkey}...`)
        this.drives.delete(dkey)
      })
    }
  }

  async _reseed () {
    const driveList = await collect(this.seeddb)
    debug(`re-seeding ${driveList.length} modules...`)
    const joins = driveList.map(item => {
      this.networker.configure(item.key, item.opts)
    })
    await Promise.all(joins)
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
        JSON.stringify(options, null, 2)
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
          'hyper-url': ValidationTypes.HyperUrl,
          'hyper-url-versioned': ValidationTypes.HyperUrlVersioned,
          'hyper-key': ValidationTypes.HyperKey,
          'hyper-key-versioned': ValidationTypes.HyperKeyVersioned
        }
      })
      this.profileType = Type.forSchema(ProfileSchema, {
        registry,
        logicalTypes: {
          title: ValidationTypes.Title,
          path: ValidationTypes.Path,
          'hyper-url': ValidationTypes.HyperUrl,
          'hyper-url-versioned': ValidationTypes.HyperUrlVersioned,
          'hyper-key': ValidationTypes.HyperKey,
          'hyper-key-versioned': ValidationTypes.HyperKeyVersioned
        }
      })
      const codec = new Codec(registry)
      this.dbItemType = codec.dbItemType

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
        this.localdb.on('error', err => {
          this._log(err.message, 'error')
          this.emit('error', err)
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
        sparse: this.globalOptions.sparse
      })
      await drive.ready()

      try {
        const moduleDir = join(this.baseDir, urlString)

        const statDrive = await pTimeout(drive.stat('/'), 100)
        const statDir = await statFn(moduleDir)
        const statDriveIndex = await drive.stat('index.json')
        const statDirIndex = await statFn(join(moduleDir, 'index.json'))
        const statDriveMtime = statDrive[0].mtime
        const statDirMtime = statDir.mtime
        const statDriveIndexMtime = statDriveIndex[0].mtime
        debug('refreshMTimes statDriveIndexMtime %s', statDriveIndexMtime)
        const statDirIndexMtime = statDirIndex.mtime
        debug('refreshMTimes statDirIndexMtime %s', statDirIndexMtime)
        const dirIndexJSON = await readFile(join(moduleDir, 'index.json'), {
          encoding: 'utf-8'
        })
        const driveIndexJSON = await drive.readFile('index.json', {
          encoding: 'utf-8'
        })

        const mtimePerRoot =
          statDriveMtime.getTime() > statDirMtime.getTime()
            ? statDriveMtime
            : statDirMtime

        const mtimePerIndex =
          statDriveIndexMtime > statDirIndexMtime
            ? statDriveIndexMtime
            : statDirIndexMtime

        let mtime, overwriteIndex
        debug(
          'refreshMTimes driveIndexJSON === dirIndexJSON %s',
          dirIndexJSON === driveIndexJSON
        )

        if (!drive.writable) {
          // resume downloads
          try {
            await this.resumeDownload(
              urlString,
              metadata.version,
              metadata.isCheckout
            )
          } catch (err) {
            this._log(`Unable to resume download. Err: ${err.message}`)
          }
        }

        if (drive.writable) {
          // If local modules (fs) have changed, update the drives
          const driveWatch = await dat.importFiles(drive, moduleDir, {
            watch: this.watch
          })

          if (this.watch) {
            this.drivesToWatch.set(
              DatEncoding.encode(drive.discoveryKey),
              driveWatch
            )

            driveWatch.on('put-end', (src, dst) =>
              this._updateLocalDB(urlString, dst).catch(err =>
                this._log(err.message, 'error')
              )
            )
          }
        }

        try {
          const dkey = DatEncoding.encode(drive.discoveryKey)
          if (!metadata.isCheckout && !metadata.isWritable) {
            debug('refreshMTimes: re-attaching general drive watcher...')
            const unwatch = drive.watch('/', () => {
              this.refreshFS(moduleDir, drive).catch(err =>
                this._log(err, 'warn')
              )
            })
            this.driveUnwatches.set(dkey, unwatch)

            // specific file watch for profiles index.json
            if (
              !this.externalUpdates.has(dkey) &&
              rawJSON.p2pcommons.type === 'profile'
            ) {
              const unwatcher = drive.watch('index.json', async () => {
                this._updateLocalDB(urlString, { name: 'index.json' }).catch(
                  err => this._log(err.message, 'error')
                )
              })
              this.externalUpdates.set(dkey, unwatcher)
            }
          }
        } catch (err) {
          this._log(`refreshMTimes: downloadFiles error - ${err.msg}`, 'warn')
        }

        // resume downloads
        try {
          await this.resumeDownload(
            urlString,
            metadata.version,
            metadata.isCheckout
          )
        } catch (err) {
          this._log(`Unable to resume download. Err: ${err.message}`)
        }

        if (dirIndexJSON !== driveIndexJSON) {
          mtime = mtimePerIndex
          debug('refreshMTimes mtimePerIndex %s', mtime)
          if (statDirIndexMtime > statDriveIndexMtime) {
            debug('refreshMTimes overwriteIndex OK')
            overwriteIndex = true
          }
        } else {
          overwriteIndex = false
          mtime = mtimePerRoot
          debug('refreshMTimes mtimePerRoot %s', mtime)
          continue
        }
        debug(
          'refreshMTimes lastModified getTime %s',
          metadata.lastModified.getTime()
        )
        debug('refreshMTimes mtime getTime %s', mtime.getTime())
        if (metadata.lastModified.getTime() >= mtime.getTime()) {
          debug(`refreshMTimes: skip update ${urlString}`)
          continue
        }

        const module = overwriteIndex
          ? dirIndexJSON
          : await drive.readFile('index.json')
        const indexJSON = _unflatten(JSON.parse(module))

        // check indexJSON is still valid
        const avroType = _getAvroType(this, indexJSON.p2pcommons.type)
        try {
          assertValid(avroType, indexJSON)
        } catch (err) {
          // Note(dk): sdk will emit warning if metadata has been modified offline and made invalid according to schema
          this.emit('warn', err)
        }

        // update metadata
        metadata.lastModified = mtime
        metadata.version = Number(drive.version)

        this.assertMetadata(metadata)

        // update localdb
        await this.localdb.put(urlString, {
          ...metadata,
          rawJSON: indexJSON,
          avroType: _getAvroType(this, indexJSON.p2pcommons.type).name
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
      corestoreOpts: {
        sparse: this.globalOptions.sparse,
        cache: {
          data: new HypercoreCache({
            maxByteSize: DATA_CACHE_SIZE,
            estimateSize: val => val.length
          }),
          tree: new HypercoreCache({
            maxByteSize: TREE_CACHE_SIZE,
            estimateSize: val => 40
          })
        }
      }
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

      this.networker.listen()
      debug('swarm listening...')
      await this._reseed()
    }
  }

  async resumeDownload (key, version, isCheckout) {
    debug(
      `resumeDownload: checking for incomplete download - key ${key} - version ${version} - isCheckout ${isCheckout}`
    )
    assert(typeof key === 'string', 'string is expected')

    const modulePath = isCheckout ? `${key}+${version}` : key
    const moduleDir = join(this.baseDir, modulePath)

    let drive

    const { dlInfo } = await this.getDownloadInfo(key, version, isCheckout)
    if (isCheckout) {
      await this.makeWritable(moduleDir)
    }
    if (!dlInfo.complete) {
      this.emit('download-resume', {
        key,
        downloaded: dlInfo.downloaded
      })
      debug(`resumeDownload: resuming key ${key}`)

      try {
        drive = await this.getDrive(key, version)

        const downloadId = dlInfo.resume(() =>
          this.finishDownload(key, version, isCheckout).catch(err =>
            this._log(err, 'warn')
          )
        )
        const cancel = () => {
          dlInfo.cancel(downloadId)
        }
        this.activeFeedDownloads.set(
          DatEncoding.encode(drive.discoveryKey),
          cancel
        )

        if (isCheckout) {
          drive = drive.checkout(version)
        }
      } catch (err) {
        this._log(err, 'error')
        return
      }
    } else {
      await this.refreshFS(moduleDir, drive)
    }
    if (isCheckout) {
      // await this.makeReadOnly(moduleDir)
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

  async _updateLocalDB (moduleUrl, file) {
    debug('_updateLocalDB: moduleUrl', moduleUrl)
    debug('_updateLocalDB: file', file.name)
    const keyBuffer = DatEncoding.decode(moduleUrl)
    const dkey = DatEncoding.encode(crypto.discoveryKey(keyBuffer))
    let moduleHyper = this.drives.get(dkey)
    if (!moduleHyper) {
      this._log(`module url (${moduleUrl}) not found, calling open`, 'warn')
      // call open
      moduleHyper = dat.open(this.store, keyBuffer, {
        sparse: true
      })
      await moduleHyper.ready()
    }

    const {
      rawJSON: localRawJSON,
      metadata: { lastModified, isCheckout }
    } = await this.get(moduleUrl)

    const [driveStat] = await moduleHyper.stat(file.name)

    if (driveStat.mtime < lastModified) return

    // update localdb
    const metadata = {
      isWritable: moduleHyper.writable,
      lastModified: driveStat.mtime,
      version: Number(moduleHyper.version),
      isCheckout
    }
    const indexJSON = JSON.parse(
      await moduleHyper.readFile('index.json', 'utf-8')
    )

    if (indexJSON !== localRawJSON) {
      this._log('overwriting with index.json from hyperdrive')
    }
    await this.localdb.put(DatEncoding.encode(moduleUrl), {
      ...metadata,
      rawJSON: indexJSON,
      avroType: _getAvroType(this, indexJSON.p2pcommons.type).name
    })

    // emit update-profile|content event
    this.emit('drive-updated', {
      key: DatEncoding.encode(moduleUrl),
      type: indexJSON.p2pcommons.type,
      indexJSON,
      update: file.name
    })
  }

  /**
   * initialize a new module. This method will create a specific folder and seed the content if swarm is enabled. Only type is mandatory.
   *
   * @public
   * @async
   * @param {{
   *   type: String,
   *   title: String,
   *   subtype: String,
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

    validateType({ indexMetadata: { type } })

    debug(`init ${type}`)

    await this.ready()

    // Note(dk): the pk will be used as a seed, it can be any string
    const { publicKey } = crypto.keyPair()

    const archive = await dat.create(this.store, publicKey, {
      hyperdrive: {
        sparse: this.globalOptions.sparse
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

    await validatePartial({
      indexMetadata: indexJSON,
      _flat: false
    })
    if (parents) {
      await validateParentsOnUpdate({
        indexMetadata: indexJSON,
        p2pcommons: this,
        _flat: false
      })
    }

    // Note(dk): validate earlier
    const avroType = _getAvroType(this, type)

    assertValid(avroType, indexJSON)

    // write index.json
    await writeFile(
      join(moduleDir, 'index.json'),
      JSON.stringify(indexJSON, null, 2)
    )

    const driveWatch = await dat.importFiles(archive, moduleDir, {
      watch: this.watch
    })

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
      version: Number(archive.version),
      isCheckout: false
    }

    this.assertMetadata(metadata)

    await this.localdb.put(publicKeyString, {
      ...metadata,
      rawJSON: indexJSON,
      avroType: avroType.name
    })

    await this._seed(archive)
    if (this.watch) {
      driveWatch.on('error', err => this._watchErrHandler(err, publicKeyString))
      this.drivesToWatch.set(
        DatEncoding.encode(archive.discoveryKey),
        driveWatch
      )

      driveWatch.on('put-end', (src, dst) =>
        this._updateLocalDB(publicKeyString, dst).catch(err =>
          this._log(err.message, 'error')
        )
      )
    }
    this._log(
      `Saved new ${indexJSON.p2pcommons.type}, with key: ${publicKeyString}`
    )
    // Note(dk): flatten p2pcommons obj in order to have a more symmetrical API
    return { rawJSON: _flatten(indexJSON), metadata, driveWatch }
  }

  async saveItem ({
    isWritable,
    lastModified,
    version,
    isCheckout,
    indexJSON,
    main
  }) {
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
    archive = this.drives.get(dkey)

    if (!archive) {
      debug(`saveItem: calling hyper open ${keyString}`)
      const drive = dat.open(this.store, DatEncoding.decode(indexJSON.url), {
        sparse: this.globalOptions.sparse
      })
      await drive.ready()
      archive = drive
    }

    const driveWatch = this.drivesToWatch.get(dkey)
    if (main && driveWatch) {
      debug(`saveItem: waiting for main file: ${main}...`)
      const fullPathMain = join(indexJSONDir, main)
      await driveWaitForFile(archive, driveWatch, main, fullPathMain)
    }

    let stat, driveVersion, driveMtime
    if (isWritable) {
      await writeFile(
        join(indexJSONDir, 'index.json'),
        JSON.stringify(indexJSON, null, 2)
      )
      await dat.importFiles(archive, indexJSONDir)

      driveVersion = archive.version
      stat = await archive.stat('index.json')
      driveMtime = stat[0].mtime
    }

    debug('updating cache value')

    if (!archive.isCheckout) {
      this.drives.set(dkey, archive)
    }

    debug('saving item on local db')

    const metadata = {
      isWritable,
      lastModified: isWritable ? driveMtime : lastModified,
      version: isWritable ? Number(driveVersion) : Number(version),
      isCheckout
    }

    this.assertMetadata(metadata)

    await this.localdb.put(DatEncoding.encode(indexJSON.url), {
      ...metadata,
      rawJSON: indexJSON,
      avroType: _getAvroType(this, indexJSON.p2pcommons.type).name
    })

    return {
      rawJSON: _flatten(indexJSON),
      metadata
    }
  }

  /**
   * updates module fields
   *
   * @public
   * @async
   * @link https://github.com/p2pcommons/specs/blob/main/module.md
   * @param {Object} params - Object containing field to update
   * @param {(String|Buffer)} params.url - module hyper url REQUIRED
   * @param {String} [params.title]
   * @param {String} [params.description]
   * @param {String} [params.main]
   * @param {String} [params.subtype]
   * @param {String} [params.avatar]
   * @param {Array<String>} [params.authors] - only valid for content modules
   * @param {Array<String>} [params.parents] - only valid for content modules
   * @param {Array<String>} [params.contents] - only valid for profile modules
   * @param {Array<String>} [params.follows] - only valid for profile modules
   * @param {Boolean} [force] - overrides validations if true
   */
  async set (params, force = false) {
    assert(typeof params === 'object', TypeError, 'object', params, 'params')
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
    for (const key of receivedKeys) {
      if (!allowedProperties().includes(key)) {
        throw new InvalidKeyError(key)
      }
    }

    const keyString = DatEncoding.encode(url)

    const { rawJSON: rawJSONFlatten, metadata } = await this.get(keyString)
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
      _unflatten(rawJSONFlatten),
      prepareMergeData(_unflatten(mod)),
      {
        arrayMerge: force ? overwriteMerge : null
      }
    )

    // check valid params
    if (!force) {
      if (params.contents !== undefined) {
        for (const contentKey of params.contents) {
          const {
            host: unversionedContentKey,
            version: contentVersion
          } = parse(contentKey)
          const {
            rawJSON: contentJSON,
            metadata: contentMetadata,
            dlHandle
          } = await this.clone(unversionedContentKey, contentVersion)
          if (dlHandle) {
            if (params.main) {
              const dirName = contentVersion
                ? `${unversionedContentKey}+${contentVersion}`
                : unversionedContentKey
              const mainFile = join(this.baseDir, dirName, params.main)
              await dlWaitForFile(
                dlHandle,
                contentMetadata.lastModified,
                mainFile
              )
            }
          }
          await validateOnRegister({
            contentIndexMetadata: contentJSON,
            contentDbMetadata: contentMetadata,
            contentKey,
            profileIndexMetadata: finalJSON,
            profileDbMetadata: metadata,
            profileKey: hyperdriveKey,
            p2pcommonsDir: this.baseDir
          })
        }
      } else {
        await validatePartial({
          indexMetadata: finalJSON,
          dbMetadata: metadata,
          key: hyperdriveKey,
          p2pcommonsDir: this.baseDir
        })
      }
      if (params.parents !== undefined) {
        await validateParentsOnUpdate({
          indexMetadata: finalJSON,
          p2pcommons: this
        })
      }
      if (params.follows !== undefined) {
        for (const followedKey of params.follows) {
          const { rawJSON: followJSON } = await this.clone(followedKey)
          validateOnFollow({
            followedIndexMetadata: followJSON
          })
        }
      }
      debug('set: valid params')
    }

    const dkey = DatEncoding.encode(
      crypto.discoveryKey(DatEncoding.decode(url))
    )
    const dw = this.drivesToWatch.get(dkey)
    if (dw) {
      this._log(`pendings to import? ${dw.pending.length}`, 'info')
      // actively wait for drive update
      while (dw.pending.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    debug('set', { finalJSON })
    // Check if keys values are valid (ie: non empty, etc)
    const avroType = _getAvroType(this, rawJSONFlatten.type)

    assertValid(avroType, finalJSON)

    debug('set: valid input')
    return this.saveItem({
      ...metadata,
      indexJSON: finalJSON,
      main: params.main
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
    return { rawJSON: _flatten(rawJSON), metadata }
  }

  /**
   * refreshFS.
   *
   * @description Manually sync your module directory with the hyperdrive content
   * @async
   * @private
   * @param {String} moduleDir - path to the module directory
   * @param {Object} drive - hyperdrive instance
   * @param {Object} [opts] - dft options
   * @returns {Array<Object>} - diff array, eg: `change: 'mod', type: 'file', path: '/hello.txt'}`
   */
  async refreshFS (moduleDir, drive, opts = {}) {
    const diff = await dat.syncFS(moduleDir, drive, opts)
    this._log(`Applying diff to FS (path: ${moduleDir})`)
    this._log({ diff })
    this.emit('update-module', { diff, key: DatEncoding.encode(drive.key) })
    return diff
  }

  /**
   * refreshDrive.
   *
   * @description Manually sync your hyperdrive
   * @async
   * @public
   * @param {String|BUffer} key - drives key
   * @param {Object} [opts] - dft options
   * @returns {Array<Object>} - diff array, eg: `change: 'mod', type: 'file', path: '/hello.txt'}`
   */
  async refreshDrive (key, opts = {}) {
    const dkey = DatEncoding.encode(
      crypto.discoveryKey(DatEncoding.decode(key))
    )
    let drive = this.drives.get(dkey)
    if (!drive) {
      // dat open
      drive = dat.open(this.store, DatEncoding.decode(key), {
        sparse: true
      })

      await drive.ready()
    }
    if (!drive.writable) {
      this._log('drive is not writable -  nothing to sync')
      return
    }

    const moduleDir = join(this.baseDir, DatEncoding.encode(key))
    const diff = await dat.syncDrive(drive, moduleDir, opts)

    if (diff.length > 0) {
      const [driveStat] = await drive.stat('index.json')
      const metadata = {
        isWritable: drive.writable,
        lastModified: driveStat.mtime,
        version: Number(drive.version),
        isCheckout: false
      }
      const indexJSON = JSON.parse(await drive.readFile('index.json', 'utf-8'))

      await this.localdb.put(DatEncoding.encode(key), {
        ...metadata,
        rawJSON: indexJSON,
        avroType: _getAvroType(this, indexJSON.p2pcommons.type).name
      })
    }

    return diff
  }

  async filterExact (feature, criteria) {
    assert(typeof feature === 'string', TypeError, 'string', feature, 'feature')
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
        return resolve({ rawJSON: _flatten(rawJSON), metadata })
      })
    })
  }

  async filter (feature, criteria) {
    assert(typeof feature === 'string', TypeError, 'string', feature, 'feature')
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
            rawJSON: _flatten(rawJSON),
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
        if (rawJSON.p2pcommons.type === 'content') {
          const flattened = {
            rawJSON: _flatten(rawJSON),
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
        if (rawJSON.p2pcommons.type === 'profile') {
          const flattened = {
            rawJSON: _flatten(rawJSON),
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
            rawJSON: _flatten(rawJSON),
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

  async addFiles (key, filePaths = []) {
    assertHyperUrl(key)
    debug(`addFiles: key ${key}`)
    debug(`addFiles: key ${filePaths}`)

    if (typeof filePaths === 'string') {
      filePaths = [filePaths]
    }
    const keyString = DatEncoding.encode(key)

    const drive = await this.getDrive(keyString)
    if (!drive.writable) {
      throw new Error('module is not writable')
    }

    const dkey = DatEncoding.encode(drive.discoveryKey)

    const moduleDir = join(this.baseDir, keyString)
    let dw = this.drivesToWatch.get(dkey)
    if (!dw) {
      dw = await dat.importFiles(drive, moduleDir)
      this.drivesToWatch.set(dkey, dw)
    }

    for (const file of filePaths) {
      const destination = join(moduleDir, basename(file))
      if (!file.includes(moduleDir)) {
        await copyFile(file, destination)
      }
    }
    await this.refreshDrive(keyString)
  }

  async removeFile (key, filePaths = []) {
    assertHyperUrl(key)
    debug(`addFiles: key ${key}`)
    debug(`addFiles: key ${filePaths}`)

    const files = []
    if (typeof filePaths === 'string') {
      files.push(filePaths)
    } else {
      files.concat(filePaths)
    }
    const keyString = DatEncoding.encode(key)

    const drive = await this.getDrive(keyString)
    if (!drive.writable) {
      throw new Error('module is not writable')
    }
    const dkey = DatEncoding.encode(drive.discoveryKey)
    const moduleDir = join(this.baseDir, keyString)
    let dw = this.drivesToWatch.get(dkey)
    if (!dw) {
      dw = await dat.importFiles(drive, moduleDir)
      this.drivesToWatch.set(dkey, dw)
    }

    for (const file of files) {
      await drive.unlink(basename(file))
    }
    await this.refreshFS(moduleDir, drive)
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

    // const archive = this.drives.get(cacheKey)
    const archive = this.drives.get(dkey)
    if (archive) {
      debug(`getDrive: module found in cache with cachekey ${cacheKey}`)
      return archive
    }

    const drive = dat.open(this.store, keyBuffer, {
      sparse: true
    })

    debug(`getDrive: Found archive key ${key}`)
    debug('getDrive: Waiting for archive to be ready')
    await drive.ready()

    await this._seed(drive, { announce: true, lookup: true })

    return drive
  }

  /**
   * makeWritable.
   *
   * @description Performs a chmodr (recursive) on a module directory, making it writable (mode: 777)
   * @private
   * @async
   * @param {string} moduleDir -  path to module directory
   */
  async makeWritable (moduleDir) {
    assert(typeof moduleDir === 'string', 'moduleDir should be a path')
    debug('makeWritable: %s', moduleDir)
    const mode = 0o777 // write, read and execute
    // await access(moduleDir)

    const stat = await statFn(moduleDir)
    // NOTE(dk): based on chmodr tests: https://github.com/isaacs/chmodr/blob/master/test/basic.js#L49
    // and from this comment from isaacs: https://github.com/nodejs/node-v0.x-archive/issues/3045#issuecomment-4863596
    // We are converting the stats mode into octals for easy comparison.
    const permString = stat.mode & 0o777

    if (permString === mode) {
      this._log('module directory is already writable', 'warn')
      return
    }

    await chmodr(moduleDir, mode)
  }

  /**
   * makeReadOnly.
   *
   * @description Performs a chmodr (recursive) on a module directory making it readable only (mode: 0555 when possible, otherwise 0444)
   * @private
   * @async
   * @param {string} moduleDir - path to module directory
   */
  async makeReadOnly (moduleDir) {
    assert(typeof moduleDir === 'string', 'moduleDir should be a path')
    const mode = 0o555 // read and execute
    const stat = await statFn(moduleDir)

    // NOTE(dk): based on chmodr tests: https://github.com/isaacs/chmodr/blob/master/test/basic.js#L49
    const permString = stat.mode & 0o777

    if (permString === mode) {
      this._log('module directory is already read only', 'warn')
      return
    }
    await chmodr(moduleDir, mode)
    this.emit('module-readonly', moduleDir)
  }

  /**
   * finishDownload.
   *
   * @description this is called when the drive download method has finished for current version
   * @private
   * @param {String} key
   */
  async finishDownload (key, version, isCheckout) {
    debug('finishDownload: download resume completed')
    this.finishingDownload = true
    const keyString = DatEncoding.encode(key)
    const modulePath = isCheckout ? `${keyString}+${version}` : keyString
    const moduleDir = join(this.baseDir, modulePath)
    const drive = await this.getDrive(key, version)
    const created = await this.createModuleDir(moduleDir)
    if (!created) {
      await this.makeWritable(moduleDir)
    }

    await this.refreshFS(moduleDir, drive)
    this.emit('download-resume-completed', { key })
    debug(`finishDownload: fs moduleDir ${moduleDir} synced OK`)
    if (isCheckout) {
      // await this.makeReadOnly(moduleDir)
    }
    this.finishingDownload = false
  }

  /**
   * createModuleDir.
   *
   * @description creates a module directory. Emits a warn if directory already exists or if it is read-only
   * @async
   * @param {string} moduleDir - a path to the new module dir
   * @returns {boolean} - Indicates if the module directory has been created (true) or not (false)
   */
  async createModuleDir (moduleDir) {
    assert(typeof moduleDir === 'string', 'moduleDir is required')
    debug('createModuleDir: creating module dir %s', moduleDir)
    try {
      await mkdir(moduleDir)
      return true
    } catch (err) {
      if (err.code === 'EEXIST') {
        this._log('moduleDir already exists', 'warn')
        return true
      } else if (err.code === 'EACCESS') {
        this._log('moduleDir is readonly', 'warn')
        return false
      } else {
        throw err
      }
    }
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
   *   dlHandle
   * }}
   */
  async getFromSwarm (key, version = 0, download = true) {
    // if module isn't found locally, then fetch from swarm
    // something like:
    debug('getFromSwarm: Module was not found in localdb.')
    debug('getFromSwarm: fetching from swarm')
    version = parseInt(version)
    const mKeyString = DatEncoding.encode(key)
    let moduleVersion
    let module
    let dlInfo
    let dlHandle
    let isCheckout = false
    debug(`getFromSwarm: fetching key ${mKeyString.substr(0, 6)}`)
    debug(`getFromSwarm: fetching version ${version}`)

    const moduleHyper = await this.getDrive(mKeyString, version)

    debug('getFromSwarm: Module version', moduleHyper.version)

    if (this.canceledClone) {
      return { canceled: true }
    }

    const dkey = DatEncoding.encode(moduleHyper.discoveryKey)
    try {
      ;({ dlInfo } = await this.getDownloadInfo(
        mKeyString,
        version,
        Number.isFinite(version) && version !== 0
      ))

      // after fetching module we still need to read the index.json file
      if (Number.isFinite(version) && version !== 0) {
        debug(`getFromSwarm: using checkout ${version}`)
        moduleVersion = moduleHyper.checkout(version)
        isCheckout = true
      } else {
        moduleVersion = moduleHyper
      }

      const getFile = async () => {
        return moduleVersion.readFile('index.json', 'utf-8')
      }

      debug('getFromSwarm: Reading modules index.json...')
      const content = await pRetry(getFile, {
        onFailedAttempt: error => {
          this._log(
            `Failed attempt fetching index.json. ${error.attemptNumber}/${
              error.retriesLeft
            }`
          )
        },
        retries: 3,
        minTimeout: 500,
        maxTimeout: 2000
      })

      module = JSON.parse(content)
      // NOTE (dk): we can consider have another map for checkouts only

      if (!moduleVersion.isCheckout) {
        this.drives.set(dkey, moduleVersion)
      }
    } catch (err) {
      this._log(err.message, 'error')
      if (this.canceledClone) {
        return { canceled: true }
      }
      throw new Error('clone: Problems fetching external module')
    }
    // 4 - write module into the fs (create directory)
    const modulePath = version ? `${mKeyString}+${version}` : `${mKeyString}`
    const folderPath = join(this.baseDir, modulePath)

    const moduleDirCreated = await this.createModuleDir(folderPath)

    if (moduleDirCreated) {
      await writeFile(
        join(folderPath, 'index.json'),
        JSON.stringify(module, null, 2)
      )
    }

    const stat = await moduleHyper.stat('index.json')

    if (download && moduleDirCreated) {
      debug('getFromSwarm: downloading module...')
      if (this.activeFeedDownloads.has(dkey)) {
        if (!dlInfo.complete) {
          this.emit('download-started', {
            key: mKeyString,
            completed: dlInfo.downloaded
          })
        }
        const downloadId = dlInfo.resume(() =>
          this.finishDownload(mKeyString, version, isCheckout).catch(err =>
            this._log(err, 'warn')
          )
        )
        const cancel = () => {
          dlInfo.cancel(downloadId)
        }
        this.activeFeedDownloads.set(dkey, cancel)
      }

      if (!isCheckout && !this.driveUnwatches.has(dkey)) {
        // watch files
        const unwatch = moduleVersion.watch('/', async () => {
          await this.refreshFS(folderPath, moduleVersion).catch(err => {
            this._log(err, 'warn')
          })
        })
        this.driveUnwatches.set(dkey, unwatch)
      }

      if (moduleVersion.isCheckout && dlHandle) {
        // dlHandle.once('end', () => this.makeReadOnly(folderPath))
      }

      if (module.p2pcommons.main) {
        const filePath = isAbsolute(module.p2pcommons.main)
          ? module.p2pcommons.main
          : join(folderPath, module.p2pcommons.main)
        debug('getFromSwarm: waiting for main file to download...')
        debug('getFromSwarm: filePath %s', filePath)
        await moduleVersion.access(module.p2pcommons.main)
        await this.refreshFS(folderPath, moduleVersion)
      }
    }

    // hook listen for updates
    if (!this.externalUpdates.has(dkey)) {
      const unwatcher = moduleHyper.watch('index.json', async () => {
        this._updateLocalDB(mKeyString, { name: 'index.json' }).catch(err =>
          this._log(err.message, 'error')
        )
      })
      this.externalUpdates.set(dkey, unwatcher)
    }
    // END listen for updates

    let lastMeta
    try {
      const { metadata } = await this.get(mKeyString)
      lastMeta = metadata
    } catch (_) {}

    // Note(dk): only update localdb if fetched module is more recent
    const metadata = {
      isWritable: moduleVersion.writable,
      lastModified: stat[0].mtime,
      version: Number(moduleVersion.version),
      isCheckout
    }
    if (
      !lastMeta ||
      stat[0].mtime.getTime() > lastMeta.lastModified.getTime()
    ) {
      this.assertMetadata(metadata)
      await this.localdb.put(DatEncoding.encode(module.url), {
        ...metadata,
        rawJSON: module,
        avroType: _getAvroType(this, module.p2pcommons.type).name
      })
    }

    return {
      rawJSON: module,
      metadata,
      dlHandle
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
      throw err
    }

    return {
      rawJSON,
      metadata
    }
  }

  async _getContentFeed (drive) {
    if (!drive) throw new Error('drive is required')
    return new Promise((resolve, reject) => {
      drive.getContent((err, feed) => {
        if (err) return reject(err)
        return resolve(feed)
      })
    })
  }

  /**
   * getDownloadInfo.
   *
   * @description
   * @private
   * @param {String} key - drive key
   * @param {Number} [version] - optional drive version
   * @param {Boolean} [isCheckout] - isCheckout indicator
   */
  async getDownloadInfo (key, version, isCheckout) {
    const dkey = DatEncoding.encode(
      crypto.discoveryKey(DatEncoding.decode(key))
    )
    let drive = this.drives.get(dkey)
    if (!drive) {
      drive = await this.getDrive(key)
      this.drives.set(dkey, drive)
    }
    await drive.ready()

    const contentFeed = await pTimeout(this._getContentFeed(drive), 500)

    const total = contentFeed.length

    if (!this.downloadListeners.has(dkey)) {
      const downloadStats = (index, data) => {
        this.emit('download-progress', {
          key,
          index
        })
      }

      const downloadComplete = () => {
        this.finishDownload(key, version, isCheckout)
          .then(() => {
            this.emit('download-drive-completed', { key })
          })
          .catch(err => this._log(err, 'error'))
      }

      contentFeed.on('download', downloadStats)
      contentFeed.once('sync', downloadComplete)
      contentFeed.on('close', () => {
        contentFeed.off('download', downloadStats)
      })
      this.downloadListeners.set(dkey)
    }

    const dlInfo = {
      key,
      downloaded: contentFeed.downloaded(),
      downloading: contentFeed.downloading,
      total,
      stats: contentFeed._stats,
      complete: total !== 0 && contentFeed.downloaded() >= total,
      resume: cb => {
        return contentFeed.download(cb)
      },
      cancel: downloadID => contentFeed.undownload(downloadID)
    }
    return { dlInfo }
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
   *   dlHandle: Object
   * }}
   */
  async clone (mKey, mVersion, download = true, onCancel) {
    // get module from localdb, if absent will query it from the swarm
    // this fn will also call seed() after retrieving the module from the swarm

    assertHyperUrl(mKey)

    if (typeof mVersion === 'boolean') {
      download = mVersion
      mVersion = null
    }

    if (typeof mVersion === 'function') {
      onCancel = mVersion
      mVersion = null
      download = true
    }

    if (typeof download === 'function') {
      onCancel = download
      download = true
    }

    if (onCancel) {
      onCancel.shouldReject = false
      onCancel(() => {
        this.canceledClone = true
      })
    }
    debug(`clone: mKey: ${mKey}`)
    debug(`clone: mVersion: ${mVersion}`)
    await this.ready()

    let module
    let meta
    let dlHandle

    const mKeyString = DatEncoding.encode(mKey)

    if (!mVersion) {
      try {
        const out = await this.getModule(mKeyString)
        if (out.canceled) {
          this.canceledClone = false
          return Promise.reject(
            new Error({ canceled: true, msg: 'canceled by the user' })
          )
        }
        module = out.rawJSON
        meta = out.metadata
      } catch (_) {
        this._log('module not found in db', 'warn')
      }
    }

    if (!module) {
      const out = await this.getFromSwarm(mKey, mVersion, download)
      if (out.canceled) {
        this.canceledClone = false
        return Promise.reject(
          new Error({ canceled: true, msg: 'canceled by the user' })
        )
      }

      module = out.rawJSON
      meta = out.metadata
      dlHandle = out.dlHandle
    }

    const { dlInfo } = await this.getDownloadInfo(
      mKeyString,
      mVersion,
      meta.isCheckout
    ).catch(err => this._log(err, 'warn'))

    return {
      rawJSON: _flatten(module),
      versionedKey: `${mKeyString}+${meta.version}`,
      metadata: meta,
      dlHandle,
      dlInfo
    }
  }

  /**
   * register a content module to a profile
   *
   * @public
   * @async
   * @link https://github.com/p2pcommons/specs/blob/main/module.md#registration
   * @param {(String|Buffer)} contentKey - versioned or unversioned key
   * @param {(String|Buffer)} profileKey - unversioned key
   */
  async register (contentKey, profileKey) {
    debug(`register contentKey: ${contentKey}`)
    debug(`register profileKey: ${profileKey}`)

    const parseUrl = urlOrBuffer => {
      let url
      if (Buffer.isBuffer(urlOrBuffer)) {
        url = DatEncoding.encode(urlOrBuffer)
      } else if (typeof urlOrBuffer === 'string') {
        const fullUrl = parse(urlOrBuffer)
        url = fullUrl.version
          ? `${fullUrl.host}+${fullUrl.version}`
          : fullUrl.host
      }

      return url
    }

    await this.set({
      url: profileKey,
      contents: [parseUrl(contentKey)]
    })

    this._log('register: profile updated successfully')
  }

  /**
   * verify a given module
   *
   * @public
   * @async
   * @link https://github.com/p2pcommons/specs/blob/main/module.md#verification
   * @param {String} versionedKey - a versioned hyper key or url
   * @returns {Boolean} - true if module is verified, false otherwise
   */
  async verify (versionedKey) {
    debug('verify %s', versionedKey)
    const { host: unversionedKey, version } = parse(versionedKey)
    if (!version) {
      throw new Error('Module can not be verified: unversioned content')
    }
    await this.ready()

    const { rawJSON: module } = await this.clone(unversionedKey, version, false)

    assert(module.type === 'content', TypeError, 'content', module.type, 'type')

    if (module.authors.length === 0) return false
    return module.authors.reduce(async (prevProm, authorKey) => {
      const prev = await prevProm
      const { rawJSON: profile } = await this.clone(authorKey, null, false)
      return prev && profile.contents.includes(versionedKey)
    }, Promise.resolve(true))
  }

  /**
   * getAllVersions.
   *
   * @description List all versions related to a key that are found in p2pcommons dir
   * @private
   * @param {String|Buffer} key
   * @returns {Array<String>} - Returns an array of versioned keys
   */
  async getAllVersions (key) {
    // get all versions in local fs as a list
    const keyString = DatEncoding.encode(key)
    const dirList = await readdir(this.baseDir)
    const expr = RegExp(`^(${keyString})(\\+\\d+)$`, 'i')
    return dirList.filter(d => d.match(expr))
  }

  /**
   * deregister content from a user's profile
   *
   * @param {(String|Buffer)} contentKey - version that is registered
   * @param {(String|Buffer)} profileKey - unversioned key
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
      throw new Error(`profile with key ${profileKey} not found`)
    }

    const { host: cKey, version: contentVersion } = parse(contentKey)
    if (!contentVersion) {
      this._log('content url does not include version', 'warn')
    }

    const { rawJSON: content } = await this.clone(cKey, contentVersion, false)
    if (!content) {
      this._log(`content with key ${cKey} not found`)
      return
    }

    // check if cKey is part of contents
    const finalCkey = contentVersion ? `${cKey}+${contentVersion}` : `${cKey}`

    if (!profile.contents.includes(finalCkey)) {
      this._log('contentKey is not included in profiles contents', 'warn')
      return
    }

    // everything is valid, removing content from contents
    profile.contents.splice(profile.contents.indexOf(finalCkey), 1)

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
   * @param {string} localProfileKey - unversioned key
   * @param {string} targetProfileKey - versioned or unversioned key
   */
  async follow (localProfileKey, targetProfileKey) {
    debug('follow')

    // update profile
    await this.set({
      url: localProfileKey,
      follows: [targetProfileKey]
    })

    this._log('follow: profile updated successfully')
  }

  /**
   * localProfile unfollows a targetProfile
   *
   * @public
   * @async
   * @param {(string|buffer)} localProfileKey - unversioned key
   * @param {(string|buffer)} targetProfileKey - version that is followed
   */
  async unfollow (localProfileKey, targetProfileKey) {
    assertHyperUrl(localProfileKey)
    assertHyperUrl(targetProfileKey)

    debug('unfollow')

    await this.ready()

    // Fetching localProfile module
    const { rawJSON: localProfile, metadata } = await this.clone(
      localProfileKey,
      false
    )

    if (!localProfile) {
      throw new Error('Module not found')
    }

    if (!metadata.isWritable) {
      throw new Error('local profile is not writable')
    }

    assertModuleType(localProfile, 'profile')
    assertModule(this, localProfile)

    const {
      host: targetProfileKeyUnversioned,
      version: targetProfileVersion
    } = parse(targetProfileKey)

    // Fetching targetProfile module
    debug(
      `follow: fetching module with key: ${targetProfileKeyUnversioned} and version: ${targetProfileVersion}`
    )
    const { rawJSON: targetProfile } = await this.clone(
      targetProfileKeyUnversioned,
      targetProfileVersion,
      false
    )

    if (!targetProfile) {
      throw new Error('Module not found')
    }

    assertModuleType(targetProfile, 'profile')
    assertModule(this, targetProfile)

    // everything is valid, removing profile
    const finalTargetProfileKey = targetProfileVersion
      ? `${targetProfileKeyUnversioned}+${targetProfileVersion}`
      : targetProfileKeyUnversioned

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
   * delete a module.
   *
   * @description This method will remove the module from the localdb and seeddb. It will also close the drive.
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

    await this.ready()

    let keyString, keyVersion, allVersions

    if (Buffer.isBuffer(key)) {
      keyString = DatEncoding.encode(key)
    } else {
      // key is a string, it may contain a version
      const { host, version } = parse(key)
      keyString = host
      keyVersion = version
      if (keyVersion) {
        throw new ValidationError(
          'Only unversioned keys are accepted',
          'only_unversioned',
          'key'
        )
      }
    }

    debug('delete %s', keyString)

    const dkeyString = DatEncoding.encode(
      crypto.discoveryKey(DatEncoding.decode(keyString))
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

        allVersions = await this.getAllVersions(keyString)

        for (const { rawJSON: prof, metadata: profMeta } of profiles) {
          if (!profMeta.isWritable) {
            continue
          }
          await this.deregister(keyString, prof.url)
          // Note(dk): we also call deregister per each content version found in p2pcommons dir
          for (const contentVersion of allVersions) {
            await this.deregister(contentVersion, prof.url)
          }
        }
      }

      await this.localdb.del(keyString)
      await this.seeddb.del(dkeyString)

      if (deleteFiles) {
        try {
          for (const version of allVersions) {
            const drivePath = join(this.baseDir, version)
            const mode = 0o777 // write, read and execute
            await chmod(drivePath, mode)
            debug(`Moving versioned drive folder ${drivePath} to trash bin`)
            await trash(drivePath)
          }
        } finally {
          // delete unversioned path
          const drivePath = join(this.baseDir, keyString)
          debug(`Moving unversioned drive folder ${drivePath} to trash bin`)
          await trash(drivePath)
        }
      }

      const drive = this.drives.get(dkeyString) // if drive is open in memory we can close it
      // Note(dk): what about the checkouts? this can be dkey + version
      // maybe keep things inside a map structure would be better -> map of maps
      if (drive) {
        await drive.close()
      }
      if (!this.disableSwarm && !keyVersion) {
        this.networker.configure(dkeyString, { announce: false, lookup: false })
      }
    } catch (err) {
      debug('delete: %O', err)
      this._log(`Something went wrong with delete: ${err.message}`, 'error')
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
    // index.json watcher for external drives
    for (const unwatch of this.externalUpdates.values()) {
      unwatch.destroy()
    }
    this.externalUpdates = new Map()
    // general drive watch for external drives
    for (const unwatch of this.driveUnwatches.values()) {
      unwatch.destroy()
    }
    this.driveUnwatches = new Map()
    // Close importFiles watches (mirror folder instances)
    for (const mirror of this.drivesToWatch.values()) {
      mirror.destroy()
    }
    this.drivesToWatch = new Map()
    // cancel active downloads (feed.download calls)

    for (const cancelActiveDl of this.activeFeedDownloads.values()) {
      cancelActiveDl()
    }
    this.activeFeedDownloads = new Map()

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
      await Promise.all(Array.from(this.drives, ([_, drive]) => drive.close()))
      this.drives = new Map()

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

SDK.errors = {
  ValidationError,
  TypeError,
  InvalidKeyError,
  MissingParam,
  EBUSYError
}

SDK.validations = {
  validate,
  validatePartial,
  validateOnRegister,
  validateOnFollow,
  validateTitle,
  validateDescription,
  validateUrl,
  validateLinks,
  validateP2pcommons,
  validateType,
  validateSubtype,
  validateMain,
  validateAvatar,
  validateAuthors,
  validateParents,
  validateParentsOnUpdate,
  validateFollows,
  validateContents
}

module.exports = SDK
