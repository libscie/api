const test = require('tape')
const { writeFile } = require('fs').promises
const { join } = require('path')
const { encode } = require('dat-encoding')
const createSdk = require('./utils/create-sdk')

module.exports = () => {
  test('deregister content module from profile', async t => {
    const p2p = createSdk()
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
    const p2p = createSdk({ persist: true })
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
    const {
      rawJSON: { url: url1 }
    } = await p2p.init(sampleContent)
    const {
      rawJSON: { url: url2 }
    } = await p2p.init(sampleContent2)
    const {
      rawJSON: { url: url3 }
    } = await p2p.init(sampleContent3)

    const sampleProfile = {
      type: 'profile',
      title: 'd'
    }

    // create my profile
    const { rawJSON: profile } = await p2p.init(sampleProfile)

    const pUrl = encode(profile.url)
    // Manually setting the author profile
    await p2p.set({ url: url1, authors: [pUrl] })
    await p2p.set({ url: url2, authors: [pUrl] })
    await p2p.set({ url: url3, authors: [pUrl] })

    // manually writing a file A
    await writeFile(join(p2p.baseDir, encode(url1), 'fileA.txt'), 'main1')

    await p2p.set({
      url: url1,
      main: 'fileA.txt'
    })

    // manually writing file B
    await writeFile(join(p2p.baseDir, encode(url2), 'fileB.txt'), 'main2')

    const {
      metadata: { version: v2 }
    } = await p2p.set({
      url: url2,
      main: 'fileB.txt'
    })
    // manually writing file C
    await writeFile(join(p2p.baseDir, encode(url3), 'fileC.txt'), 'main3')

    const {
      metadata: { version: v3 }
    } = await p2p.set({
      url: url3,
      main: 'fileC.txt'
    })

    // register the modules (unversioned)
    await p2p.register(url1, profile.url)
    await p2p.register(url2, profile.url)
    await p2p.register(url3, profile.url)

    const { rawJSON: updatedProfile } = await p2p.get(profile.url)
    t.equal(updatedProfile.contents.length, 3, '3 registrations')
    // make some changes
    await writeFile(join(p2p.baseDir, encode(url1), 'new_file.txt'), 'hallo')
    await p2p.refreshDrive(url1)

    // deregister all modules
    await p2p.deregister(url1, profile.url)
    await p2p.deregister(url2, profile.url)
    await p2p.deregister(url3, profile.url)

    // register all modules again (versioned)
    const {
      metadata: { version: v1 }
    } = await p2p.get(url1)
    const versioned = `${url1}+${v1}`
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

    await p2p.destroy()
    t.end()
  })
}
