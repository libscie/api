const test = require('tape')
const validateSubtype = require('../lib/validate-subtype')

module.exports = () => {
  test('Subtype - valid', t => {
    t.doesNotThrow(() => {
      validateSubtype({
        indexMetadata: {
          p2pcommons: {
            subtype: 'Q123'
          }
        }
      })
    })
    t.end()
  })

  test('Subtype - empty', t => {
    t.doesNotThrow(() => {
      validateSubtype({
        indexMetadata: {
          p2pcommons: {
            subtype: ''
          }
        }
      })
    })
    t.end()
  })

  test('Subtype is required - missing', t => {
    t.throws(() => {
      validateSubtype({
        indexMetadata: {
          p2pcommons: {
            type: 'content'
          }
        }
      })
    }, /subtype_required/)
    t.end()
  })

  test('Subtype must be a string - is number', t => {
    t.throws(() => {
      validateSubtype({
        indexMetadata: {
          p2pcommons: {
            subtype: 123
          }
        }
      })
    }, /subtype_type/)
    t.end()
  })

  test('Subtype may only include standard alphanumeric characters - contains spaces', t => {
    t.throws(() => {
      validateSubtype({
        indexMetadata: {
          p2pcommons: {
            subtype: 'Literature review'
          }
        }
      })
    }, /subtype_format/)
    t.end()
  })
}
