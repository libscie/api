const test = require('tape')
const tempy = require('tempy')
const SDK = require('../')

const createDb = () =>
  new SDK({
    disableSwarm: true,
    persist: false,
    baseDir: tempy.directory()
  })

test('ready', async t => {
  const p2p = createDb()
  t.doesNotThrow(async () => p2p.ready(), 'ready method should not throw')
  t.end()
})

test('init: create content module', async t => {
  const p2p = createDb()
  await p2p.ready()
  const metadata = {
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  }
  const output = await p2p.init(metadata)
  t.same(output.type, metadata.type)
  t.same(output.title, metadata.title)
  t.same(output.description, metadata.description)
  t.ok(Buffer.isBuffer(output.url))
  t.same(
    output.license,
    'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
  )
  t.same(output.authors, [])
  t.same(output.parents, [])
  t.end()
  await p2p.destroy()
})

test('init: creation should fail due to missing params', async t => {
  const p2p = createDb()
  await p2p.ready()
  const metadata = {
    type: 'content'
  }
  try {
    await p2p.init(metadata)
  } catch (err) {
    t.ok(err, 'An error should happen')
    t.strictEqual(err.message, 'title is required')
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
  const output = await p2p.init(metadata)
  t.same(output.type, metadata.type)
  t.same(output.title, metadata.title)
  t.same(output.description, metadata.description)
  t.ok(Buffer.isBuffer(output.url))
  t.same(
    output.license,
    'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
  )
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
  const metadata = await p2p.init(sampleData)
  const key = metadata.url.toString('hex')

  const result = await p2p.get(key)

  t.same(result, metadata)
  t.end()
  await p2p.destroy()
})

test('set: update a value', async t => {
  const p2p = createDb()
  await p2p.ready()
  const sampleData = {
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  }
  const metadata = await p2p.init(sampleData)
  const key = metadata.url.toString('hex')

  metadata.description = 'A more accurate description'
  await p2p.set(metadata)
  const result = await p2p.get(key)

  t.same(result.description, metadata.description)
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
