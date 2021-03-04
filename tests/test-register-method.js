const { encode } = require('dat-encoding')
const { writeFile } = require('fs').promises
const { join } = require('path')
const test = require('tape')
const tempy = require('tempy')
const execa = require('execa')
const createSdk = require('./utils/create-sdk')
const SDK = require('./..')

module.exports = () => {
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
}
