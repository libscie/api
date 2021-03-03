const createSdk = require('./utils/create-sdk')
const testList = require('./test-list')
const testGetMethod = require('./test-get-method')
const testFollowMethod = require('./test-follow-method')
const testDeregisterMethod = require('./test-deregister-method')

const {
  existsSync,
  promises: { writeFile, readdir, stat, copyFile }
} = require('fs')
const { join } = require('path')
const execa = require('execa')
const once = require('events.once')
const test = require('tape')
const tempy = require('tempy')
const { encode } = require('dat-encoding')
const SDK = require('../')
const createDHT = require('./utils/dht')
const testSdk = require('./test-sdk')

let dht, dhtBootstrap

const localDHT = async () => {
  const { url, node } = await createDHT()
  dht = node
  dhtBootstrap = url
}

testSdk()
testList()
testGetMethod()
testFollowMethod()
testDeregisterMethod()

test('sdk re-start', async t => {
  await localDHT()
  // issue arise when we have external content in our db, lets fix that

  const p2p = createSdk({ swarm: true, persist: true, dhtBootstrap })

  const p2p2 = createSdk({ swarm: true, persist: true, dhtBootstrap })

  const p2p3 = createSdk({ swarm: true, persist: true, dhtBootstrap })

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
  const { rawJSON: remoteJSON } = await p2p2.clone(rawJSON.url, remoteVersion)

  t.same(remoteJSON, rawJSON, 'cloned module')
  // some other peer clone the content module too
  await p2p3.clone(rawJSON.url, remoteVersion)

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
  await new Promise(resolve => {
    setTimeout(resolve, 200)
  })
  await otherPeer.ready()

  // now instantiate back p2p2 sdk (same storage, same db)
  const p2p4 = new SDK({
    bootstrap: dhtBootstrap,
    baseDir: p2p2.baseDir
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

test('saveItem: should throw ValidationError with invalid metadata', async t => {
  const dir = tempy.directory()

  const p2p = new SDK({
    baseDir: dir,
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

test.skip('register - local contents', async t => {
  const p2p = createSdk()

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
  /*
  await writeFile(
    join(p2p.baseDir, encode(content1.url), 'file.txt'),
    'hola mundo'
  )
  */
  const { metadata: m1 } = await p2p.get(content1.url)

  await p2p.addFiles(content1.url, './tests/testfile.bin')

  await p2p.set({
    url: content1.url,
    main: 'testfile.bin'
  })

  const { metadata } = await p2p.get(content1.url)
  console.log({ m1version: m1.version })
  console.log({ m2version: metadata.version })
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

test('register - list versions', async t => {
  const p2p = createSdk({ persist: true })

  const { rawJSON: profile } = await p2p.init({
    type: 'profile',
    title: 'Professor X'
  })
  const { rawJSON: content1 } = await p2p.init({
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  })

  const versionsInitial = await p2p.getAllVersions(content1.url)
  t.same(versionsInitial.length, 0, 'No versions created yet')

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

  const versionsFinal = await p2p.getAllVersions(content1.url)
  t.same(versionsFinal.length, 1, '1 version created')

  await p2p.destroy()
  t.end()
})

test('register, restart and list contents', async t => {
  const dir = tempy.directory()
  const p2p = new SDK({
    baseDir: dir,
    disableSwarm: true
  })
  // create profile
  const { rawJSON: profile } = await p2p.init({
    type: 'profile',
    title: 'Professor X'
  })
  // create content
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
    // do the register
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

  const code = join(__dirname, 'childProcessListContent.js')
  const { stdout, stderr, message, exitCode } = await execa.node(code, [dir])

  if (exitCode !== 0) {
    console.log(message)
    t.fail(stderr)
  }
  t.same(Number(stdout), 1, 'Expect only one content module')

  t.end()
})

test('seed and register', async t => {
  const p2p = createSdk({
    swarm: true,
    persist: true,
    dhtBootstrap
  })
  const p2p2 = createSdk({
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
  const p2p = createSdk()
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
  const p2p = createSdk({
    swarm: true,
    persist: false,
    dhtBootstrap
  })
  const p2p2 = createSdk({
    swarm: true,
    persist: false,
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

test('delete registered module with multiple authors', async t => {
  const dir = tempy.directory()
  const p2p = new SDK({
    baseDir: dir,
    bootstrap: dhtBootstrap
  })

  const p2p2 = new SDK({
    baseDir: tempy.directory(),
    bootstrap: dhtBootstrap
  })

  const modules = await p2p.list()
  t.equal(modules.length, 0, 'Modules list is empty')

  // create content
  const { rawJSON: content } = await p2p.init({
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  })

  // create profile
  const { rawJSON: profile } = await p2p.init({
    type: 'profile',
    title: 'professor X',
    description: 'd'
  })

  // create external profile
  const { rawJSON: externalProfile } = await p2p2.init({
    type: 'profile',
    title: 'mystique',
    description: 'm'
  })

  const contentModules = await p2p.listContent()
  t.equal(contentModules.length, 1, '1 content module exists')
  // follow remote profile
  await p2p.follow(encode(profile.url), encode(externalProfile.url))

  // register with multiple authors
  const authors = [encode(profile.url), encode(externalProfile.url)]
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
  await p2p2.destroy()
  t.end()
})

test('delete registered module', async t => {
  const dir = tempy.directory()
  const p2p = new SDK({
    baseDir: dir,
    bootstrap: dhtBootstrap
  })

  const p2p2 = new SDK({
    baseDir: tempy.directory(),
    bootstrap: dhtBootstrap
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

  // create remote profile
  const { rawJSON: remoteProfile } = await p2p2.init({
    type: 'profile',
    title: 'mystique',
    description: 'm'
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

  await p2p.follow(encode(profile.url), encode(remoteProfile.url))

  const profiles = await p2p.listProfiles()
  t.equal(profiles.length, 2, '2 profiles in localdb, (local and remote)')

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
  await p2p2.destroy()
  t.end()
})

test('delete versioned module', async t => {
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

  const { metadata } = await p2p.set({
    url: content.url,
    authors,
    main: 'file.txt'
  })

  const moduleVersioned = `${encode(content.url)}+${metadata.version}`
  try {
    await p2p.register(moduleVersioned, encode(profile.url))
  } catch (err) {
    t.fail(err.message)
  }
  const { rawJSON: updatedProfile } = await p2p.get(profile.url)
  t.same(updatedProfile.contents.length, 1, 'content registered')

  // hard delete
  try {
    await p2p.delete(moduleVersioned, true)
    t.fail('versioned keys should throw')
  } catch (err) {
    t.ok(
      err.code === 'only_unversioned',
      'only unversioned keys can be deleted'
    )
  }

  const baseDir = await readdir(join(p2p.baseDir))

  const contentModulesFinal = await p2p.listContent()
  t.equal(contentModulesFinal.length, 1, 'content list remains the same')

  t.ok(
    baseDir.includes(moduleVersioned),
    'Module folder has not been removed (deleteFiles)'
  )

  await p2p.destroy()
  t.end()
})

test('follow and unfollow a profile', async t => {
  const p2p = createSdk({
    swarm: true,
    persist: false,
    dhtBootstrap
  })
  const p2p2 = createSdk({
    swarm: true,
    persist: false,
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

test('clone a module (auto download main file)', async t => {
  const dir = tempy.directory()
  const dir2 = tempy.directory()

  const p2p = new SDK({
    baseDir: dir,
    bootstrap: dhtBootstrap
  })

  const p2p2 = new SDK({
    baseDir: dir2,
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
  const fileStat = await stat(join(dir, `${rawJSONpath}`, 'main.txt'))
  await p2p.set({
    url: rawJSON.url,
    main: 'main.txt'
  })

  const { rawJSON: module } = await p2p2.clone(rawJSON.url)

  t.same(module.title, content.title)

  const clonedFileStat = await stat(
    join(p2p2.baseDir, `${rawJSONpath}`, 'main.txt')
  )
  t.same(clonedFileStat.size, fileStat.size, 'size should be equal')
  const clonedDir = await readdir(join(p2p2.baseDir, `${rawJSONpath}`))
  t.ok(clonedDir.includes('main.txt'), 'clone downloaded content successfully')

  await p2p.destroy()
  await p2p2.destroy()
  t.end()
})

test.skip('clone a module (using download handle to wait for download complete of module content, not main)', async t => {
  const dir = tempy.directory()
  const dir2 = tempy.directory()

  await localDHT()
  const p2p = new SDK({
    baseDir: dir,
    bootstrap: dhtBootstrap
  })

  const p2p2 = new SDK({
    baseDir: dir2,
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
  const filePath = join(dir, rawJSONpath, 'main.txt')
  await writeFile(filePath, 'hello')

  const { rawJSON: module, dlHandle } = await p2p2.clone(rawJSON.url)

  t.same(module.title, content.title)

  let target
  while (([target] = await once(dlHandle, 'put-end'))) {
    if (target && target.name && target.name.includes('main.txt')) {
      break
    }
  }

  const clonedDir = await readdir(join(p2p2.baseDir, `${rawJSONpath}`))
  t.ok(clonedDir.includes('main.txt'), 'clone downloaded content successfully')

  await p2p.destroy()
  await p2p2.destroy()
  t.end()
})

// NOTE(deka): revisit this one
test.skip('resume download clone', async t => {
  const dir = tempy.directory()
  const dir2 = tempy.directory()

  const p2p = new SDK({
    baseDir: dir,
    bootstrap: dhtBootstrap
  })

  const p2p2 = new SDK({
    baseDir: dir2,
    bootstrap: dhtBootstrap
  })

  await p2p2.ready()

  const content = {
    type: 'content',
    title: 'test'
  }

  const { rawJSON } = await p2p.init(content)
  const keyString = encode(rawJSON.url)

  const fileStat = await stat('./tests/testfile.bin')
  const fileSize = fileStat.size

  // write some file into the module folder
  await copyFile('./tests/testfile.bin', join(dir, keyString, 'testfile.bin'))

  await once(p2p, 'drive-updated')
  // await p2p.addFiles(keyString, './tests/testfile.bin')

  await p2p2.clone(rawJSON.url)

  await p2p2.destroy()

  await new Promise(resolve => setTimeout(resolve, 10))

  // re-start p2p2
  const p2p3 = new SDK({
    baseDir: dir2,
    bootstrap: dhtBootstrap
  })

  // Note(deka): check that download-resume is emitted for key === keyString
  await p2p3.ready()

  // await once(p2p3, 'download-drive-completed')

  const { rawJSON: module } = await p2p3.get(rawJSON.url)

  t.same(module.title, content.title)

  await once(p2p3, 'download-resume-completed')

  // validate file size on disk
  const clonedFileSize = await stat(join(dir2, keyString, 'testfile.bin'))

  t.ok(clonedFileSize.size >= fileSize, 'cloned file size is OK')

  const clonedDir = await readdir(join(p2p3.baseDir, `${keyString}`))

  t.ok(
    clonedDir.includes('testfile.bin'),
    'clone downloaded content successfully'
  )

  await p2p.destroy()
  await p2p3.destroy()
  t.end()
})

test('clone a module (multiple calls)', async t => {
  const dir = tempy.directory()
  const dir2 = tempy.directory()

  const p2p = new SDK({
    baseDir: dir,
    bootstrap: dhtBootstrap
  })

  const p2p2 = new SDK({
    baseDir: dir2,
    bootstrap: dhtBootstrap
  })

  await p2p2.ready()

  const content = {
    type: 'content',
    title: 'test'
  }

  const { rawJSON } = await p2p.init(content)
  const rawJSONpath = encode(rawJSON.url)

  // write some files
  const filePath = join(dir, rawJSONpath, 'main.txt')
  await writeFile(filePath, 'hello')

  await p2p.addFiles(rawJSON.url, [filePath, './tests/testfile.bin'])

  const { rawJSON: module, dlInfo } = await p2p2.clone(rawJSON.url)

  if (!dlInfo.complete) {
    dlInfo.resume()
    await once(p2p2, 'download-drive-completed')
  }
  t.same(module.title, content.title)

  const clonedDir = await readdir(join(p2p2.baseDir, rawJSONpath))
  t.ok(clonedDir.includes('main.txt'), 'clone downloaded content successfully')
  t.ok(
    clonedDir.includes('testfile.bin'),
    'clone downloaded content successfully'
  )

  // multiple clone calls
  const { rawJSON: module2 } = await p2p2.clone(rawJSON.url)

  t.ok(
    JSON.stringify(module2) === JSON.stringify(module),
    'clone should return the same value'
  )

  const { rawJSON: module3 } = await p2p2.clone(rawJSON.url)
  t.ok(
    JSON.stringify(module3) === JSON.stringify(module),
    'clone should return the same value'
  )

  await p2p.destroy()
  await p2p2.destroy()
  t.end()
})

test.skip('cloned versioned module directory is readonly', async t => {
  const dir = tempy.directory()
  const dir2 = tempy.directory()

  const p2p = new SDK({
    baseDir: dir,
    bootstrap: dhtBootstrap
  })

  const p2p2 = new SDK({
    baseDir: dir2,
    bootstrap: dhtBootstrap
  })

  await p2p2.ready()

  const content = {
    type: 'content',
    title: 'test'
  }

  const { rawJSON } = await p2p.init(content)
  const rawJSONKey = encode(rawJSON.url)

  // write main.txt
  await writeFile(join(dir, rawJSONKey, 'main.txt'), 'hello')

  await p2p.set({
    url: rawJSON.url,
    main: 'main.txt'
  })

  const {
    metadata: { version }
  } = await p2p.get(rawJSON.url)

  const { rawJSON: module } = await p2p2.clone(rawJSONKey, version)

  t.same(module.title, content.title)
  const externalContentPath = join(p2p2.baseDir, `${rawJSONKey}+${version}`)

  await once(p2p2, 'module-readonly')

  const st = await stat(externalContentPath)
  const permString = st.mode & 0o777

  // NOTE(dk): here we are comparing against 0555 (read and exec) and 0444 (pure read only)
  // because on windows exec permissions bits are sometimes lost.
  // See more here: https://github.com/nodejs/node/issues/9380
  if (permString === 0o555 || permString === 0o444) {
    t.pass('cloned module is not writable')
  } else {
    t.fail('cloned module is writable')
  }

  const clonedDir = await readdir(externalContentPath)
  t.ok(clonedDir.includes('main.txt'), 'clone downloaded content successfully')

  await p2p.destroy()
  await p2p2.destroy()
  t.end()
})

test.skip('cancel clone', async t => {
  const dir = tempy.directory()
  const dir2 = tempy.directory()

  const p2p = new SDK({
    disableSwarm: false,
    persist: true,
    baseDir: dir,
    bootstrap: dhtBootstrap
  })

  const p2p2 = new SDK({
    disableSwarm: false,
    persist: true,
    baseDir: dir2,
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

test('clone updates localdb', async t => {
  const dir = tempy.directory()
  const dir2 = tempy.directory()

  const p2p = new SDK({
    baseDir: dir,
    dhtBootstrap
  })

  const p2p2 = new SDK({
    baseDir: dir2,
    dhtBootstrap
  })

  const profile = {
    type: 'profile',
    title: 'professor'
  }

  const { rawJSON } = await p2p.init(profile)

  // clone
  const { rawJSON: module1 } = await p2p2.clone(rawJSON.url)

  t.same(module1.title, profile.title, '1 st clone works OK (title)')
  t.same(module1.description, '', '1 st clone works OK (empty description)')

  // update original profile
  const description = 'some description'
  await p2p.set({ url: rawJSON.url, description })

  // be notified about updates
  let updatedProfile = await p2p2.get(rawJSON.url)
  if (updatedProfile.description !== description) {
    setImmediate(async () => {
      ;[updatedProfile] = await once(p2p2, 'update-profile')

      if (updatedProfile.description === description) {
        t.pass('2nd clone works OK, localdb is updated')
      } else {
        t.fail('profile does not match')
      }
    })
  }

  await p2p.destroy()
  await p2p2.destroy()
  t.end()
})

test.onFinish(async () => {
  if (dht) {
    await dht.destroy()
    dht = null
  }
})
