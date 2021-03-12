const test = require('tape')
const { join } = require('path')
const { writeFile } = require('fs').promises

const validateParents = require('../lib/validate-parents')
const parse = require('../lib/parse-url')
const {
  exampleKey1,
  exampleKey1V5,
  exampleKey1V123,
  exampleKey2V5,
  exampleKey2V123,
  exampleKey2V40
} = require('./example-key')
const validateParentsOnUpdate = require('../lib/validate-parents-on-update')
const {
  throwsAsync,
  doesNotThrowAsync,
  createDb
} = require('./test-validate-helpers')
const { encode } = require('dat-encoding')

module.exports = () => {
  test('Parents - valid', t => {
    t.doesNotThrow(() => {
      validateParents({
        indexMetadata: {
          p2pcommons: {
            type: 'content',
            parents: [exampleKey2V5, exampleKey2V123]
          }
        },
        dbMetadata: {
          version: 10
        },
        key: exampleKey1
      })
    })
    t.end()
  })

  test('Parents is only required for content - missing for profile', t => {
    t.doesNotThrow(() => {
      validateParents({
        indexMetadata: {
          p2pcommons: {
            type: 'profile'
          }
        },
        dbMetadata: {
          version: 10
        },
        key: exampleKey1
      })
    })
    t.end()
  })

  test('Parents is required for content - missing', t => {
    t.throws(() => {
      validateParents({
        indexMetadata: {
          p2pcommons: {
            type: 'content'
          }
        },
        dbMetadata: {
          version: 10
        },
        key: exampleKey1
      })
    }, /parents_required/)
    t.end()
  })

  test('Parents may only exist for content - exists for profile', t => {
    t.throws(() => {
      validateParents({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            parents: [exampleKey1V5, exampleKey2V123]
          }
        },
        dbMetadata: {
          version: 10
        },
        key: exampleKey1
      })
    }, /parents_moduletype/)
    t.end()
  })

  test('Parents must be an array - is string', t => {
    t.throws(() => {
      validateParents({
        indexMetadata: {
          p2pcommons: {
            type: 'content',
            parents: exampleKey2V5
          }
        },
        dbMetadata: {
          version: 10
        },
        key: exampleKey1
      })
    }, /parents_type/)
    t.end()
  })

  test('Parents must be unique - contains multiple versions of same key', t => {
    t.doesNotThrow(() => {
      validateParents({
        indexMetadata: {
          p2pcommons: {
            type: 'content',
            parents: [exampleKey1V5, exampleKey2V40, exampleKey2V123]
          }
        },
        dbMetadata: {
          version: 10
        },
        key: exampleKey1
      })
    })
    t.end()
  })

  test('Parents must be unique - contains duplicates', t => {
    t.throws(() => {
      validateParents({
        indexMetadata: {
          p2pcommons: {
            type: 'content',
            parents: [exampleKey1V5, exampleKey2V123, exampleKey2V123]
          }
        },
        dbMetadata: {
          version: 10
        },
        key: exampleKey1
      })
    }, /parents_unique/)
    t.end()
  })

  test('Parents may only contain versioned Hyperdrive keys - contains non-versioned keys', t => {
    t.throws(() => {
      validateParents({
        indexMetadata: {
          p2pcommons: {
            type: 'content',
            parents: [exampleKey1, exampleKey2V5]
          }
        },
        dbMetadata: {
          version: 10
        },
        key: exampleKey1
      })
    }, /parents_format/)
    t.end()
  })

  test('Parents may not refer to current or future versions of itself - contains previous version', t => {
    t.doesNotThrow(() => {
      validateParents({
        indexMetadata: {
          p2pcommons: {
            type: 'content',
            parents: [exampleKey1V5, exampleKey2V40, exampleKey2V123]
          }
        },
        dbMetadata: {
          version: 10
        },
        key: exampleKey1
      })
    })
    t.end()
  })

  test('Parents may not refer to current or future versions of itself - contains version at time of editing', t => {
    t.doesNotThrow(() => {
      validateParents({
        indexMetadata: {
          p2pcommons: {
            type: 'content',
            parents: [exampleKey1V5, exampleKey2V40, exampleKey2V123]
          }
        },
        dbMetadata: {
          version: 5
        },
        key: exampleKey1
      })
    })
    t.end()
  })

  test('Parents may not refer to current or future versions of itself - contains future version', t => {
    t.throws(() => {
      validateParents({
        indexMetadata: {
          p2pcommons: {
            type: 'content',
            parents: [exampleKey1V123, exampleKey2V40, exampleKey2V123]
          }
        },
        dbMetadata: {
          version: 10
        },
        key: exampleKey1
      })
    }, /parents_noselfreference/)
    t.end()
  })

  test('Parents must be registered by at least one author - 1 parent, 1 author, registered', async t => {
    const p2p = createDb()

    const { rawJSON: profile } = await p2p.init({
      type: 'profile',
      title: 'Author 1'
    })

    let { rawJSON: parent, metadata: parentMetadata } = await p2p.init({
      type: 'content',
      title: 'Parent content 1'
    })
    const { host: parentKey } = parse(parent.url)

    try {
      await writeFile(join(p2p.baseDir, parentKey, 'main.txt'), 'hello')
    } catch (err) {
      t.fail(err.message)
    }

    ;({ rawJSON: parent, metadata: parentMetadata } = await p2p.set({
      url: parent.url,
      main: 'main.txt',
      authors: [encode(profile.url)]
    }))

    try {
      await p2p.register(
        `${encode(parent.url)}+${parentMetadata.version}`,
        encode(profile.url)
      )
    } catch (err) {
      t.fail(err.message)
    }

    await doesNotThrowAsync(t, async () => {
      await validateParentsOnUpdate({
        indexMetadata: {
          p2pcommons: {
            parents: [`${parentKey}+${parentMetadata.version}`]
          }
        },
        p2pcommons: p2p
      })
    })

    await p2p.destroy()
    t.end()
  })

  test('Parents must be registered by at least one author - 2 parents, 2 authors, registered', async t => {
    const p2p = createDb()

    const { rawJSON: profile1 } = await p2p.init({
      type: 'profile',
      title: 'Author 1'
    })

    const { rawJSON: profile2 } = await p2p.init({
      type: 'profile',
      title: 'Author 2'
    })

    let { rawJSON: parent1, metadata: parent1Metadata } = await p2p.init({
      type: 'content',
      title: 'Parent content 1'
    })
    const { host: parent1Key } = parse(parent1.url)

    let { rawJSON: parent2, metadata: parent2Metadata } = await p2p.init({
      type: 'content',
      title: 'Parent content 2'
    })
    const { host: parent2Key } = parse(parent2.url)

    try {
      await writeFile(join(p2p.baseDir, parent1Key, 'main.txt'), 'hello')
      await writeFile(join(p2p.baseDir, parent2Key, 'main.txt'), 'hello')
    } catch (err) {
      t.fail(err.message)
    }

    ;({ rawJSON: parent1, metadata: parent1Metadata } = await p2p.set({
      url: parent1.url,
      main: 'main.txt',
      authors: [encode(profile1.url), encode(profile2.url)]
    }))
    ;({ rawJSON: parent2, metadata: parent2Metadata } = await p2p.set({
      url: parent2.url,
      main: 'main.txt',
      authors: [encode(profile2.url)]
    }))

    try {
      await p2p.register(
        `${encode(parent1.url)}+${parent1Metadata.version}`,
        encode(profile2.url)
      )
    } catch (err) {
      t.fail(err.message)
    }
    try {
      await p2p.register(
        `${encode(parent2.url)}+${parent2Metadata.version}`,
        encode(profile2.url)
      )
    } catch (err) {
      t.fail(err.message)
    }

    await doesNotThrowAsync(t, async () => {
      await validateParentsOnUpdate({
        indexMetadata: {
          p2pcommons: {
            parents: [
              `${parent1Key}+${parent1Metadata.version}`,
              `${parent2Key}+${parent2Metadata.version}`
            ]
          }
        },
        p2pcommons: p2p
      })
    })

    await p2p.destroy()
    t.end()
  })

  test('Parents must be registered by at least one author - 1 parent, 1 author, not registered', async t => {
    const p2p = createDb()

    const { rawJSON: profile1 } = await p2p.init({
      type: 'profile',
      title: 'Author 1'
    })

    let { rawJSON: parent1, metadata: parent1Metadata } = await p2p.init({
      type: 'content',
      title: 'Parent content 1'
    })
    const { host: parent1Key } = parse(parent1.url)

    try {
      await writeFile(join(p2p.baseDir, parent1Key, 'main.txt'), 'hello')
    } catch (err) {
      t.fail(err.message)
    }

    ;({ rawJSON: parent1, metadata: parent1Metadata } = await p2p.set({
      url: parent1.url,
      main: 'main.txt',
      authors: [encode(profile1.url)]
    }))

    await throwsAsync(
      t,
      async () => {
        await validateParentsOnUpdate({
          indexMetadata: {
            p2pcommons: {
              parents: [`${parent1Key}+${parent1Metadata.version}`]
            }
          },
          p2pcommons: p2p
        })
      },
      'parents_registered'
    )

    await p2p.destroy()
    t.end()
  })

  test('Parents must be registered by at least one author - 2 parents, 2 authors, 1 not registered', async t => {
    const p2p = createDb()

    const { rawJSON: profile1 } = await p2p.init({
      type: 'profile',
      title: 'Author 1'
    })

    const { rawJSON: profile2 } = await p2p.init({
      type: 'profile',
      title: 'Author 2'
    })

    let { rawJSON: parent1, metadata: parent1Metadata } = await p2p.init({
      type: 'content',
      title: 'Parent content 1'
    })
    const { host: parent1Key } = parse(parent1.url)

    let { rawJSON: parent2, metadata: parent2Metadata } = await p2p.init({
      type: 'content',
      title: 'Parent content 2'
    })
    const { host: parent2Key } = parse(parent2.url)

    try {
      await writeFile(join(p2p.baseDir, parent1Key, 'main.txt'), 'hello')
      await writeFile(join(p2p.baseDir, parent2Key, 'main.txt'), 'hello')
    } catch (err) {
      t.fail(err.message)
    }

    ;({ rawJSON: parent1, metadata: parent1Metadata } = await p2p.set({
      url: parent1.url,
      main: 'main.txt',
      authors: [encode(profile1.url), encode(profile2.url)]
    }))
    ;({ rawJSON: parent2, metadata: parent2Metadata } = await p2p.set({
      url: parent2.url,
      main: 'main.txt',
      authors: [encode(profile2.url)]
    }))

    try {
      await p2p.register(
        `${encode(parent1.url)}+${parent1Metadata.version}`,
        encode(profile1.url)
      )
    } catch (err) {
      t.fail(err.message)
    }

    await throwsAsync(
      t,
      async () => {
        await validateParentsOnUpdate({
          indexMetadata: {
            p2pcommons: {
              parents: [
                `${parent1Key}+${parent1Metadata.version}`,
                `${parent2Key}+${parent2Metadata.version}`
              ]
            }
          },
          p2pcommons: p2p
        })
      },
      'parents_registered'
    )

    await p2p.destroy()
    t.end()
  })
}
