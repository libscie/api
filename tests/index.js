const {
  promises: { readdir }
} = require('fs')
const { join } = require('path')
const { promisify } = require('util')
const exec = promisify(require('child_process').exec)
const test = require('tape')
const tempy = require('tempy')
const SDK = require('../')
const testSwarm = require('./utils/swarm')

const testSwarmCreator = (store, opts) => testSwarm(store, opts)

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
    baseDir: tempy.directory()
  })
}
test('ready', async t => {
  const p2p = createDb()
  t.doesNotThrow(async () => p2p.ready(), 'ready method should not throw')
  t.end()
})

test('init: create content module', async t => {
  const p2p = createDb()
  await p2p.ready()
  const init = {
    type: 'content',
    subtype: 'Theory',
    title: 'demo',
    description: 'lorem ipsum',
    main: 'file.txt',
    authors: [
      'dat://3f70fe6b663b960a43a2c6c5a254c432196e2efa695e4b4e39779ae22e860e9d'
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
  t.same(output.main, init.main)
  t.same(output.authors, init.authors)
  t.same(output.parents, [])
  t.same(typeof metadata, 'object')
  t.ok(metadata.version)
  t.ok(metadata.isWritable)
  t.ok(metadata.lastModified)
  t.end()
  await p2p.destroy()
})

test('init: creation should throw a ValidationError', async t => {
  const p2p = createDb()
  await p2p.ready()
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
    t.end()
    await p2p.destroy()
  }
})

test('init: create profile module', async t => {
  const p2p = createDb()
  await p2p.ready()
  const metadata = {
    type: 'profile',
    title: 'demo',
    description: 'lorem ipsum'
  }
  const { rawJSON: output } = await p2p.init(metadata)
  t.same(output.type, metadata.type)
  t.same(output.title, metadata.title)
  t.same(output.description, metadata.description)
  t.same(typeof output.url, 'string', 'url is a string')
  t.same(
    output.links.license[0].href,
    'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
  )
  t.same(output.links.spec[0].href, 'https://p2pcommons.com/specs/module/0.2.0')
  t.same(output.follows, [])
  t.same(output.contents, [])
  t.end()
  await p2p.destroy()
})

test('get: retrieve a value from the sdk', async t => {
  const p2p = createDb()
  await p2p.ready()
  const sampleData = {
    type: 'profile',
    title: 'demo',
    description: 'lorem ipsum'
  }
  const { rawJSON: metadata } = await p2p.init(sampleData)
  const key = metadata.url

  const { rawJSON } = await p2p.get(key)

  t.same(rawJSON, metadata)
  t.end()
  await p2p.destroy()
})

test('set: update modules', async t => {
  const p2p = createDb()
  await p2p.ready()
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
  await p2p.set({ url: profileKey, ...profileUpdate })
  const { rawJSON: contentUpdated } = await p2p.get(contentKey)
  const { rawJSON: profileUpdated } = await p2p.get(profileKey)
  t.same(contentUpdated.description, contentUpdate.description)
  t.same(profileUpdated.title, profileUpdate.title)
  t.same(profileUpdated.description, profileUpdate.description)
  t.end()
  await p2p.destroy()
})

test('set: should throw InvalidKeyError with invalid update', async t => {
  const p2p = createDb()
  await p2p.ready()
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
    t.end()
  })
})

test('set: update should fail with bad data', async t => {
  const p2p = createDb()
  await p2p.ready()
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
    t.same(err.expected, 'required-string')
    t.same(err.received, '')
    t.same(err.key, 'title')
    t.end()
  }
})

test('update: check version change', async t => {
  const p2p = createDb()
  await p2p.ready()
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
  t.end()
  await p2p.destroy()
})

test('list content', async t => {
  const p2p = createDb()
  await p2p.ready()
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
  const result = await p2p.listContent()
  t.same(result.length, sampleDataContent.length)
  t.end()
  await p2p.destroy()
})

test('list profiles', async t => {
  const p2p = createDb()
  await p2p.ready()
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
  t.end()
  await p2p.destroy()
})

test('list modules', async t => {
  const p2p = createDb()
  await p2p.ready()
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
  t.end()
  await p2p.destroy()
})

test('multiple writes with persistance', async t => {
  try {
    const dir = tempy.directory()
    const p2p1 = new SDK({
      baseDir: dir
    })

    await p2p1.ready()
    const { rawJSON } = await p2p1.init({ type: 'content', title: 'title' })
    t.same(typeof rawJSON.url, 'string')
    await p2p1.destroy()

    // create a new instance with same basedir
    const p2p2 = new SDK({
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
  await p2p.ready()
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
  const { rawJSON: content1, metadata: metadata1 } = contents[0]
  const authors = [profile.url]

  // update author on content module
  await p2p.set({ url: content1.url, authors })
  const contentKeyVersion = `${content1.url}+${metadata1.version + 1}`
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
  const p2p = createDb({
    swarm: true,
    verbose: true,
    persist: false,
    swarmFn: testSwarmCreator
  })
  const p2p2 = createDb({
    swarm: true,
    verbose: true,
    persist: false,
    swarmFn: testSwarmCreator
  })

  await p2p.ready()
  await p2p2.ready()

  const sampleData = {
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  }

  const sampleProfile = { type: 'profile', title: 'Professor X' }
  await p2p2.init(sampleData)
  await p2p.init(sampleProfile)

  const profiles = await p2p.listProfiles()
  const contents = await p2p2.listContent()

  const { rawJSON: profile } = profiles[0]
  const { rawJSON: content1 } = contents[0]
  const authors = [profile.url]

  // update author on content module
  await p2p2.set({ url: content1.url, authors })
  const { metadata: contentMetadata } = await p2p2.get(content1.url)
  const contentKeyVersion = `${content1.url.replace(/dat:\/\//, '')}+${
    contentMetadata.version
  }`
  const contentKeyVersionPrefix = `dat://${contentKeyVersion}`

  await p2p2.destroy(true, false)

  // call register
  await p2p.register(contentKeyVersion, profile.url)

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
  await p2p.register(contentKeyVersion, profile.url)
  const { rawJSON: rawJSON2 } = await p2p.get(profile.url)
  t.same(rawJSON.contents, rawJSON2.contents, 'register is idempotent')

  const dirs2 = await readdir(p2p.baseDir)
  t.same(
    dirs,
    dirs2,
    'register is idempotent (created directories remains the same)'
  )
  await p2p2.destroy(false, true)
  await p2p.destroy()
  t.end()
})

test('verify', async t => {
  const p2p = createDb()
  await p2p.ready()
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

  await Promise.all([].concat(sampleData).map(d => p2p.init(d)))

  const profiles = await p2p.listProfiles()
  const contents = await p2p.listContent()

  const { rawJSON: profile } = profiles[0]
  const { rawJSON: content1 } = contents[0]
  const { rawJSON: content2 } = contents[1]
  const authors = [profile.url]

  // ATOMIC OP?
  // update author on content module
  await p2p.set({ url: content1.url, authors })
  // update content in author profile
  await p2p.set({ url: profile.url, contents: [content1.url] })
  // END ATOMIC OP

  const { rawJSON: content1Updated } = await p2p.get(content1.url)

  const result = await p2p.verify(content1Updated)

  t.ok(result, 'content1 meets the verification requirements')

  const result2 = await p2p.verify(content2)
  t.notOk(result2, 'content2 does not has authors registered')

  await p2p.destroy()
  t.end()
})

test('re-open SDK (child process)', async t => {
  const dir = tempy.directory()

  const commons = new SDK({
    disableSwarm: true,
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

  console.log('Starting child process...')
  // another sdk instance will update the content
  const code = join(__dirname, 'childProcess.js')
  const { stdout, stderr } = await exec(`${code} ${contentDat.url} "${dir}"`)

  console.log('Finishing child process')
  console.log({ stdout })

  console.log({ stderr })

  const commons2 = new SDK({
    disableSwarm: true,
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
