const test = require('tape')
const { encode } = require('dat-encoding')
const createSdk = require('./utils/create-sdk')

module.exports = () => {
  test('list content', async t => {
    const p2p = createSdk()
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

    const sampleDataProfile = { type: 'profile', title: 'Professor X' }

    await Promise.all(sampleDataContent.map(d => p2p.init(d)))

    const { rawJSON: profile } = await p2p.init(sampleDataProfile)

    const result = await p2p.listContent()
    t.same(result.length, sampleDataContent.length, 'content list length OK')
    const profiles = await p2p.listProfiles()
    t.same(profiles.length, 1, 'profiles list length OK')

    const content1 = result[0].rawJSON
    // update content1
    await p2p.set({
      url: content1.url,
      description: 'A MORE ACCURATE DESCRIPTION'
    })

    const result2 = await p2p.listContent()
    t.same(
      result2.length,
      sampleDataContent.length,
      'content list length stays the same'
    )

    // update content1
    await p2p.set({
      url: content1.url,
      authors: [encode(profile.url)]
    })

    await p2p.set({
      url: content1.url,
      title: 'demo 1'
    })

    await p2p.listContent()
    const result4 = await p2p.listContent()

    t.ok(
      result2[0].metadata.version < result4[0].metadata.version,
      'latest metadata version should be bigger'
    )
    t.same(
      result4.length,
      sampleDataContent.length,
      'content list length stays the same'
    )

    await p2p.destroy()
    t.end()
  })

  test('list read-only content', async t => {
    const p2p = createSdk()
    const {
      rawJSON: { url }
    } = await p2p.init({ type: 'content', title: 'demo' })

    await p2p.saveItem({
      isWritable: false,
      lastModified: new Date(),
      version: '5',
      indexJSON: {
        url,
        title: 'demo',
        description: '',
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
          subtype: '',
          main: ''
        }
      }
    })

    const result = await p2p.listContent()
    t.same(result.length, 1, 'content list length OK')

    await p2p.destroy()
    t.end()
  })

  test('list profiles', async t => {
    const p2p = createSdk()
    const sampleDataProfile = [
      { type: 'profile', title: 'Professor X' },
      { type: 'profile', title: 'Mystique' }
    ]
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
    const [
      {
        rawJSON: { url }
      }
    ] = await Promise.all(
      []
        .concat(sampleDataProfile)
        .concat(sampleDataContent)
        .map(d => p2p.init(d))
    )

    await p2p.saveItem({
      isWritable: false,
      lastModified: new Date(),
      version: '5',
      indexJSON: {
        url,
        title: sampleDataProfile[0].title,
        description: '',
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
          type: 'profile',
          subtype: '',
          main: '',
          avatar: '',
          follows: [],
          contents: []
        }
      }
    })

    const result = await p2p.listProfiles()
    t.same(result.length, sampleDataProfile.length)
    await p2p.destroy()
    t.end()
  })

  test('list modules', async t => {
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
      { type: 'content', title: 'sample' },
      { type: 'profile', title: 'Professor X' }
    ]

    await Promise.all([].concat(sampleData).map(d => p2p.init(d)))
    const result = await p2p.list()
    t.same(result.length, sampleData.length)
    await p2p.destroy()
    t.end()
  })
}
