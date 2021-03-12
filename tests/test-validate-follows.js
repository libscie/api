const test = require('tape')
const validateFollows = require('../lib/validate-follows')
const {
  exampleKey1,
  exampleKey2,
  exampleKey2V123,
  exampleKey1V5,
  exampleKey2V40,
  exampleKey3,
  exampleKey3V5,
  exampleKey2V5
} = require('./example-key')

module.exports = () => {
  test('Follows - valid', t => {
    t.doesNotThrow(() => {
      validateFollows({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            follows: [exampleKey2, exampleKey2V123, exampleKey3]
          }
        },
        key: exampleKey1
      })
    })
    t.end()
  })

  test('Follows is only required for profiles - missing for content', t => {
    t.doesNotThrow(() => {
      validateFollows({
        indexMetadata: {
          p2pcommons: {
            type: 'content'
          }
        },
        key: exampleKey1
      })
    })
    t.end()
  })

  test('Follows is required for profiles - missing', t => {
    t.throws(() => {
      validateFollows({
        indexMetadata: {
          p2pcommons: {
            type: 'profile'
          }
        },
        key: exampleKey1
      })
    }, /follows_required/)
    t.end()
  })

  test('Follows may only exist for profiles - exists for content', t => {
    t.throws(() => {
      validateFollows({
        indexMetadata: {
          p2pcommons: {
            type: 'content',
            follows: [exampleKey3V5, exampleKey2V123]
          }
        },
        key: exampleKey1
      })
    }, /follows_moduletype/)
    t.end()
  })

  test('Follows must be an array - is string', t => {
    t.throws(() => {
      validateFollows({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            follows: exampleKey2V5
          }
        },
        key: exampleKey1
      })
    }, /follows_type/)
    t.end()
  })

  test('Follows must be unique - contains multiple versions of same key', t => {
    t.doesNotThrow(() => {
      validateFollows({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            follows: [exampleKey3V5, exampleKey2, exampleKey2V123]
          }
        },
        key: exampleKey1
      })
    })
    t.end()
  })

  test('Follows must be unique - contains duplicates', t => {
    t.throws(() => {
      validateFollows({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            follows: [exampleKey3V5, exampleKey2, exampleKey2]
          }
        },
        key: exampleKey1
      })
    }, /follows_unique/)
    t.end()
  })

  test('Follows may only contain Hyperdrive keys (versioned or non-versioned) - contains URL', t => {
    t.throws(() => {
      validateFollows({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            follows: [exampleKey3, `hyper://${exampleKey2V5}`]
          }
        },
        key: exampleKey1
      })
    }, /follows_format/)
    t.end()
  })

  test("Follows may not refer to the profile's own Hyperdrive key - contains unversioned key", t => {
    t.throws(() => {
      validateFollows({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            follows: [exampleKey1, exampleKey2V40, exampleKey2V123]
          }
        },
        key: exampleKey1
      })
    }, /follows_noselfreference/)
    t.end()
  })

  test("Follows may not refer to the profile's own Hyperdrive key - contains versioned key", t => {
    t.throws(() => {
      validateFollows({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            follows: [exampleKey1V5, exampleKey2, exampleKey2V123]
          }
        },
        key: exampleKey1
      })
    }, /follows_noselfreference/)
    t.end()
  })
}
