const test = require('tape')
const { encode } = require('dat-encoding')
const { writeFile } = require('fs').promises
const { join } = require('path')
const createSdk = require('./utils/create-sdk')

module.exports = () => {
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
}
