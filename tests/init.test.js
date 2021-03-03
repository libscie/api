const test = require('tape')
const { encode } = require('dat-encoding')
const { writeFile } = require('fs').promises
const { join } = require('path')
const createSdk = require('./utils/create-sdk')
const spec = require('../lib/spec')
const SDK = require('./..')

test('init: create content module', async t => {
  const p2p = createSdk()
  const init = {
    type: 'content',
    subtype: 'Theory',
    title: 'demo',
    description: 'lorem ipsum',
    authors: [
      '3f70fe6b663b960a43a2c6c5a254c432196e2efa695e4b4e39779ae22e860e9d'
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
    `https://p2pcommons.com/specs/module/${spec.module}`
  )
  t.same(
    output.main,
    '',
    'main property can not be set on init (default: empty)'
  )
  t.same(output.authors, init.authors)
  t.same(typeof metadata, 'object')
  t.ok(metadata.version)
  t.ok(metadata.isWritable)
  t.ok(metadata.lastModified)
  await p2p.destroy()
  t.end()
})

test('init: title longer than 300 char should throw a ValidationError', async t => {
  const p2p = createSdk()
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
  const p2p = createSdk()
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
  const p2p = createSdk()
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
    `https://p2pcommons.com/specs/module/${spec.module}`
  )
  t.same(output.follows, [])
  t.same(output.contents, [])
  await p2p.destroy()
  t.end()
})

test('init + set: versioned parent for unversioned registration', async t => {
  const p2p = createSdk()

  const {
    rawJSON: { url: profileUrl }
  } = await p2p.init({
    type: 'profile',
    title: 'author'
  })

  const {
    rawJSON: { url: parent1Url }
  } = await p2p.init({
    type: 'content',
    title: 'parent',
    authors: [encode(profileUrl)]
  })
  await writeFile(
    join(p2p.baseDir, encode(parent1Url), 'file.txt'),
    'hola mundo'
  )
  const {
    metadata: { version: parent1Version }
  } = await p2p.set({
    url: parent1Url,
    main: 'file.txt'
  })
  await p2p.register(`${parent1Url}+${parent1Version}`, profileUrl)

  const {
    rawJSON: { url: parent2Url }
  } = await p2p.init({
    type: 'content',
    title: 'parent',
    authors: [encode(profileUrl)]
  })
  await writeFile(
    join(p2p.baseDir, encode(parent2Url), 'file.txt'),
    'hola mundo'
  )
  const {
    metadata: { version: parent2Version }
  } = await p2p.set({
    url: parent2Url,
    main: 'file.txt'
  })
  await p2p.register(parent2Url, profileUrl)

  try {
    await p2p.init({
      type: 'content',
      title: 'child',
      parents: [`${encode(parent2Url)}+${parent2Version}`]
    })
    t.fail(
      'Init versioned parent with unversioned registration should not succeed'
    )
  } catch (err) {
    t.pass('Init versioned parent with unversioned registration fails')
  }

  try {
    const {
      rawJSON: { url: childUrl }
    } = await p2p.init({
      type: 'content',
      title: 'child',
      parents: [`${encode(parent1Url)}+${parent1Version}`]
    })

    try {
      await p2p.set({
        url: childUrl,
        parents: [`${encode(parent2Url)}+${parent2Version}`]
      })
      t.fail(
        'Set versioned parent with unversioned registration should not succeed'
      )
    } catch (err) {
      t.pass('Set versioned parent with unversioned registration fails')
    }
  } catch (err) {
    t.fail('Could not set versioned registered parent')
  }

  await p2p.destroy()
  t.end()
})
