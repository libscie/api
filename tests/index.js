const test = require('tape')
const tempy = require('tempy')
const SDK = require('../')

test('ready', async t => {
  const p2p = new SDK({ disableSwarm: true, persist: false })
  t.doesNotThrow(async () => p2p.ready(), 'ready method should not throw')
  t.end()
})

test('init: create content module', async t => {
  const p2p = new SDK({
    disableSwarm: true,
    persist: false,
    dbPath: tempy.directory()
  })
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
  t.same(output.license, '')
  t.same(output.authors, [])
  t.same(output.parents, [])
  t.end()
})

test('init: create profile module', async t => {
  const p2p = new SDK({
    disableSwarm: true,
    persist: false,
    dbPath: tempy.directory()
  })
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
  t.same(output.license, '')
  t.same(output.follows, [])
  t.same(output.contents, [])
  t.end()
})
