const test = require('tape')
const { validatePartial } = require('../lib/validate')
const { throwsAsync, doesNotThrowAsync } = require('./test-validate-helpers')
const {
  exampleKey1,
  exampleKey3,
  exampleKey4,
  exampleKey5V12,
  exampleKey6V4032,
  exampleKey1V123
} = require('./example-key')

module.exports = () => {
  test('Validate draft - valid content', async t => {
    await throwsAsync(
      t,
      async () => {
        await validatePartial({
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
            p2pcommons: {
              type: 'content',
              subtype: '',
              main: 'test-content.html',
              authors: [exampleKey3, exampleKey4],
              parents: [exampleKey5V12, exampleKey6V4032]
            }
          },
          dbMetadata: {
            version: 50
          },
          key: exampleKey1
        })
      },
      /main_exists/
    )
    t.end()
  })

  test('Validate draft - invalid content (future self-reference parent)', async t => {
    await throwsAsync(
      t,
      async () => {
        await validatePartial({
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
            p2pcommons: {
              type: 'content',
              subtype: '',
              main: 'test-content.html',
              authors: [exampleKey3, exampleKey4],
              parents: [exampleKey5V12, exampleKey1V123]
            }
          },
          dbMetadata: {
            version: 5
          },
          key: exampleKey1
        })
      },
      /parents_noselfreference/
    )
    t.end()
  })

  test('Validate draft - valid profile', async t => {
    await doesNotThrowAsync(t, async () => {
      await validatePartial({
        indexMetadata: {
          title: 'Profile example',
          description: '',
          url: `hyper://${exampleKey3}`,
          links: {
            license: [
              {
                href:
                  'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
              }
            ],
            spec: [{ href: 'https://p2pcommons.com/specs/module/1.0.0' }]
          },
          p2pcommons: {
            type: 'profile',
            subtype: '',
            main: '',
            avatar: './test.png',
            follows: [exampleKey4],
            contents: [
              '00a4f2f18bb6cb4e9ba7c2c047c8560d34047457500e415d535de0526c6b4f23+12'
            ]
          }
        },
        dbMetadata: {
          version: 50
        },
        key: exampleKey3
      })
    })
    t.end()
  })
  test('Validate before init - only type content, flattened', async t => {
    await doesNotThrowAsync(t, async () => {
      await validatePartial({
        indexMetadata: {
          type: 'content'
        }
      })
    })
    t.end()
  })

  test('Validate before init - only type profile, flattened', async t => {
    await doesNotThrowAsync(t, async () => {
      await validatePartial({
        indexMetadata: {
          type: 'profile'
        }
      })
    })
    t.end()
  })

  test('Validate before init - type missing', async t => {
    await throwsAsync(
      t,
      async () => {
        await validatePartial({
          indexMetadata: {
            title: 'Profile example'
          }
        })
      },
      /type_required/
    )
    t.end()
  })

  test('Validate before init - main path empty', async t => {
    await doesNotThrowAsync(t, async () => {
      await validatePartial({
        indexMetadata: {
          type: 'content',
          main: './'
        }
      })
    })
    t.end()
  })
}
