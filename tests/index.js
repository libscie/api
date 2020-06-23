const {
  existsSync,
  promises: { writeFile, readdir }
} = require('fs')
const { join } = require('path')
const execa = require('execa')
const once = require('events.once')
const test = require('tape')
const tempy = require('tempy')
const level = require('level')
const SwarmNetwoker = require('corestore-swarm-networking')
const { encode } = require('dat-encoding')
const SDK = require('../')
const createDHT = require('./utils/dht')

const testSwarmCreator = (store, opts) => new SwarmNetwoker(store, opts)

let dht, dhtBootstrap

const localDHT = async () => {
  const { url, node } = await createDHT()
  dht = node
  dhtBootstrap = url
}

const defaultOpts = () => ({
  swarm: false,
  persist: false,
  watch: false
})

const createDb = opts => {
  const finalOpts = { ...defaultOpts(), ...opts }
  return new SDK({
    disableSwarm: !finalOpts.swarm,
    persist: finalOpts.persist,
    swarm: finalOpts.swarmFn,
    baseDir: tempy.directory(),
    dht: finalOpts.dht,
    bootstrap: finalOpts.dhtBootstrap
  })
}

test('ready', async t => {
  const p2p = createDb()
  t.doesNotThrow(async () => {
    await p2p.ready()
    await p2p.destroy()
  }, 'ready method should not throw')
  t.end()
})

test('init: create content module', async t => {
  const p2p = createDb()
  const init = {
    type: 'content',
    subtype: 'Theory',
    title: 'demo',
    description: 'lorem ipsum',
    authors: [
      'dat://3f70fe6b663b960a43a2c6c5a254c432196e2efa695e4b4e39779ae22e860e9d'
    ],
    parents: [
      'dat://be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a+4'
    ]
  }
  const { rawJSON: output, metadata } = await p2p.init(init)

  t.same(output.type, init.type)
  t.same(output.subtype, init.subtype)
  t.same(output.title, init.title)
  t.same(output.description, init.description)
  t.same(typeof output.url, 'string', 'url is a string')
  t.same(
    output.links.license[0].href,
    'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
  )
  t.same(output.links.spec[0].href, 'https://p2pcommons.com/specs/module/0.2.0')
  t.same(
    output.main,
    '',
    'main property can not be set on init (default: empty)'
  )
  t.same(output.authors, init.authors)
  t.same(output.parents, init.parents)
  t.same(typeof metadata, 'object')
  t.ok(metadata.version)
  t.ok(metadata.isWritable)
  t.ok(metadata.lastModified)
  await p2p.destroy()
  t.end()
})

test('init: title longer than 300 char should throw a ValidationError', async t => {
  const p2p = createDb()
  const metadata = {
    type: 'content',
    title:
      'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia.'
  }

  try {
    await p2p.init(metadata)
  } catch (err) {
    t.ok(
      err instanceof SDK.errors.ValidationError,
      'It should be a custom SDK error'
    )
  }

  await p2p.destroy()
  t.end()
})

test('init: creation should throw a ValidationError', async t => {
  const p2p = createDb()
  const metadata = {
    type: 'content'
  }
  try {
    await p2p.init(metadata)
  } catch (err) {
    t.ok(err, 'An error should happen')
    t.ok(
      err instanceof SDK.errors.ValidationError,
      'It should be a custom SDK error'
    )
    t.ok(Object.prototype.hasOwnProperty.call(err, 'expected'))
    t.ok(Object.prototype.hasOwnProperty.call(err, 'received'))
    t.ok(Object.prototype.hasOwnProperty.call(err, 'key'))
    await p2p.destroy()
    t.end()
  }
})

test('init: create profile module', async t => {
  const p2p = createDb()
  const metadata = {
    type: 'profile',
    title: 'demo',
    description: 'lorem ipsum',
    avatar: 'avatar.jpg'
  }
  const { rawJSON: output } = await p2p.init(metadata)
  t.same(output.type, metadata.type)
  t.same(output.title, metadata.title)
  t.same(output.description, metadata.description)
  t.same(typeof output.url, 'string', 'url is a string')
  t.same(
    output.main,
    '',
    'main property can not be set on init (default: empty)'
  )
  t.same(output.avatar, metadata.avatar)
  t.same(
    output.links.license[0].href,
    'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
  )
  t.same(output.links.spec[0].href, 'https://p2pcommons.com/specs/module/0.2.0')
  t.same(output.follows, [])
  t.same(output.contents, [])
  await p2p.destroy()
  t.end()
})

test('get: retrieve a value from the sdk', async t => {
  const p2p = createDb()
  const sampleData = {
    type: 'profile',
    title: 'demo',
    description: 'lorem ipsum'
  }
  const { rawJSON: metadata } = await p2p.init(sampleData)
  const key = metadata.url

  const { rawJSON } = await p2p.get(key)

  t.same(rawJSON, metadata)
  await p2p.destroy()
  t.end()
})

test('set: update modules', async t => {
  const p2p = createDb()
  const sampleContent = {
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  }

  const sampleProfile = {
    type: 'profile',
    title: 'professor',
    description: 'lorem ipsum 2'
  }
  const { rawJSON: contentMeta } = await p2p.init(sampleContent)
  const { rawJSON: profileMeta } = await p2p.init(sampleProfile)
  const contentKey = contentMeta.url
  const profileKey = profileMeta.url

  const contentUpdate = { description: 'A more accurate description' }
  const profileUpdate = {
    title: 'name',
    description: 'desc'
  }
  await p2p.set({ url: contentKey, ...contentUpdate })
  const { rawJSON: getOnSet } = await p2p.set({
    url: profileKey,
    ...profileUpdate
  })

  const { rawJSON: contentUpdated } = await p2p.get(contentKey)
  const { rawJSON: profileUpdated } = await p2p.get(profileKey)

  t.same(getOnSet, profileUpdated, 'get on set')
  t.same(contentUpdated.description, contentUpdate.description)
  t.same(profileUpdated.title, profileUpdate.title)
  t.same(profileUpdated.description, profileUpdate.description)
  await p2p.destroy()
  t.end()
})

test('set: should throw InvalidKeyError with invalid update', async t => {
  const p2p = createDb()
  const sampleData = {
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  }
  const { rawJSON: metadata } = await p2p.init(sampleData)
  const key = metadata.url

  const license = 'anewkey123456'

  p2p.set({ url: key, license }).catch(err => {
    t.ok(
      err instanceof SDK.errors.InvalidKeyError,
      'error should be instance of InvalidKeyError'
    )
    t.ok(Object.prototype.hasOwnProperty.call(err, 'invalid'))
    t.same(err.invalid, 'license')
    p2p.destroy().then(() => {
      t.end()
    })
  })
})

test('set: should throw validation error with extra params', async t => {
  const p2p = createDb()
  const sampleData = {
    type: 'profile',
    title: 'professor',
    description: 'lorem ipsum'
  }
  const { rawJSON: metadata } = await p2p.init(sampleData)
  const key = metadata.url

  try {
    await p2p.set({
      url: key,
      parents: [
        'be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a'
      ]
    })
  } catch (err) {
    t.ok(
      err instanceof SDK.errors.ValidationError,
      'extra params should throw ValidationError'
    )
  }
  await p2p.destroy()
  t.end()
})

test('set: should throw validation error with future parents', async t => {
  const p2p = createDb()
  const sampleData = {
    type: 'content',
    title: 'random',
    description: 'lorem ipsum',
    parents: [
      'dat://be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a+3'
    ]
  }
  const { rawJSON: metadata } = await p2p.init(sampleData)
  const key = metadata.url

  try {
    await p2p.set({
      url: key,
      parents: [
        'dat://be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a+4'
      ]
    })
  } catch (err) {
    t.ok(
      err instanceof SDK.errors.ValidationError,
      'future parents versions should throw ValidationError'
    )
  }

  await p2p.set({
    url: key,
    parents: [
      'dat://be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a+2'
    ]
  })

  const { rawJSON } = await p2p.get(key)

  t.same(
    rawJSON.parents,
    [
      'dat://be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a+3',
      'dat://be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a+2'
    ],
    'parents updated successfully'
  )

  await p2p.destroy()
  t.end()
})

test('set: should throw validation error with invalid main', async t => {
  const p2p = createDb()
  const sampleProfile = {
    type: 'profile',
    title: 'professor',
    description: 'lorem ipsum'
  }

  const sampleContent = {
    type: 'content',
    title: 'intro to magic',
    description: 'd'
  }

  const { rawJSON: profile } = await p2p.init(sampleProfile)
  const { rawJSON: content } = await p2p.init(sampleContent)

  await p2p.set({
    url: profile.url,
    main: ''
  })

  const { rawJSON: updated } = await p2p.get(profile.url)

  t.same(updated.main, '', 'main can be cleared')

  try {
    await p2p.set({
      url: content.url,
      main: './path/to/something/'
    })
  } catch (err) {
    t.ok(
      err instanceof SDK.errors.ValidationError,
      'invalid path should throw ValidationError'
    )
  }

  await p2p.destroy()
  t.end()
})

test('set: can update main', async t => {
  const p2p = createDb()
  const sampleProfile = {
    type: 'profile',
    title: 'professor',
    description: 'lorem ipsum'
  }

  const sampleContent = {
    type: 'content',
    title: 'intro to magic',
    description: 'd'
  }

  const { rawJSON: profile } = await p2p.init(sampleProfile)
  const { rawJSON: content } = await p2p.init(sampleContent)

  // manually writing a dummy file
  await writeFile(
    join(p2p.baseDir, encode(profile.url), 'file.txt'),
    'hola mundo'
  )

  await p2p.set({
    url: profile.url,
    main: 'file.txt'
  })

  const { rawJSON: updatedProfile } = await p2p.get(profile.url)
  t.same(updatedProfile.main, 'file.txt')

  // manually writing a dummy file
  await writeFile(
    join(p2p.baseDir, encode(content.url), 'file.txt'),
    'hola mundo'
  )

  await p2p.set({
    url: content.url,
    main: 'file.txt'
  })

  const { rawJSON: updatedContent } = await p2p.get(content.url)

  t.same(updatedContent.main, 'file.txt')

  await p2p.destroy()
  t.end()
})

test('set: update should fail with bad data', async t => {
  const p2p = createDb()
  const sampleData = {
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  }
  const { rawJSON: metadata } = await p2p.init(sampleData)
  const key = metadata.url

  try {
    await p2p.set({ url: key, title: '' })
  } catch (err) {
    t.ok(
      err instanceof SDK.errors.ValidationError,
      'error should be instance of ValidationError'
    )
    t.same(err.expected, 'title')
    t.same(err.received, '')
    t.same(err.key, 'title')
    await p2p.destroy()
    t.end()
  }
})

test('set: content and profile idempotent with repeated values', async t => {
  const p2p = createDb()
  const sampleData = {
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum',
    authors: [
      'dat://3f70fe6b663b960a43a2c6c5a254c432196e2efa695e4b4e39779ae22e860e9d'
    ],
    parents: [
      'dat://be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a+4'
    ]
  }

  const sampleProfile = {
    type: 'profile',
    title: 'professorX',
    subtype: '',
    avatar: './test.png',
    follows: [
      'dat://f7daadc2d624df738abbccc9955714d94cef656406f2a850bfc499c2080627d4'
    ],
    contents: [
      'dat://00a4f2f18bb6cb4e9ba7c2c047c8560d34047457500e415d535de0526c6b4f23+12'
    ]
  }

  const { rawJSON: content } = await p2p.init(sampleData)
  const { rawJSON: profile } = await p2p.init(sampleProfile)

  const ckey = content.url
  const pkey = profile.url

  const authors = sampleData.authors.concat(
    'dat://3f70fe6b663b960a43a2c6c5a254c432196e2efa695e4b4e39779ae22e860e9d'
  )

  try {
    // set content data parents field with some repeated values
    await p2p.set({
      url: ckey,
      authors,
      parents: sampleData.parents
    })
  } catch (err) {
    t.ok(
      err instanceof SDK.errors.ValidationError,
      'trying to set duplicated values should throw ValidationError'
    )
  }

  const { rawJSON: cUpdated } = await p2p.get(ckey)
  t.same(cUpdated.authors, sampleData.authors, 'authors remains the same')
  t.same(cUpdated.parents, sampleData.parents, 'parents remains the same')

  // update profile with repeated values
  const contents = [
    'dat://3f70fe6b663b960a43a2c6c5a254c432196e2efa695e4b4e39779ae22e860alf',
    'dat://00a4f2f18bb6cb4e9ba7c2c047c8560d34047457500e415d535de0526c6b4f23+12' // repeated value
  ]
  const follows = [
    'dat://f7daadc2d624df738abbccc9955714d94cef656406f2a850bfc499c2080627d4', // repeated value
    'dat://f7daadc2d624df738abbccc9955714d94cef656406f2a850bfc499c208062123'
  ]

  try {
    await p2p.set({
      url: pkey,
      follows,
      contents
    })
  } catch (err) {
    t.same(
      err.message,
      'clone: Problems fetching external module',
      'if module url is not found it will throw'
    )
  }

  const { rawJSON: pUpdated } = await p2p.get(pkey)

  t.same(pUpdated.follows, sampleProfile.follows, 'follows remains the same')
  t.same(pUpdated.contents, sampleProfile.contents, 'contents remains the same')

  await p2p.destroy()
  t.end()
})

test('follows: must not self-reference', async t => {
  const p2p = createDb()

  t.plan(1)

  const sampleProfile = {
    type: 'profile',
    title: 'professorX',
    subtype: '',
    avatar: './test.png',
    follows: [
      'dat://f7daadc2d624df738abbccc9955714d94cef656406f2a850bfc499c2080627d4'
    ],
    contents: [
      'dat://00a4f2f18bb6cb4e9ba7c2c047c8560d34047457500e415d535de0526c6b4f23+12'
    ]
  }

  const { rawJSON: profile } = await p2p.init(sampleProfile)

  try {
    await p2p.follow(profile.url, profile.url)
  } catch (err) {
    t.ok(
      err instanceof SDK.errors.ValidationError,
      'should throw when tries to self-reference'
    )
  }

  await p2p.destroy()
  t.end()
})

test('set: dont allow future parents versions nor self-reference', async t => {
  const p2p = createDb()
  const sampleData = {
    type: 'content',
    title: 'sample content',
    description: 'lorem ipsum',
    parents: [
      'dat://be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a+4'
    ]
  }
  const { rawJSON } = await p2p.init(sampleData)
  const ckey = rawJSON.url

  try {
    await p2p.set({
      url: ckey,
      parents: [
        'dat://be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a+4',
        'dat://be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a+4',
        'dat://be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a+4'
      ]
    })
  } catch (err) {
    t.ok(
      err instanceof SDK.errors.ValidationError,
      'invalid parents should throw ValidationError'
    )
  }
  await p2p.destroy()
  t.end()
})

test('update: check version change', async t => {
  const p2p = createDb()
  const sampleData = {
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  }
  const { rawJSON: metadata } = await p2p.init(sampleData)
  const key = metadata.url

  const { metadata: metadata1 } = await p2p.get(key, false)

  const description = 'A more accurate description'
  await p2p.set({ url: key, description })
  const { rawJSON: rawJSON2, metadata: metadata2 } = await p2p.get(key, false)

  t.same(rawJSON2.description, description)
  t.ok(
    metadata2.version > metadata1.version,
    'latest version should be bigger than previous version after update'
  )
  t.ok(
    metadata2.lastModified > metadata1.lastModified,
    'lastModified should be bigger than previous lastModified'
  )
  await p2p.destroy()
  t.end()
})

test('list content', async t => {
  const p2p = createDb()
  const sampleDataContent = [
    {
      type: 'content',
      title: 'demo',
      description: 'lorem ipsum'
    },
    {
      type: 'content',
      title: 'demo 2'
    },
    { type: 'content', title: 'sample' }
  ]

  const sampleDataProfile = [{ type: 'profile', title: 'Professor X' }]

  const modules = [].concat(sampleDataContent).concat(sampleDataProfile)

  await Promise.all(modules.map(d => p2p.init(d)))

  const result = await p2p.listContent()
  t.same(result.length, sampleDataContent.length)
  await p2p.destroy()
  t.end()
})

test('list profiles', async t => {
  const p2p = createDb()
  const sampleDataContent = [
    {
      type: 'content',
      title: 'demo',
      description: 'lorem ipsum'
    },
    {
      type: 'content',
      title: 'demo 2'
    },
    { type: 'content', title: 'sample' }
  ]

  const sampleDataProfile = [{ type: 'profile', title: 'Professor X' }]

  await Promise.all(
    []
      .concat(sampleDataContent)
      .concat(sampleDataProfile)
      .map(d => p2p.init(d))
  )
  const result = await p2p.listProfiles()
  t.same(result.length, sampleDataProfile.length)
  await p2p.destroy()
  t.end()
})

test('list modules', async t => {
  const p2p = createDb()
  const sampleData = [
    {
      type: 'content',
      title: 'demo',
      description: 'lorem ipsum'
    },
    {
      type: 'content',
      title: 'demo 2'
    },
    { type: 'content', title: 'sample' },
    { type: 'profile', title: 'Professor X' }
  ]

  await Promise.all([].concat(sampleData).map(d => p2p.init(d)))
  const result = await p2p.list()
  t.same(result.length, sampleData.length)
  await p2p.destroy()
  t.end()
})

test('multiple writes with persistance', async t => {
  try {
    const dir = tempy.directory()

    const p2p1 = new SDK({
      disableSwarm: true,
      watch: false,
      baseDir: dir
    })
    await p2p1.ready()
    const { rawJSON } = await p2p1.init({ type: 'content', title: 'title' })
    t.same(typeof rawJSON.url, 'string')
    await p2p1.destroy()

    // create a new instance with same basedir
    const p2p2 = new SDK({
      watch: false,
      disableSwarm: true,
      baseDir: dir
    })
    await p2p2.ready()
    const metadata = { url: rawJSON.url, title: 'beep' }
    await p2p2.set(metadata)
    await p2p2.set({ url: rawJSON.url, description: 'boop' })
    const { rawJSON: updated } = await p2p2.get(rawJSON.url)

    t.same(updated.title, metadata.title)
    t.same(updated.description, 'boop')
    await p2p2.destroy()

    t.end()
  } catch (err) {
    t.error(err)
  }
})

test('register - local contents', async t => {
  const p2p = createDb()
  const sampleData = [
    {
      type: 'content',
      title: 'demo',
      description: 'lorem ipsum'
    },
    { type: 'profile', title: 'Professor X' }
  ]
  await Promise.all([].concat(sampleData).map(d => p2p.init(d)))

  const profiles = await p2p.listProfiles()
  const contents = await p2p.listContent()

  const { rawJSON: profile } = profiles[0]
  const { rawJSON: content1 } = contents[0]
  const authors = [profile.url]

  // update author on content module
  await p2p.set({ url: content1.url, authors })

  // manually writing a dummy file
  await writeFile(
    join(p2p.baseDir, encode(content1.url), 'file.txt'),
    'hola mundo'
  )
  await p2p.set({
    url: content1.url,
    main: 'file.txt'
  })

  const { metadata } = await p2p.get(content1.url)
  const contentKeyVersion = `${content1.url}+${metadata.version}`

  await p2p.register(contentKeyVersion, profile.url)
  const { rawJSON } = await p2p.get(profile.url)
  t.same(
    rawJSON.contents,
    [contentKeyVersion],
    'registration results in the addition of a dat key to the contents property of the target profile'
  )
  await p2p.destroy()
  t.end()
})


test('seed and register', async t => {
  await localDHT()

  const p2p = createDb({
    swarm: true,
    verbose: true,
    persist: false,
    swarmFn: testSwarmCreator,
    dht,
    dhtBootstrap
  })
  const p2p2 = createDb({
    swarm: true,
    verbose: true,
    persist: false,
    swarmFn: testSwarmCreator,
    dht,
    dhtBootstrap
  })

  const sampleData = {
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  }

  const sampleProfile = { type: 'profile', title: 'Professor X' }

  const { rawJSON: content1, driveWatch } = await p2p2.init(sampleData)
  const { rawJSON: profile } = await p2p.init(sampleProfile)

  const authors = [profile.url]

  // update author on content module
  await p2p2.set({ url: content1.url, authors })
  // manually writing a dummy file
  await writeFile(
    join(p2p2.baseDir, encode(content1.url), 'file.txt'),
    'hola mundo'
  )
  await new Promise(resolve => {
    driveWatch.on('put-end', src => {
      if (src.name.includes('file.txt')) {
        return resolve()
      }
    })
  })
  await p2p2.set({
    url: content1.url,
    main: 'file.txt'
  })

  const { metadata: contentMetadata } = await p2p2.get(content1.url)
  const contentKeyVersion = `${content1.url.replace(/dat:\/\//, '')}+${
    contentMetadata.version
  }`
  const contentKeyVersionPrefix = `dat://${contentKeyVersion}`

  await p2p2.destroy(true, false)

  // call register
  await p2p.register(contentKeyVersionPrefix, profile.url)

  const { rawJSON } = await p2p.get(profile.url)
  t.same(
    rawJSON.contents,
    [contentKeyVersionPrefix],
    'registration results in the addition of a dat key to the contents property of the target profile'
  )
  const dirs = await readdir(p2p.baseDir)
  t.ok(
    dirs.includes(contentKeyVersion),
    'versioned content dir created successfully'
  )

  // call register again
  try {
    await p2p.register(contentKeyVersionPrefix, profile.url)
  } catch (err) {
    t.ok(
      err instanceof SDK.errors.ValidationError,
      'throws ValidationError with duplicated register call'
    )
  }

  const dirs2 = await readdir(p2p.baseDir)
  t.same(
    dirs,
    dirs2,
    'repeated register method call, created directories remains the same'
  )
  await p2p2.destroy(false, true)
  await p2p.destroy()
  t.end()
})

test('verify', async t => {
  const p2p = createDb()
  const sampleData = [
    {
      type: 'content',
      title: 'demo',
      description: 'lorem ipsum'
    },
    {
      type: 'content',
      title: 'demo 2'
    },
    { type: 'profile', title: 'Professor X' }
  ]

  const { rawJSON: profile } = await p2p.init(sampleData[2])
  const { rawJSON: content1, driveWatch } = await p2p.init(sampleData[0])
  const { rawJSON: content2 } = await p2p.init(sampleData[1])

  const authors = [profile.url]

  // manually writing a dummy file
  await writeFile(
    join(p2p.baseDir, encode(content1.url), 'file.txt'),
    'hola mundo'
  )
  await new Promise(resolve => {
    driveWatch.on('put-end', src => {
      if (src.name.includes('file.txt')) {
        return resolve()
      }
    })
  })

  await p2p.set({
    url: content1.url,
    main: 'file.txt'
  })
  // update author on content module
  await p2p.set({ url: content1.url, authors })
  // update content in author profile

  const { metadata: metadata2 } = await p2p.get(content1.url)

  await p2p.register(`${content1.url}+${metadata2.version}`, profile.url)

  const result = await p2p.verify(`${content1.url}+${metadata2.version}`)

  t.ok(result, 'content meets the verification requirements')

  try {
    await p2p.verify(content2.url)
  } catch (err) {
    t.same(
      err.message,
      'Module can not be verified: unversioned content',
      'verify should throw with an unversioned content module'
    )
  }

  await p2p.destroy()
  t.end()
})

test('verify multiple authors', async t => {
  const p2p = createDb({
    swarm: true,
    persist: false,
    swarmFn: testSwarmCreator,
    dht,
    dhtBootstrap
  })
  const p2p2 = createDb({
    swarm: true,
    persist: false,
    swarmFn: testSwarmCreator,
    dht,
    dhtBootstrap
  })
  const sampleData = {
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  }
  const sampleProfile = { type: 'profile', title: 'Professor X' }

  const externalProfile = { type: 'profile', title: 'Professor Y' }

  const { rawJSON: content1, driveWatch } = await p2p.init(sampleData)
  const { rawJSON: profile } = await p2p.init(sampleProfile)

  const { rawJSON: profileY } = await p2p2.init(externalProfile)

  // content has multiple authors
  const authors = [profile.url, profileY.url]
  // update authors on content module
  await p2p.set({ url: content1.url, authors })

  // manually writing a dummy file
  await writeFile(
    join(p2p.baseDir, encode(content1.url), 'file.txt'),
    'hola mundo'
  )
  await new Promise(resolve => {
    driveWatch.on('put-end', src => {
      if (src.name.includes('file.txt')) {
        return resolve()
      }
    })
  })
  await p2p.set({
    url: content1.url,
    main: 'file.txt'
  })

  const { rawJSON, metadata } = await p2p.get(content1.url)
  t.same(rawJSON.authors, authors, 'content authors contains two profiles')
  const versioned = `${content1.url}+${metadata.version}`
  // update content in authors profiles
  await p2p.register(versioned, profile.url)
  await p2p2.register(versioned, profileY.url)

  const { rawJSON: pUpdated } = await p2p.get(profile.url)
  const { rawJSON: pUpdatedY } = await p2p2.get(profileY.url)
  t.same(pUpdated.contents, [versioned], 'profile 1 updated ok')
  t.same(pUpdatedY.contents, [versioned], 'profile 2 updated ok')

  const result = await p2p.verify(versioned)

  t.ok(result, 'content with multiple authors is verified ok')

  await p2p.destroy()
  await p2p2.destroy()
  t.end()
})

test('re-open SDK (child process)', async t => {
  const dir = tempy.directory()

  const commons = new SDK({
    disableSwarm: true,
    watch: false,
    persist: true,
    baseDir: dir
  })

  await commons.ready()

  // create content
  const { rawJSON: contentDat } = await commons.init({
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  })

  await commons.destroy()

  // another sdk instance will update the content
  const code = join(__dirname, 'childProcess.js')
  await execa.node(code, [contentDat.url, dir])

  const commons2 = new SDK({
    disableSwarm: true,
    watch: false,
    persist: true,
    baseDir: dir
  })

  await commons2.ready()

  // finally we check everything is updated correctly
  const { rawJSON: updated } = await commons2.get(contentDat.url)

  t.equal(updated.title, 'UPDATED')
  await commons2.destroy()
  t.end()
})

test('delete a module from local db', async t => {
  const dir = tempy.directory()
  const p2p = new SDK({
    disableSwarm: true,
    watch: false,
    baseDir: dir
  })

  const modules = await p2p.list()
  t.equal(modules.length, 0, 'Modules list is empty')
  // create content
  const { rawJSON: content } = await p2p.init({
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  })

  const { rawJSON: content2 } = await p2p.init({
    type: 'content',
    title: 'demo 2',
    description: 'lorem ipsum 2'
  })

  const modules2 = await p2p.list()
  t.equal(modules2.length, 2, 'Modules list contains 2 elements')
  // soft delete content
  await p2p.delete(content.url)

  const modules3 = await p2p.list()
  t.equal(modules3.length, 1, 'Modules list contains 1 element')

  // hard delete
  await p2p.delete(content2.url, true)
  const baseDir = await readdir(join(p2p.baseDir))

  t.notok(
    baseDir.includes(encode(content2.url)),
    'Module folder has been removed'
  )

  const modules4 = await p2p.list()
  t.equal(modules4.length, 0, 'Modules list is empty again')
  await p2p.destroy()
  t.end()
})

test('delete registered module', async t => {
  const dir = tempy.directory()
  const p2p = new SDK({
    disableSwarm: true,
    watch: false,
    baseDir: dir
  })

  const modules = await p2p.list()
  t.equal(modules.length, 0, 'Modules list is empty')

  // create content
  const { rawJSON: content, driveWatch } = await p2p.init({
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  })

  const { rawJSON: profile } = await p2p.init({
    type: 'profile',
    title: 'professor X',
    description: 'd'
  })

  const contentModules = await p2p.listContent()
  t.equal(contentModules.length, 1, '1 content module exists')

  // register
  const authors = [profile.url]
  // manually writing a dummy file
  await writeFile(join(dir, encode(content.url), 'file.txt'), 'hola mundo')

  await p2p.set({
    url: content.url,
    authors,
    main: 'file.txt'
  })
  await p2p.register(content.url, profile.url)
  const { rawJSON: updatedProfile } = await p2p.get(profile.url)
  t.same(updatedProfile.contents.length, 1, 'content registered')

  // hard delete
  await p2p.delete(content.url, true)

  const { rawJSON: finalProfile } = await p2p.get(profile.url)
  t.same(finalProfile.contents.length, 0, 'content deregistered after delete')

  const baseDir = await readdir(join(p2p.baseDir))

  const contentModulesFinal = await p2p.listContent()
  t.equal(contentModulesFinal.length, 0, '0 content module remains')

  t.notok(
    baseDir.includes(encode(content.url)),
    'Module folder has been removed (deleteFiles)'
  )

  await p2p.destroy()
  t.end()
})

test('deregister content module from profile', async t => {
  const p2p = createDb()
  const sampleContent = {
    type: 'content',
    title: 'demo 1',
    description: 'lorem ipsum'
  }

  const { rawJSON: content, driveWatch } = await p2p.init(sampleContent)

  const sampleProfile = {
    type: 'profile',
    title: 'd'
  }

  const { rawJSON: profile } = await p2p.init(sampleProfile)

  // Manually setting the author profile
  await p2p.set({ url: content.url, authors: [profile.url] })

  t.equal(profile.contents.length, 0, 'profile.contents is empty')

  // manually writing a dummy file
  await writeFile(
    join(p2p.baseDir, encode(content.url), 'file.txt'),
    'hola mundo'
  )

  await new Promise(resolve => {
    driveWatch.on('put-end', src => {
      if (src.name.includes('file.txt')) {
        return resolve()
      }
    })
  })

  await p2p.set({
    url: content.url,
    main: 'file.txt'
  })

  const { metadata: contentMeta } = await p2p.get(content.url)
  const versioned = `${content.url}+${contentMeta.version}`
  await p2p.register(versioned, profile.url)

  const { rawJSON: updatedProfile } = await p2p.get(profile.url)

  t.equal(updatedProfile.contents.length, 1)

  await p2p.deregister(versioned, profile.url)

  const { rawJSON: deletedContent } = await p2p.get(profile.url)

  t.equal(deletedContent.contents.length, 0, 'content deregistered successfully')

  await p2p.destroy()
  t.end()
})

test('follow and unfollow a profile', async t => {
  const p2p = createDb({
    swarm: true,
    persist: false,
    swarmFn: testSwarmCreator,
    dht,
    dhtBootstrap
  })
  const p2p2 = createDb({
    swarm: true,
    persist: false,
    swarmFn: testSwarmCreator,
    dht,
    dhtBootstrap
  })

  const professorX = {
    type: 'profile',
    title: 'Professor X'
  }

  const professorY = {
    type: 'profile',
    title: 'Professor Y'
  }

  const { rawJSON: profileX } = await p2p.init(professorX)
  const { rawJSON: profileY, metadata } = await p2p2.init(professorY)

  const followUrl = profileY.url
  const followVersionedUrl = `${profileY.url}+${metadata.version}`

  t.equal(profileX.follows.length, 0, 'Initially follows should be empty')

  // call follow (unversioned)
  await p2p.follow(profileX.url, followUrl)

  // follow an nonexistant profile should throw
  try {
    await p2p.follow(
      profileX.url,
      'dat://be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a'
    )
  } catch (err) {
    t.same(
      err.message,
      'clone: Problems fetching external module',
      'Trying to follow a nonexistant module should throw'
    )
  }

  const { rawJSON: profileXUpdated } = await p2p.get(profileX.url)
  t.equal(profileXUpdated.follows.length, 1, 'following 1 new profile')
  t.same(
    profileXUpdated.follows,
    [followUrl],
    'follows property should contain target profile url'
  )

  // unfollow versioned profile url which does not exists
  await p2p.unfollow(profileX.url, followVersionedUrl)

  const { rawJSON: profileXSame } = await p2p.get(profileX.url)
  t.equal(
    profileXSame.follows.length,
    1,
    'unfollow does nothing when profile does not match (versioned)'
  )

  // unfollow unversioned profile url
  await p2p.unfollow(profileX.url, followUrl)

  const { rawJSON: profileXFinal } = await p2p.get(profileX.url)
  t.equal(
    profileXFinal.follows.length,
    0,
    'unfollow removes the target profile'
  )

  // call follow (versioned)
  await p2p.follow(profileX.url, followVersionedUrl)

  const { rawJSON: profileXUpdated2 } = await p2p.get(profileX.url)
  t.equal(profileXUpdated2.follows.length, 1, 'following 1 new profile')
  t.same(
    profileXUpdated2.follows,
    [followVersionedUrl],
    'follows property should contain target profile versioned url'
  )

  // unfollow unversioned profile but only versioned is being followed
  await p2p.unfollow(profileX.url, followUrl)

  const { rawJSON: profileXNoChange } = await p2p.get(profileX.url)
  t.equal(
    profileXNoChange.follows.length,
    1,
    'unfollow does nothing when the target profile does not match (unversioned)'
  )

  // unfollow versioned profile url
  await p2p.unfollow(profileX.url, followVersionedUrl)

  const { rawJSON: profileXFinal2 } = await p2p.get(profileX.url)
  t.equal(
    profileXFinal2.follows.length,
    0,
    'unfollow removes the target versioned profile '
  )

  await p2p.destroy()
  await p2p2.destroy()

  t.end()
})

test('clone a module', async t => {
  const dir = tempy.directory()
  const dir2 = tempy.directory()

  const p2p = new SDK({
    disableSwarm: false,
    persist: true,
    baseDir: dir,
    swarm: testSwarmCreator,
    dht,
    dhtBootstrap
  })

  const p2p2 = new SDK({
    disableSwarm: false,
    persist: true,
    baseDir: dir2,
    swarm: testSwarmCreator,
    dht,
    dhtBootstrap
  })

  await p2p2.ready()

  const content = {
    type: 'content',
    title: 'test'
  }

  const { rawJSON, driveWatch } = await p2p.init(content)
  const rawJSONpath = rawJSON.url.replace('dat://', '')

  // write main.txt
  await writeFile(join(dir, rawJSONpath, 'main.txt'), 'hello')

  driveWatch.on('put-end', async file => {
    if (!file.name.endsWith('main.txt')) return

    const { rawJSON: module, dwldHandle, metadata } = await p2p2.clone(
      rawJSON.url
    )

    t.same(module.title, content.title)

    await once(dwldHandle, 'end')

    const clonedDir = await readdir(
      join(p2p2.baseDir, `${rawJSONpath}+${metadata.version}`)
    )
    t.ok(
      clonedDir.includes('main.txt'),
      'clone downloaded content successfully'
    )
    await p2p.destroy()
    await p2p2.destroy()
    t.end()
  })
})

test('cancel clone', async t => {
  const dir = tempy.directory()
  const dir2 = tempy.directory()

  const p2p = new SDK({
    disableSwarm: false,
    persist: true,
    baseDir: dir,
    swarm: testSwarmCreator,
    dht,
    dhtBootstrap
  })

  const p2p2 = new SDK({
    disableSwarm: false,
    persist: true,
    baseDir: dir2,
    swarm: testSwarmCreator,
    dht,
    dhtBootstrap
  })

  const content = {
    type: 'content',
    title: 'test'
  }

  const { rawJSON, driveWatch } = await p2p.init(content)
  const rawJSONpath = rawJSON.url.replace('dat://', '')

  // write main.txt
  await writeFile(join(dir, rawJSONpath, 'main.txt'), 'hello')

  await once(driveWatch, 'put-end')

  // clone can be canceled
  const cloning = p2p2.clone(rawJSON.url)
  cloning.cancel()

  t.ok(cloning.isCanceled, 'cloning promise is canceled')

  const clonedDir = existsSync(join(p2p2.baseDir, rawJSONpath))
  t.notOk(clonedDir, 'clone dir does not exists')

  await p2p.destroy()
  await p2p2.destroy()
  t.end()
})

test('leveldb open error', async t => {
  const dir = tempy.directory()
  const db = level(`${dir}/db`)
  await db.open()
  const commons = new SDK({
    disableSwarm: true,
    watch: false,
    persist: true,
    baseDir: dir
  })

  let err
  try {
    await commons.ready()
  } catch (_err) {
    err = _err
  }
  t.ok(err)

  t.end()
})

test('check lastModified on ready', async t => {
  const dir = tempy.directory()

  const p2p = new SDK({
    disableSwarm: true,
    watch: false,
    persist: true,
    baseDir: dir
  })

  const profileData = {
    type: 'profile',
    title: 'Professor X'
  }
  const contentData = {
    type: 'content',
    title: 'test',
    description: 'sample content'
  }

  const { rawJSON: content, metadata: cMetadataInitial } = await p2p.init(
    contentData
  )

  const { rawJSON: profile, metadata: pMetadataInitial } = await p2p.init(
    profileData
  )

  const contentPath = encode(content.url)

  // write main.txt
  await writeFile(join(dir, contentPath, 'main.txt'), 'hello')

  await writeFile(join(dir, contentPath, 'main2.txt'), 'hello')
  await p2p.set({ url: content.url, main: 'main.txt' })
  const { rawJSON, metadata: cMetadataUpdate } = await p2p.get(content.url)

  t.ok(
    cMetadataInitial.lastModified.getTime() <
      cMetadataUpdate.lastModified.getTime(),
    'content metadata lastModified is updated'
  )

  await p2p.destroy()

  // update main.txt while sdk is off...
  await writeFile(join(dir, contentPath, 'main.txt'), 'hello world')
  rawJSON.description = 'what is this??'
  await writeFile(join(dir, contentPath, 'index.json'), JSON.stringify(rawJSON))

  const p2p2 = new SDK({
    disableSwarm: true,
    watch: false,
    persist: true,
    baseDir: dir
  })
  await p2p2.ready()

  const { metadata: cMetadataFinal } = await p2p2.get(content.url)

  const all = await p2p2.list()

  t.same(all.length, 2)

  t.ok(
    cMetadataFinal.lastModified.getTime() >
      cMetadataUpdate.lastModified.getTime(),
    'latest content metadata (lastModified) should be bigger than previous one (offline update)'
  )

  await p2p2.destroy()
  t.end()
})

test.onFinish(async () => {
  if (dht) {
    await dht.destroy()
    dht = null
  }
})
