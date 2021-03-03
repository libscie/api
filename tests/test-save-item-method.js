const tempy = require('tempy')
const test = require('tape')
const SDK = require('..')

module.exports = () => {
  test('saveItem: should throw ValidationError with invalid metadata', async t => {
    const dir = tempy.directory()

    const p2p = new SDK({
      baseDir: dir
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
}
