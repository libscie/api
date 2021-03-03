const test = require('tape')
const { join } = require('path')
const { encode } = require('dat-encoding')
const { writeFile } = require('fs').promises
const createSdk = require('./utils/create-sdk')
const SDK = require('./..')

test('set: update modules', async t => {
  const p2p = createSdk()
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

  t.deepLooseEqual(getOnSet, profileUpdated, 'get on set')
  t.same(contentUpdated.description, contentUpdate.description)
  t.same(profileUpdated.title, profileUpdate.title)
  t.same(profileUpdated.description, profileUpdate.description)
  await p2p.destroy()
  t.end()
})

test('set: should throw InvalidKeyError with invalid update', async t => {
  const p2p = createSdk()
  const sampleData = {
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  }
  const { rawJSON: metadata } = await p2p.init(sampleData)
  const key = metadata.url

  const license = 'anewkey123456'

  try {
    await p2p.set({ url: key, license })
    t.fail('should throw InvalidKeyError')
  } catch (err) {
    t.ok(
      err instanceof SDK.errors.InvalidKeyError,
      'error should be instance of InvalidKeyError'
    )
    t.ok(Object.prototype.hasOwnProperty.call(err, 'invalid'))
    t.same(err.invalid, 'license')
  } finally {
    await p2p.destroy()
    t.end()
  }
})

test('set: should throw validation error with extra params', async t => {
  const p2p = createSdk()
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
    t.fail('should throw ValidationError')
  } catch (err) {
    t.ok(
      err instanceof SDK.errors.ValidationError,
      'extra params should throw ValidationError'
    )
  } finally {
    await p2p.destroy()
    t.end()
  }
})

test('set: should throw validation error with invalid main', async t => {
  const p2p = createSdk()
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

test('set: should throw validation error with invalid main (not text)', async t => {
  const p2p = createSdk()

  const sampleContent = {
    type: 'content',
    title: 'intro to magic',
    description: 'd'
  }

  const { rawJSON: content } = await p2p.init(sampleContent)

  // manually writing a dummy binary file
  const buffer = Buffer.alloc(8)
  await writeFile(
    join(p2p.baseDir, encode(content.url), 'file.txt333'),
    buffer,
    'binary'
  )

  try {
    await p2p.set({
      url: content.url,
      main: 'file.txt333'
    })
    t.fail('should throw validation error')
  } catch (err) {
    t.ok(
      err instanceof SDK.errors.ValidationError,
      'invalid extension should throw ValidationError'
    )
    t.ok(err.code === 'main_extension', 'err.code should be main_extension')
  }

  await p2p.destroy()
  t.end()
})

test('set: main extension is case insensitive', async t => {
  const p2p = createSdk()

  const sampleContent = {
    type: 'content',
    title: 'intro to magic',
    description: 'd'
  }

  const { rawJSON: content } = await p2p.init(sampleContent)

  // manually writing a dummy file
  await writeFile(
    join(p2p.baseDir, encode(content.url), 'file.TXT'),
    'hola mundo'
  )

  try {
    await p2p.set({
      url: content.url,
      main: 'file.TXT'
    })
    t.pass('main extension check is case insensitive')
  } catch (err) {
    t.fail(err.message)
  }

  await p2p.destroy()
  t.end()
})

test('set: can update main', async t => {
  const p2p = createSdk()
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
  const p2p = createSdk()
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
  const p2p = createSdk()

  const followedProfile1 = {
    type: 'profile',
    title: 'followed1'
  }

  const followedProfile2 = {
    type: 'profile',
    title: 'followed2'
  }

  const {
    rawJSON: { url: followedProfile1Url }
  } = await p2p.init(followedProfile1)
  const {
    rawJSON: { url: followedProfile2Url }
  } = await p2p.init(followedProfile2)

  const sampleProfile = {
    type: 'profile',
    title: 'professorX',
    subtype: '',
    avatar: './test.png',
    follows: [encode(followedProfile1Url), encode(followedProfile2Url)]
  }

  const { rawJSON: profile } = await p2p.init(sampleProfile)
  const profileKey = encode(profile.url)

  const parentContent1 = {
    type: 'content',
    title: 'parent1',
    authors: [profileKey]
  }

  const parentContent2 = {
    type: 'content',
    title: 'parent2',
    authors: [profileKey]
  }

  const {
    rawJSON: { url: parentContent1Url }
  } = await p2p.init(parentContent1)
  const {
    rawJSON: { url: parentContent2Url }
  } = await p2p.init(parentContent2)

  await writeFile(
    join(p2p.baseDir, encode(parentContent1Url), 'file.txt'),
    'hola mundo'
  )
  const {
    metadata: { version: parentContent1Version }
  } = await p2p.set({
    url: parentContent1Url,
    main: 'file.txt'
  })
  await writeFile(
    join(p2p.baseDir, encode(parentContent2Url), 'file.txt'),
    'hola mundo'
  )
  const {
    metadata: { version: parentContent2Version }
  } = await p2p.set({
    url: parentContent2Url,
    main: 'file.txt'
  })

  await p2p.register(
    `${encode(parentContent1Url)}+${parentContent1Version}`,
    profileKey
  )
  await p2p.register(
    `${encode(parentContent2Url)}+${parentContent2Version}`,
    profileKey
  )

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

test('set: dont allow future parents versions nor self-reference', async t => {
  const p2p = createSdk()
  const {
    rawJSON: { url: profileUrl }
  } = await p2p.init({
    type: 'profile',
    title: 'Profile'
  })
  const sampleData = {
    type: 'content',
    title: 'sample content',
    description: 'lorem ipsum',
    authors: [encode(profileUrl)]
  }
  const {
    rawJSON: { url }
  } = await p2p.init(sampleData)

  await writeFile(join(p2p.baseDir, encode(url), 'file.txt'), 'hola mundo')
  const {
    metadata: { version }
  } = await p2p.set({
    url,
    main: 'file.txt'
  })

  await p2p.register(`${encode(url)}+${version}`, profileUrl)

  try {
    await p2p.set({
      url,
      parents: [`${encode(url)}+${version + 2}`]
    })
    t.fail('invalid parents should throw ValidationError')
  } catch (err) {
    t.ok(
      err instanceof SDK.errors.ValidationError,
      'invalid parents should throw ValidationError'
    )
  }
  try {
    await p2p.set({
      url,
      parents: [`${encode(url)}+${version + 1}`]
    })
    t.fail('invalid parents should throw ValidationError')
  } catch (err) {
    t.ok(
      err instanceof SDK.errors.ValidationError,
      'invalid parents should throw ValidationError'
    )
  }
  await p2p.destroy()
  t.end()
})
