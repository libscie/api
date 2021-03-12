const test = require('tape')
const validateContents = require('../lib/validate-contents')
const {
  exampleKey1,
  exampleKey3V5,
  exampleKey2V5,
  exampleKey2,
  exampleKey2V123,
  exampleKey3
} = require('./example-key')

module.exports = () => {
  test('Contents - valid', t => {
    t.doesNotThrow(() => {
      validateContents({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            contents: [exampleKey2, exampleKey2V123, exampleKey3]
          }
        },
        key: exampleKey1
      })
    })
    t.end()
  })

  test('Contents is only required for profiles - missing for content', t => {
    t.doesNotThrow(() => {
      validateContents({
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

  test('Contents is required for profiles - missing', t => {
    t.throws(() => {
      validateContents({
        indexMetadata: {
          p2pcommons: {
            type: 'profile'
          }
        },
        key: exampleKey1
      })
    }, /contents_required/)
    t.end()
  })

  test('Contents may only exist for profiles - exists for content', t => {
    t.throws(() => {
      validateContents({
        indexMetadata: {
          p2pcommons: {
            type: 'content',
            contents: [exampleKey3V5, exampleKey2V123]
          }
        },
        key: exampleKey1
      })
    }, /contents_moduletype/)
    t.end()
  })

  test('Contents must be an array - is string', t => {
    t.throws(() => {
      validateContents({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            contents: exampleKey2V5
          }
        },
        key: exampleKey1
      })
    }, /contents_type/)
    t.end()
  })

  test('Contents must be unique - contains multiple versions of same key', t => {
    t.doesNotThrow(() => {
      validateContents({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            contents: [exampleKey3V5, exampleKey2, exampleKey2V123]
          }
        },
        key: exampleKey1
      })
    })
    t.end()
  })

  test('Contents must be unique - contains duplicates', t => {
    t.throws(() => {
      validateContents({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            contents: [exampleKey3V5, exampleKey2, exampleKey2]
          }
        },
        key: exampleKey1
      })
    }, /contents_unique/)
    t.end()
  })

  test('Contents may only contain Hyperdrive keys (versioned or non-versioned) - contains URL', t => {
    t.throws(() => {
      validateContents({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            contents: [
              exampleKey3,
              'hyper://8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+5'
            ]
          }
        },
        key: exampleKey1
      })
    }, /contents_format/)
    t.end()
  })
}
