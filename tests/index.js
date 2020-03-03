const {
  existsSync,
  promises: { writeFile, readdir }
} = require('fs')
const { join } = require('path')
const execa = require('execa')
const once = require('events.once')
const test = require('tape-catch')
const tempy = require('tempy')
const SDK = require('../')
const testSwarm = require('./utils/swarm')

const testSwarmCreator = (store, opts) => testSwarm(store, opts)

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
    baseDir: tempy.directory()
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
    main: 'file.txt',
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
  t.same(output.main, init.main)
  t.same(output.authors, init.authors)
  t.same(output.parents, init.parents)
  t.same(typeof metadata, 'object')
  t.ok(metadata.version)
  t.ok(metadata.isWritable)
  t.ok(metadata.lastModified)
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
  await p2p.set({ url: profileKey, ...profileUpdate })
  const { rawJSON: contentUpdated } = await p2p.get(contentKey)
  const { rawJSON: profileUpdated } = await p2p.get(profileKey)
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
    t.same(err.expected, 'required-string')
    t.same(err.received, '')
    t.same(err.key, 'title')
    await p2p.destroy()
    t.end()
  }
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

test('publish - local contents', async t => {
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
  const { metadata } = await p2p.get(content1.url)
  const contentKeyVersion = `${content1.url}+${metadata.version}`
  await p2p.publish(contentKeyVersion, profile.url)
  const { rawJSON } = await p2p.get(profile.url)
  t.same(
    rawJSON.contents,
    [contentKeyVersion],
    'registration results in the addition of a dat key to the contents property of the target profile'
  )
  await p2p.destroy()
  t.end()
})

test('seed and publish', async t => {
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

  // call publish
  await p2p.publish(contentKeyVersion, profile.url)

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

  // call publish again
  await p2p.publish(contentKeyVersion, profile.url)
  const { rawJSON: rawJSON2 } = await p2p.get(profile.url)
  t.same(rawJSON.contents, rawJSON2.contents, 'publish is idempotent')

  const dirs2 = await readdir(p2p.baseDir)
  t.same(
    dirs,
    dirs2,
    'publish is idempotent (created directories remains the same)'
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

  await Promise.all([].concat(sampleData).map(d => p2p.init(d)))

  const profiles = await p2p.listProfiles()
  const contents = await p2p.listContent()

  const { rawJSON: profile } = profiles[0]
  const { rawJSON: content1, metadata } = contents[0]
  const { rawJSON: content2 } = contents[1]
  const authors = [profile.url]

  // ATOMIC OP?
  // update author on content module
  await p2p.set({ url: content1.url, authors })
  // update content in author profile
  await p2p.set({
    url: profile.url,
    contents: [`${content1.url}+${metadata.version}`]
  })
  // END ATOMIC OP

  const result = await p2p.verify(`${content1.url}+${metadata.version}`)

  t.ok(result, 'content1 meets the verification requirements')

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
    swarmFn: testSwarmCreator
  })
  const p2p2 = createDb({
    swarm: true,
    persist: false,
    swarmFn: testSwarmCreator
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
  const authors = [profile.url, profileY.url]
  // update authors on content module
  await p2p.set({ url: content1.url, authors })
  const { rawJSON, metadata } = await p2p.get(content1.url)
  t.same(rawJSON.authors, authors, 'content authors contains two profiles')
  const versioned = `${content1.url}+${metadata.version}`
  // update content in authors profiles
  await p2p.publish(versioned, profile.url)
  await p2p2.publish(versioned, profileY.url)

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
  await execa(code, [contentDat.url, dir])

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

  const modules2 = await p2p.list()
  t.equal(modules2.length, 1, 'Modules list contains 1 element')
  // delete content
  await p2p.delete(content.url)
  const modules3 = await p2p.list()
  t.equal(modules3.length, 0, 'Modules list is empty again')
  await p2p.destroy()
  t.end()
})

test('unpublish content module from profile', async t => {
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
  await p2p.set({ url: content.url, authors: [profile.url] })
  const { metadata: contentMeta } = await p2p.get(content.url)

  t.equal(profile.contents.length, 0, 'profile.contents is empty')

  const versioned = `${content.url}+${contentMeta.version}`
  await p2p.publish(versioned, profile.url)

  const { rawJSON: updatedProfile } = await p2p.get(profile.url)

  t.equal(updatedProfile.contents.length, 1)

  await p2p.unpublish(versioned, profile.url)

  const { rawJSON: deletedContent } = await p2p.get(profile.url)

  t.equal(deletedContent.contents.length, 0, 'content unpublished successfully')

  await p2p.destroy()
  t.end()
})

test('follow and unfollow a profile', async t => {
  const p2p = createDb({
    swarm: true,
    persist: false,
    swarmFn: testSwarmCreator
  })
  const p2p2 = createDb({
    swarm: true,
    persist: false,
    swarmFn: testSwarmCreator
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
  const { rawJSON: profileY } = await p2p2.init(professorY)

  const followUrl = profileY.url
  t.equal(profileX.follows.length, 0, 'Initially follows should be empty')
  // call follow
  await p2p.follow(profileX.url, followUrl)

  const { rawJSON: profileXUpdated } = await p2p.get(profileX.url)
  t.equal(profileXUpdated.follows.length, 1)
  t.same(
    profileXUpdated.follows,
    [followUrl],
    'follows property should contain target profile url'
  )

  await p2p.unfollow(profileX.url, followUrl)

  const { rawJSON: profileXFinal } = await p2p.get(profileX.url)
  t.equal(
    profileXFinal.follows.length,
    0,
    'unfollow removes the target profile'
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
    swarm: testSwarmCreator
  })

  const p2p2 = new SDK({
    disableSwarm: false,
    persist: true,
    baseDir: dir2,
    swarm: testSwarmCreator
  })

  await p2p2.ready()

  const content = {
    type: 'content',
    title: 'test',
    main: 'main.txt'
  }

  const { rawJSON, driveWatch } = await p2p.init(content)
  const rawJSONpath = rawJSON.url.replace('dat://', '')

  // write main.txt
  await writeFile(join(dir, rawJSONpath, 'main.txt'), 'hello')

  driveWatch.on('put-end', async file => {
    if (!file.name.endsWith('main.txt')) return

    const { module, dwldHandle } = await p2p2.clone(rawJSON.url)

    t.same(module.title, content.title)

    await once(dwldHandle, 'end')

    const clonedDir = await readdir(join(p2p2.baseDir, rawJSONpath))
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
    swarm: testSwarmCreator
  })

  const p2p2 = new SDK({
    disableSwarm: false,
    persist: true,
    baseDir: dir2,
    swarm: testSwarmCreator
  })

  const content = {
    type: 'content',
    title: 'test',
    main: 'main.txt'
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
