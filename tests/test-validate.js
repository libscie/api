const {
  exampleKey1,
  exampleKey3,
  exampleKey4,
  exampleKey5V12,
  exampleKey6V4032
} = require('./example-key')
const test = require('tape')
const {
  throwsAsync,
  doesNotThrowAsync,
  createDb
} = require('./test-validate-helpers')

const {
  promises: { writeFile }
} = require('fs')
const { join } = require('path')
const { validate } = require('../lib/validate')
const parse = require('../lib/parse-url')
const { encode } = require('dat-encoding')

module.exports = () => {
  test('Validate - flattened index.json', async t => {
    await throwsAsync(
      t,
      async () => {
        await validate({
          indexMetadata: {
            title: 'Content example',
            description: '',
            url: `hyper://${exampleKey1}`,
            links: {
              license: [
                {
                  href:
                    'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
                }
              ],
              spec: [{ href: 'https://p2pcommons.com/specs/module/1.0.0' }]
            },
            type: 'content',
            subtype: '',
            main: 'test-content.html',
            authors: [exampleKey3, exampleKey4],
            parents: [exampleKey5V12, exampleKey6V4032]
          },
          dbMetadata: {
            version: 50
          },
          key: exampleKey1,
          _flat: false
        })
      },
      /p2pcommons_required/
    )
    t.end()
  })

  test('Validate (full) - valid', async t => {
    const p2p = createDb()

    const { rawJSON: profile } = await p2p.init({
      type: 'profile',
      title: 'Author'
    })

    let { rawJSON: content, metadata } = await p2p.init({
      type: 'content',
      title: 'Validate (full) - valid',
      authors: [encode(profile.url)]
    })
    const { host: key } = parse(content.url)

    try {
      await writeFile(join(p2p.baseDir, key, 'main.txt'), 'hello')
    } catch (err) {
      t.fail(err.message)
    }

    ;({ rawJSON: content, metadata } = await p2p.set({
      url: content.url,
      main: 'main.txt'
    }))

    await doesNotThrowAsync(t, async () => {
      await validate({
        indexMetadata: content,
        dbMetadata: metadata,
        key,
        p2pcommonsDir: p2p.baseDir
      })
    })
    await p2p.destroy()
    t.end()
  })

  test("Validate (full) - invalid (main file doesn't exist)", async t => {
    const p2p = createDb()

    const { rawJSON: profile } = await p2p.init({
      type: 'profile',
      title: 'Author'
    })

    let { rawJSON: content, metadata } = await p2p.init({
      type: 'content',
      title: 'Validate (full) - valid'
    })
    const { host: key } = parse(content.url)

    try {
      await writeFile(join(p2p.baseDir, key, 'main2.txt'), 'hello')
    } catch (err) {
      t.fail(err.message)
    }

    ;({ rawJSON: content, metadata } = await p2p.set({
      url: content.url,
      authors: [encode(profile.url)]
    }))

    content.main = 'main.txt'

    await throwsAsync(
      t,
      async () => {
        await validate({
          indexMetadata: content,
          dbMetadata: metadata,
          key,
          p2pcommonsDir: p2p.baseDir
        })
      },
      /main_exists/
    )
    await p2p.destroy()
    t.end()
  })
}
