const {
  existsSync,
  promises: { writeFile, readdir }
} = require('fs')
const { join } = require('path')
const execa = require('execa')
const { EventEmitter } = require('events')
const once = require('events.once')
const test = require('tape')
const tempy = require('tempy')
const level = require('level')
const SwarmNetwoker = require('corestore-swarm-networking')
const { encode } = require('dat-encoding')
const proxyquire = require('proxyquire')
const mirror = require('mirror-folder')
const SDK = require('../')
const createDHT = require('./utils/dht')
const vers = require('../lib/spec')

const testSwarmCreator = (store, opts) => new SwarmNetwoker(store, opts)

let dht, dhtBootstrap

const localDHT = async () => {
  const { url, node } = await createDHT()
  dht = node
  dhtBootstrap = url
}

const defaultOpts = () => ({
  swarm: false,
  persist: false
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

test('sdk re-start', async t => {
  await localDHT()
  // issue arise when we have external content in our db, lets fix that

  const p2p = createDb({ swarm: true, persist: true, dhtBootstrap })

  const p2p2 = createDb({ swarm: true, persist: true, dhtBootstrap })

  const p2p3 = createDb({ swarm: true, persist: true, dhtBootstrap })

  const externalContent = {
    type: 'content',
    title: 'demo content',
    description: 'something remote'
  }
  const {
    rawJSON,
    metadata: { version: remoteVersion }
  } = await p2p.init(externalContent)

  const localProfile = {
    type: 'profile',
    title: 'professorX'
  }
  await p2p2.init(localProfile)

  // p2p2 clones the module
  const { rawJSON: remoteJSON } = await p2p2.clone(rawJSON.url)
  t.same(remoteJSON, rawJSON, 'cloned module')
  // some other peer clone the content module too
  await p2p3.clone(rawJSON.url)

  // shutdown sdk instances
  await p2p2.destroy()
  await p2p3.destroy()

  // content is updated remotely...
  const {
    metadata: { version: updatedVersion }
  } = await p2p.set({ url: rawJSON.url, description: 'something updated' })
  t.ok(updatedVersion > remoteVersion, 'version is incremented')

  // restart other peer
  const otherPeer = new SDK({
    bootstrap: dhtBootstrap,
    baseDir: p2p3.baseDir
  })
  await otherPeer.ready()

  // now instantiate back p2p2 sdk (same storage, same db)
  const p2p4 = new SDK({
    bootstrap: dhtBootstrap,
    baseDir: p2p2.baseDir,
    versose: true
  })

  try {
    await p2p4.ready()
  } catch (err) {
    t.fail(err)
  }
  t.pass('all good')
  await otherPeer.destroy()
  await p2p.destroy()
  await p2p4.destroy()
  t.end()
})

test('SDK emit warning', async t => {
  class EBUSYMock extends Error {
    constructor (message) {
      super(message)
      this.code = 'EBUSY'
    }
  }

  const mockDat = {
    './lib/dat-helper.js': {
      importFiles: async (drive, src, opts) => {
        const finalOpts = { ...opts, watch: false }
        await new Promise((resolve, reject) => {
          mirror(src, { name: '/', fs: drive }, finalOpts, err => {
            if (err) {
              return reject(err)
            }
            return resolve()
          })
        })

        const ee = new EventEmitter()

        ee.destroy = () => {}
        setTimeout(() => {
          ee.emit('error', new EBUSYMock('EBUSY mock error'))
        }, 1000)
        return ee
      }
    }
  }

  const SDK = proxyquire('../', mockDat)

  const p2p = new SDK({
    disableSwarm: true,
    baseDir: tempy.directory()
  })
  await p2p.ready()

  const contentData = {
    type: 'content',
    subtype: 'Theory',
    title: 'demo'
  }
  const { rawJSON } = await p2p.init(contentData)

  const [warn] = await once(p2p, 'warn')

  t.ok(
    warn instanceof SDK.errors.EBUSYError,
    'emits expected warning with EBUSYError'
  )
  t.same(rawJSON.title, contentData.title)
  t.same(rawJSON.type, contentData.type)
  t.same(rawJSON.subtype, contentData.subtype)
  await p2p.destroy()
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
      '3f70fe6b663b960a43a2c6c5a254c432196e2efa695e4b4e39779ae22e860e9d'
    ],
    parents: [
      'be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a+4'
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
  t.same(
    output.links.spec[0].href,
    `https://p2pcommons.com/specs/module/${vers.module}`
  )
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

test('init: empty creation should throw a ValidationError', async t => {
  const p2p = createDb()
  const metadata = {}
  try {
    await p2p.init(metadata)
  } catch (err) {
    t.ok(err, 'An error should happen')
    t.ok(
      err instanceof SDK.errors.ValidationError,
      'It should be a custom SDK error'
    )
    t.ok(Object.prototype.hasOwnProperty.call(err, 'description'))
    t.ok(Object.prototype.hasOwnProperty.call(err, 'code'))
    t.ok(Object.prototype.hasOwnProperty.call(err, 'property'))
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
  t.same(
    output.links.spec[0].href,
    `https://p2pcommons.com/specs/module/${vers.module}`
  )
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

test('saveItem: should throw ValidationError with invalid metadata', async t => {
  const dir = tempy.directory()

  const p2p = new SDK({
    baseDir: dir,
    dht,
    bootstrap: dhtBootstrap
  })

  const sampleData = {
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  }

  const { rawJSON } = await p2p.init(sampleData)

  const key = rawJSON.url

  try {
    const { rawJSON: updated, metadata } = await p2p.saveItem({
      isWritable: false,
      lastModified: new Date(),
      version: '5',
      indexJSON: {
        url: key,
        title: 'demo',
        description: 'something new',
        links: {
          license: [
            {
              href:
                'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
            }
          ],
          spec: [{ href: 'https://p2pcommons.com/specs/module/x.x.x' }]
        },
        p2pcommons: {
          type: 'content',
          subtype: '123',
          main: '',
          authors: [],
          parents: []
        }
      }
    })
    t.same(updated.description, 'something new')
    t.same(metadata.version, 5)
  } catch (err) {
    t.fail(err)
  }
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
  const { rawJSON: content, metadata: initialMeta } = await p2p.init(
    sampleContent
  )

  // manually writing a dummy file
  await writeFile(
    join(p2p.baseDir, encode(profile.url), 'file.txt'),
    'hola mundo'
  )

  const { rawJSON: updatedProfile } = await p2p.set({
    url: profile.url,
    main: 'file.txt'
  })

  t.same(updatedProfile.main, 'file.txt')

  // manually writing a dummy file
  await writeFile(
    join(p2p.baseDir, encode(content.url), 'file.txt'),
    'hola mundo'
  )

  const { rawJSON: updatedContent, metadata: updatedMeta } = await p2p.set({
    url: content.url,
    main: 'file.txt'
  })

  t.same(updatedContent.main, 'file.txt')
  t.ok(updatedMeta.version > initialMeta.version, 'version bump')

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
    t.same(err.description, 'Title must be between 1 and 300 characters long')
    t.same(err.code, 'title_length')
    t.same(err.property, 'title')
    await p2p.destroy()
    t.end()
  }
})

test('set: content, follows, authors, parents idempotent with repeated values', async t => {
  const p2p = createDb()

  const followedProfile1 = {
    type: 'profile',
    title: 'followed1'
  }

  const followedProfile2 = {
    type: 'profile',
    title: 'followed2'
  }

  const parentContent1 = {
    type: 'content',
    title: 'parent1'
  }

  const parentContent2 = {
    type: 'content',
    title: 'parent2'
  }

  const {
    rawJSON: { url: followedProfile1Url }
  } = await p2p.init(followedProfile1)
  const {
    rawJSON: { url: followedProfile2Url }
  } = await p2p.init(followedProfile2)
  const {
    rawJSON: { url: parentContent1Url },
    metadata: { version: parentContent1Version }
  } = await p2p.init(parentContent1)
  const {
    rawJSON: { url: parentContent2Url },
    metadata: { version: parentContent2Version }
  } = await p2p.init(parentContent2)

  const sampleProfile = {
    type: 'profile',
    title: 'professorX',
    subtype: '',
    avatar: './test.png',
    follows: [encode(followedProfile1Url), encode(followedProfile2Url)]
  }

  const { rawJSON: profile } = await p2p.init(sampleProfile)
  const profileKey = encode(profile.url)

  const sampleData = {
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum',
    authors: [profileKey],
    parents: [
      `${encode(parentContent1Url)}+${parentContent1Version}`,
      `${encode(parentContent2Url)}+${parentContent2Version}`
    ]
  }

  const { rawJSON: content } = await p2p.init(sampleData)
  const contentKey = encode(content.url)

  await writeFile(join(p2p.baseDir, contentKey, 'file.txt'), 'hola mundo')

  await p2p.set({
    url: contentKey,
    main: 'file.txt'
  })

  const authors = sampleData.authors.concat(encode(followedProfile1Url))

  try {
    // set content data authors field with some repeated values
    await p2p.set({
      url: contentKey,
      authors
    })
  } catch (err) {
    t.same(err.code, 'authors_unique', 'Authors must be unique')
  }

  try {
    // set content data parents & authors field with some repeated values
    await p2p.set({
      url: contentKey,
      parents: [`${encode(parentContent1Url)}+${parentContent1Version}`]
    })
  } catch (err) {
    t.same(err.code, 'parents_unique', 'Parents must be unique')
  }

  const { rawJSON: cUpdated } = await p2p.get(contentKey)
  t.same(cUpdated.authors, sampleData.authors, 'authors remains the same')
  t.same(cUpdated.parents, sampleData.parents, 'parents remains the same')

  // update profile with repeated values

  try {
    await p2p.set({
      url: profileKey,
      follows: [encode(followedProfile2Url)]
    })
  } catch (err) {
    t.same(err.code, 'follows_unique', 'Follows must be unique')
  }

  const { rawJSON: pUpdated } = await p2p.get(profileKey)

  t.same(pUpdated.follows, sampleProfile.follows, 'follows remains the same')

  await p2p.set({
    url: profileKey,
    contents: [encode(contentKey)]
  })

  const { rawJSON: pRegistered } = await p2p.get(profileKey)

  try {
    await p2p.set({
      url: profileKey,
      contents: [encode(contentKey)]
    })
  } catch (err) {
    t.same(err.code, 'contents_unique', 'Contents must be unique')
  }

  const { rawJSON: pRegistered2 } = await p2p.get(profileKey)

  t.same(
    pRegistered2.contents,
    pRegistered.contents,
    'contents remains the same'
  )

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
      'f7daadc2d624df738abbccc9955714d94cef656406f2a850bfc499c2080627d4'
    ],
    contents: [
      '00a4f2f18bb6cb4e9ba7c2c047c8560d34047457500e415d535de0526c6b4f23+12'
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
      'be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a+4'
    ]
  }
  const { rawJSON } = await p2p.init(sampleData)
  const ckey = rawJSON.url

  try {
    await p2p.set({
      url: ckey,
      parents: [
        'be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a+4',
        'be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a+4',
        'be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a+4'
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
  const sampleDataProfile = [
    { type: 'profile', title: 'Professor X' },
    { type: 'profile', title: 'Mystique' }
  ]
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
  const [
    {
      rawJSON: { url }
    }
  ] = await Promise.all(
    []
      .concat(sampleDataProfile)
      .concat(sampleDataContent)
      .map(d => p2p.init(d))
  )

  await p2p.saveItem({
    isWritable: false,
    lastModified: new Date(),
    version: '5',
    indexJSON: {
      url,
      title: sampleDataProfile[0].title,
      description: '',
      links: {
        license: [
          {
            href: 'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
          }
        ],
        spec: [{ href: 'https://p2pcommons.com/specs/module/x.x.x' }]
      },
      p2pcommons: {
        type: 'profile',
        subtype: '',
        main: '',
        avatar: '',
        follows: [],
        contents: []
      }
    }
  })

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
    t.fail(err)
  }
})

test('register - local contents', async t => {
  const p2p = createDb({ persist: true })

  const { rawJSON: profile } = await p2p.init({
    type: 'profile',
    title: 'Professor X'
  })
  const { rawJSON: content1 } = await p2p.init({
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  })

  const authors = [encode(profile.url)]

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
  const contentKeyVersion = `${encode(content1.url)}+${metadata.version}`

  try {
    await p2p.register(contentKeyVersion, encode(profile.url))
  } catch (err) {
    t.fail(err.message)
  }
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
  const p2p = createDb({
    swarm: true,
    persist: true,
    dhtBootstrap
  })
  const p2p2 = createDb({
    swarm: true,
    persist: true,
    dhtBootstrap
  })

  const sampleData = {
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  }

  const sampleProfile = { type: 'profile', title: 'Professor X' }

  const { rawJSON: content1 } = await p2p2.init(sampleData)
  const { rawJSON: profile } = await p2p.init(sampleProfile)

  const authors = [encode(profile.url)]

  // update author on content module
  await p2p2.set({ url: content1.url, authors })
  // manually writing a dummy file
  await writeFile(
    join(p2p2.baseDir, encode(content1.url), 'file.txt'),
    'hola mundo'
  )

  await p2p2.set({
    url: content1.url,
    main: 'file.txt'
  })

  const { metadata: contentMetadata } = await p2p2.get(content1.url)
  const contentKeyVersion = `${encode(content1.url)}+${contentMetadata.version}`

  await p2p2.destroy(true, false)

  // call register
  try {
    await p2p.register(contentKeyVersion, encode(profile.url))
  } catch (err) {
    t.fail(err.message)
  }

  const { rawJSON } = await p2p.get(profile.url)
  t.same(
    rawJSON.contents,
    [contentKeyVersion],
    'registration results in the addition of a dat key to the contents property of the target profile'
  )

  const dirs = await readdir(p2p.baseDir)
  t.ok(
    dirs.includes(contentKeyVersion),
    'versioned content dir created successfully'
  )

  // call register again
  try {
    await p2p.register(contentKeyVersion, encode(profile.url))
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
  const { rawJSON: content1 } = await p2p.init(sampleData[0])
  const { rawJSON: content2 } = await p2p.init(sampleData[1])

  const authors = [encode(profile.url)]

  // manually writing a dummy file
  await writeFile(
    join(p2p.baseDir, encode(content1.url), 'file.txt'),
    'hola mundo'
  )

  await p2p.set({
    url: content1.url,
    main: 'file.txt'
  })
  // update author on content module
  await p2p.set({ url: content1.url, authors })
  // update content in author profile

  const { metadata: metadata2 } = await p2p.get(content1.url)
  const versionedKey = `${encode(content1.url)}+${metadata2.version}`

  try {
    await p2p.register(versionedKey, profile.url)
  } catch (err) {
    t.fail(err.message)
  }

  const result = await p2p.verify(versionedKey)

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

  const { rawJSON: content1 } = await p2p.init(sampleData)
  const { rawJSON: profile } = await p2p.init(sampleProfile)

  const { rawJSON: profileY } = await p2p2.init(externalProfile)

  // content has multiple authors
  const authors = [encode(profile.url), encode(profileY.url)]
  // update authors on content module
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

  const { rawJSON, metadata } = await p2p.get(content1.url)
  t.same(rawJSON.authors, authors, 'content authors contains two profiles')
  const versionedKey = `${encode(content1.url)}+${metadata.version}`
  // update content in authors profiles
  try {
    await p2p.register(versionedKey, encode(profile.url))
  } catch (err) {
    t.fail(err.message)
  }
  try {
    await p2p2.register(versionedKey, encode(profileY.url))
  } catch (err) {
    t.fail(err.message)
  }

  const { rawJSON: pUpdated } = await p2p.get(profile.url)
  const { rawJSON: pUpdatedY } = await p2p2.get(profileY.url)
  t.same(pUpdated.contents, [versionedKey], 'profile 1 updated ok')
  t.same(pUpdatedY.contents, [versionedKey], 'profile 2 updated ok')

  const result = await p2p.verify(versionedKey)

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
  const { rawJSON: content } = await p2p.init({
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
  const authors = [encode(profile.url)]
  // manually writing a dummy file
  await writeFile(join(dir, encode(content.url), 'file.txt'), 'hola mundo')

  await p2p.set({
    url: content.url,
    authors,
    main: 'file.txt'
  })

  try {
    await p2p.register(encode(content.url), encode(profile.url))
  } catch (err) {
    t.fail(err.message)
  }
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

  const { rawJSON: content } = await p2p.init(sampleContent)

  const sampleProfile = {
    type: 'profile',
    title: 'd'
  }

  const { rawJSON: profile } = await p2p.init(sampleProfile)

  // Manually setting the author profile
  await p2p.set({ url: content.url, authors: [encode(profile.url)] })

  t.equal(profile.contents.length, 0, 'profile.contents is empty')

  // manually writing a dummy file
  await writeFile(
    join(p2p.baseDir, encode(content.url), 'file.txt'),
    'hola mundo'
  )

  await p2p.set({
    url: content.url,
    main: 'file.txt'
  })

  const { metadata: contentMeta } = await p2p.get(content.url)
  const versioned = `${encode(content.url)}+${contentMeta.version}`
  try {
    await p2p.register(versioned, profile.url)
  } catch (err) {
    t.fail(err.message)
  }

  const { rawJSON: updatedProfile } = await p2p.get(profile.url)

  t.equal(updatedProfile.contents.length, 1)

  await p2p.deregister(versioned, profile.url)

  const { rawJSON: deletedContent } = await p2p.get(profile.url)

  t.equal(
    deletedContent.contents.length,
    0,
    'content deregistered successfully'
  )

  await p2p.destroy()
  t.end()
})

test('deregister content - more complex case', async t => {
  const p2p = createDb({ persist: true })
  const sampleContent = {
    type: 'content',
    title: 'demo 1',
    description: 'lorem ipsum'
  }

  const sampleContent2 = {
    type: 'content',
    title: 'demo 2',
    description: 'lorem ipsum'
  }

  const sampleContent3 = {
    type: 'content',
    title: 'demo 3',
    description: 'lorem ipsum'
  }

  // create multiple content
  const { rawJSON: content, driveWatch } = await p2p.init(sampleContent)
  const {
    rawJSON: { url: url2 },
    driveWatch: dw2
  } = await p2p.init(sampleContent2)
  const {
    rawJSON: { url: url3 },
    driveWatch: dw3
  } = await p2p.init(sampleContent3)

  const sampleProfile = {
    type: 'profile',
    title: 'd'
  }

  // create my profile
  const { rawJSON: profile } = await p2p.init(sampleProfile)

  const pUrl = encode(profile.url)
  // Manually setting the author profile
  await p2p.set({ url: content.url, authors: [pUrl] })
  await p2p.set({ url: url2, authors: [pUrl] })
  await p2p.set({ url: url3, authors: [pUrl] })

  // manually writing a dummy file 1
  await writeFile(join(p2p.baseDir, encode(content.url), 'file.txt'), 'main1')

  await p2p.set({
    url: content.url,
    main: 'file.txt'
  })
  // manually writing a dummy file 2
  await writeFile(join(p2p.baseDir, encode(url2), 'file.txt'), 'main2')
  await once(dw2, 'put-end')
  const {
    metadata: { version: v2 }
  } = await p2p.set({
    url: url2,
    main: 'file.txt'
  })
  // manually writing a dummy file 3
  await writeFile(join(p2p.baseDir, encode(url3), 'file.txt'), 'main3')
  await once(dw3, 'put-end')
  const {
    metadata: { version: v3 }
  } = await p2p.set({
    url: url3,
    main: 'file.txt'
  })

  // register the modules (unversioned)
  await p2p.register(content.url, profile.url)
  await p2p.register(url2, profile.url)
  await p2p.register(url3, profile.url)

  const { rawJSON: updatedProfile } = await p2p.get(profile.url)
  t.equal(updatedProfile.contents.length, 3, '3 registrations')
  // make some changes
  await writeFile(
    join(p2p.baseDir, encode(content.url), 'new_file.txt'),
    'hallo'
  )
  await once(driveWatch, 'put-end')

  // deregister all modules
  await p2p.deregister(content.url, profile.url)
  await p2p.deregister(url2, profile.url)
  await p2p.deregister(url3, profile.url)

  // register all modules again (versioned)
  const {
    metadata: { version: v1 }
  } = await p2p.get(content.url)
  const versioned = `${content.url}+${v1}`
  const versioned2 = `${url2}+${v2}`
  const versioned3 = `${url3}+${v3}`

  await p2p.register(versioned, profile.url)

  await p2p.register(versioned2, profile.url)

  await p2p.register(versioned3, profile.url)

  // deregister updated module
  await p2p.deregister(versioned, profile.url)
  const { rawJSON: finalProfile } = await p2p.get(profile.url)
  t.notOk(
    finalProfile.contents.includes(versioned),
    'should deregister specific key'
  )

  driveWatch.destroy()
  dw2.destroy()
  dw3.destroy()
  await p2p.destroy()
  t.end()
})

test('follow and unfollow a profile', async t => {
  const p2p = createDb({
    swarm: true,
    persist: false,
    dht,
    dhtBootstrap
  })
  const p2p2 = createDb({
    swarm: true,
    persist: false,
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
  const followVersionedKey = `${encode(profileY.url)}+${metadata.version}`

  t.equal(profileX.follows.length, 0, 'Initially follows should be empty')

  // call follow (unversioned)
  await p2p.follow(encode(profileX.url), encode(followUrl))

  // follow an nonexistant profile should throw
  try {
    await p2p.follow(
      encode(profileX.url),
      'be53dcece25610c146b1617cf842593aa7ef134c6f771c2c145b9213deecf13a'
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
    [encode(followUrl)],
    'follows property should contain target profile url'
  )

  // unfollow versioned profile url which does not exists

  await p2p.unfollow(encode(profileX.url), followVersionedKey)

  const { rawJSON: profileXSame } = await p2p.get(profileX.url)
  t.equal(
    profileXSame.follows.length,
    1,
    'unfollow does nothing when profile does not match (versioned)'
  )

  // unfollow unversioned profile url
  await p2p.unfollow(encode(profileX.url), encode(followUrl))

  const { rawJSON: profileXFinal } = await p2p.get(profileX.url)
  t.equal(
    profileXFinal.follows.length,
    0,
    'unfollow removes the target profile'
  )

  // call follow (versioned)
  await p2p.follow(encode(profileX.url), followVersionedKey)

  const { rawJSON: profileXUpdated2 } = await p2p.get(profileX.url)
  t.equal(profileXUpdated2.follows.length, 1, 'following 1 new profile')
  t.same(
    profileXUpdated2.follows,
    [followVersionedKey],
    'follows property should contain target profile versioned url'
  )

  // unfollow unversioned profile but only versioned is being followed
  await p2p.unfollow(encode(profileX.url), encode(followUrl))

  const { rawJSON: profileXNoChange } = await p2p.get(profileX.url)
  t.equal(
    profileXNoChange.follows.length,
    1,
    'unfollow does nothing when the target profile does not match (unversioned)'
  )

  // unfollow versioned profile url
  await p2p.unfollow(encode(profileX.url), followVersionedKey)

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
    baseDir: dir,
    dht,
    bootstrap: dhtBootstrap
  })

  const p2p2 = new SDK({
    baseDir: dir2,
    dht,
    bootstrap: dhtBootstrap
  })

  await p2p2.ready()

  const content = {
    type: 'content',
    title: 'test'
  }

  const { rawJSON } = await p2p.init(content)
  const rawJSONpath = encode(rawJSON.url)

  // write main.txt
  await writeFile(join(dir, rawJSONpath, 'main.txt'), 'hello')

  const { rawJSON: module, dlHandle } = await p2p2.clone(rawJSON.url)

  t.same(module.title, content.title)

  await once(dlHandle, 'end')

  const clonedDir = await readdir(join(p2p2.baseDir, `${rawJSONpath}`))
  t.ok(clonedDir.includes('main.txt'), 'clone downloaded content successfully')

  await p2p.destroy()
  await p2p2.destroy()
  t.end()
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
    bootstrap: dhtBootstrap
  })

  const p2p2 = new SDK({
    disableSwarm: false,
    persist: true,
    baseDir: dir2,
    swarm: testSwarmCreator,
    dht,
    bootstrap: dhtBootstrap
  })

  const content = {
    type: 'content',
    title: 'test'
  }

  const { rawJSON } = await p2p.init(content)
  const rawJSONpath = rawJSON.url.replace('hyper://', '')

  // write main.txt
  await writeFile(join(dir, rawJSONpath, 'main.txt'), 'hello')

  // clone can be canceled
  const cloning = p2p2.clone(rawJSON.url)
  setImmediate(() => {
    cloning.cancel()
    t.ok(cloning.isCanceled, 'cloning promise is canceled')
  })
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

  const {
    rawJSON: content,
    metadata: cMetadataInitial,
    driveWatch
  } = await p2p.init(contentData)

  await p2p.init(profileData)

  const contentPath = encode(content.url)

  // write main.txt
  await writeFile(join(dir, contentPath, 'main.txt'), 'hello')
  once(driveWatch, 'put-end')

  await writeFile(join(dir, contentPath, 'main2.txt'), 'hello 2')
  await p2p.set({ url: content.url, main: 'main.txt' })
  const { rawJSON, metadata: cMetadataUpdate } = await p2p.get(content.url)

  t.ok(
    cMetadataInitial.lastModified.getTime() <
      cMetadataUpdate.lastModified.getTime(),
    'content metadata lastModified is updated'
  )
  driveWatch.destroy()
  await p2p.destroy()

  // update main.txt while sdk is off...
  await writeFile(join(dir, contentPath, 'main.txt'), 'hello world')
  rawJSON.description = 'what is this??'
  await writeFile(join(dir, contentPath, 'index.json'), JSON.stringify(rawJSON))

  await new Promise(resolve => {
    setTimeout(() => {
      return resolve()
    }, 200)
  })

  const p2p2 = new SDK({
    disableSwarm: true,
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

test('multiple sdks with child process', async t => {
  const dir = tempy.directory()
  const code = join(__dirname, 'childProcess2.js')

  await execa.node(code, [dir])
  await execa.node(code, [dir])

  t.pass('all good')
  t.end()
})

test.onFinish(async () => {
  if (dht) {
    await dht.destroy()
    dht = null
  }
})
