const test = require('tape')

const validateAuthors = require('../lib/validate-authors')
const { exampleKey1, exampleKey2, exampleKey2V5 } = require('./example-key')

module.exports = () => {
  test('Authors - valid', t => {
    t.doesNotThrow(() => {
      validateAuthors({
        indexMetadata: {
          p2pcommons: {
            type: 'content',
            authors: [exampleKey1, exampleKey2]
          }
        }
      })
    })
    t.end()
  })

  test('Authors is only required for content - missing for profile', t => {
    t.doesNotThrow(() => {
      validateAuthors({
        indexMetadata: {
          p2pcommons: {
            type: 'profile'
          }
        }
      })
    })
    t.end()
  })

  test('Authors is required for content - missing', t => {
    t.throws(() => {
      validateAuthors({
        indexMetadata: {
          p2pcommons: {
            type: 'content'
          }
        }
      })
    }, /authors_required/)
    t.end()
  })

  test('Authors may only exist for content - exists for profile', t => {
    t.throws(() => {
      validateAuthors({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            authors: [exampleKey1, exampleKey2]
          }
        }
      })
    }, /authors_moduletype/)
    t.end()
  })

  test('Authors must be an array - is string', t => {
    t.throws(() => {
      validateAuthors({
        indexMetadata: {
          p2pcommons: {
            type: 'content',
            authors: exampleKey2
          }
        }
      })
    }, /authors_type/)
    t.end()
  })

  test('Authors must be unique - contains duplicates', t => {
    t.throws(() => {
      validateAuthors({
        indexMetadata: {
          p2pcommons: {
            type: 'content',
            authors: [exampleKey1, exampleKey2, exampleKey2]
          }
        }
      })
    }, /authors_unique/)
    t.end()
  })

  test('Authors may only contain non-versioned Hyperdrive keys - contains versioned keys', t => {
    t.throws(() => {
      validateAuthors({
        indexMetadata: {
          p2pcommons: {
            type: 'content',
            authors: [exampleKey1, exampleKey2V5]
          }
        }
      })
    }, /authors_format/)
    t.end()
  })

  test('Authors may only contain non-versioned Hyperdrive keys - contains names', t => {
    t.throws(() => {
      validateAuthors({
        indexMetadata: {
          p2pcommons: {
            type: 'content',
            authors: [exampleKey1, 'James Lomas']
          }
        }
      })
    }, /authors_format/)
    t.end()
  })
}
