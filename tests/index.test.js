const createSdk = require('./utils/create-sdk')
const testSdk = require('./test-sdk')
const testRegisterMethod = require('./test-register-method')
const testCloneMethod = require('./test-clone-method')
const testList = require('./test-list')
const testGetMethod = require('./test-get-method')
const testFollowMethod = require('./test-follow-method')
const testDeregisterMethod = require('./test-deregister-method')

const {
  promises: { writeFile, readdir }
} = require('fs')
const { join } = require('path')
const test = require('tape')
const tempy = require('tempy')
const { encode } = require('dat-encoding')
const SDK = require('../')
const createDHT = require('./utils/dht')

let dht, dhtBootstrap

const localDHT = async () => {
  const { url, node } = await createDHT()
  dht = node
  dhtBootstrap = url
}

;(async () => {
  await localDHT()
  await testSdk(dhtBootstrap)
  await testRegisterMethod(dhtBootstrap)
  await testCloneMethod(dhtBootstrap)
})()

testList()
testGetMethod()
testFollowMethod()
testDeregisterMethod()

test('ready', async t => {
  const p2p = createSdk()
  t.doesNotThrow(async () => {
    await p2p.ready()
    await p2p.destroy()
  }, 'ready method should not throw')
  t.end()
})

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

test('update: check version change', async t => {
  const p2p = createSdk()
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

test('multiple writes with persistance', async t => {
  try {
    const dir = tempy.directory()

    const p2p1 = new SDK({
      disableSwarm: true,
      watch: false,
      baseDir: dir
    })

    const { rawJSON } = await p2p1.init({ type: 'content', title: 'title' })
    t.same(typeof rawJSON.url, 'string')
    await p2p1.destroy()

    // create a new instance with same basedir
    const p2p2 = new SDK({
      watch: false,
      disableSwarm: true,
      baseDir: dir
    })

    await p2p2.set({ url: rawJSON.url, title: 'beep' })
    await p2p2.set({ url: rawJSON.url, description: 'boop' })
    const { rawJSON: updated } = await p2p2.get(rawJSON.url)

    t.same(updated.title, 'beep')
    t.same(updated.description, 'boop')
    await p2p2.destroy()

    t.end()
  } catch (err) {
    t.fail(err)
  }
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

test.onFinish(async () => {
  if (dht) {
    await dht.destroy()
    dht = null
  }
})
