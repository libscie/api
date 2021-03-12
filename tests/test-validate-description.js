const test = require('tape')
const validateDescription = require('../lib/validate-description')

module.exports = () => {
  test('Description - valid description', t => {
    t.doesNotThrow(() => {
      validateDescription({
        indexMetadata: {
          description: 'This is a nice description'
        }
      })
    })
    t.end()
  })

  test('Description is required - no description', t => {
    t.throws(() => {
      validateDescription({ indexMetadata: {} })
    }, /description_required/)
    t.end()
  })

  test('Description must be a string - is array', t => {
    t.throws(() => {
      validateDescription({
        indexMetadata: {
          description: ['string']
        }
      })
    }, /description_type/)
    t.end()
  })
}
