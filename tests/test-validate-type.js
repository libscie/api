const test = require('tape')
const validateType = require('../lib/validate-type')

module.exports = () => {
  test('Type - valid', t => {
    t.doesNotThrow(() => {
      validateType({
        indexMetadata: {
          p2pcommons: {
            type: 'content'
          }
        }
      })
    })
    t.end()
  })

  test('Type is required - missing', t => {
    t.throws(() => {
      validateType({
        indexMetadata: {
          p2pcommons: {
            subtype: 'Q123'
          }
        }
      })
    }, /type_required/)
    t.end()
  })

  test('Type must be a string - is number', t => {
    t.throws(() => {
      validateType({
        indexMetadata: {
          p2pcommons: {
            type: 1
          }
        }
      })
    }, /type_type/)
    t.end()
  })

  test("Type must be equal to 'profile' or 'content' - other value", t => {
    t.throws(() => {
      validateType({
        indexMetadata: {
          p2pcommons: {
            type: 'Q123'
          }
        }
      })
    }, /type_value/)
    t.end()
  })
}
